import 'server-only'

import { env } from './env'

/**
 * In-process fixed-window rate limiter.
 *
 * Good enough for a single-instance deployment and for blunting credential
 * stuffing / scraping. Behind more than one instance, swap `buckets` for Redis
 * — the call sites do not change.
 */
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

export function rateLimit(
  key: string,
  options?: { max?: number; windowMs?: number },
): RateLimitResult {
  const cfg = env()
  const max = options?.max ?? cfg.RATE_LIMIT_MAX
  const windowMs = options?.windowMs ?? cfg.RATE_LIMIT_WINDOW_MS
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs }
    buckets.set(key, bucket)
    return { ok: true, remaining: max - 1, resetAt: bucket.resetAt, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const ok = existing.count <= max
  return {
    ok,
    remaining: Math.max(0, max - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  }
}

/** Tighter limits for endpoints that are attractive to abuse. */
export const RATE_LIMITS = {
  login: { max: 8, windowMs: 5 * 60_000 },
  register: { max: 5, windowMs: 60 * 60_000 },
  passwordReset: { max: 5, windowMs: 60 * 60_000 },
  chatbot: { max: 30, windowMs: 60_000 },
  /** One answer per question, so the ceiling is generous — but not unbounded. */
  consultation: { max: 90, windowMs: 60_000 },
  /** The assessment runs the whole pipeline, including model calls. */
  consultationAssess: { max: 10, windowMs: 5 * 60_000 },
  /**
   * Starting a consultation is the real cost gate.
   *
   * The assessment runs automatically when the last question is answered, so
   * the `consultationAssess` bucket alone does not bound model spend — someone
   * could complete a fresh questionnaire repeatedly and stay inside the looser
   * `consultation` bucket. Capping *creation* caps completed questionnaires,
   * and therefore model calls, regardless of which endpoint triggers them.
   *
   * Kept at 20/hour rather than something tighter because this bucket is keyed
   * by IP for anonymous visitors, and mobile carriers here put many customers
   * behind one address — a tight per-IP cap would lock out real people. It
   * still bounds spend to roughly 40 model calls per hour per address. Behind a
   * load balancer, move the limiter to Redis so the cap is global rather than
   * per-instance.
   */
  consultationStart: { max: 20, windowMs: 60 * 60_000 },
  upload: { max: 20, windowMs: 60 * 60_000 },
  order: { max: 10, windowMs: 10 * 60_000 },
  review: { max: 10, windowMs: 60 * 60_000 },
  search: { max: 120, windowMs: 60_000 },
  write: { max: 60, windowMs: 60_000 },
} as const

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
