import 'server-only'

import { NextResponse } from 'next/server'
import { ZodError, type ZodType, type ZodTypeDef } from 'zod'

import { AuthError, getSession, requirePermission, requireStaff, requireUser, verifyCsrf, verifyOrigin, type SessionUser } from './auth'
import { RATE_LIMITS, clientIp, rateLimit } from './rate-limit'

/**
 * One wrapper for every API route so that authentication, CSRF, rate limiting,
 * validation and error shaping cannot be forgotten per-endpoint.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code)
    this.name = 'ApiError'
  }
}

export const badRequest = (code: string, message?: string, details?: unknown) =>
  new ApiError(400, code, message, details)
export const notFound = (code = 'NOT_FOUND', message?: string) => new ApiError(404, code, message)
export const conflict = (code: string, message?: string) => new ApiError(409, code, message)
export const unprocessable = (code: string, message?: string, details?: unknown) =>
  new ApiError(422, code, message, details)

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiFailure {
  ok: false
  error: { code: string; message: string; details?: unknown }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, init)
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ ok: false as const, error: { code, message, details } }, { status })
}

type Auth = 'public' | 'user' | 'staff' | { permission: string }

export interface HandlerContext<TBody, TParams extends Record<string, string> = Record<string, string>> {
  request: Request
  body: TBody
  params: TParams
  query: URLSearchParams
  session: SessionUser | null
}

export interface RouteOptions<TBody, TParams extends Record<string, string>> {
  auth?: Auth
  /**
   * Zod schema applied to the parsed JSON body (non-GET requests).
   * Typed on the schema's *output* so `.default()` and `.transform()` narrow
   * the handler's `body` rather than leaving every defaulted field optional.
   */
  schema?: ZodType<TBody, ZodTypeDef, unknown>
  rateLimit?: keyof typeof RATE_LIMITS | { max: number; windowMs: number } | false
  /** Skip CSRF for endpoints legitimately called by anonymous visitors. */
  skipCsrf?: boolean
  handler: (ctx: HandlerContext<TBody, TParams>) => Promise<NextResponse> | NextResponse
}

/**
 * Next.js 15 passes route params as a promise on the second argument. The type
 * must be non-optional to satisfy the framework's generated route checks, even
 * for paths that declare no dynamic segments.
 */
type NextRouteArgs<TParams> = { params: Promise<TParams> }

export function route<TBody = unknown, TParams extends Record<string, string> = Record<string, string>>(
  options: RouteOptions<TBody, TParams>,
) {
  return async function handler(request: Request, args: NextRouteArgs<TParams>): Promise<NextResponse> {
    const method = request.method.toUpperCase()
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method)

    try {
      if (isWrite && !verifyOrigin(request)) {
        throw new ApiError(403, 'BAD_ORIGIN', 'Request origin is not allowed')
      }
      if (isWrite && !options.skipCsrf && !(await verifyCsrf(request))) {
        throw new ApiError(403, 'CSRF_FAILED', 'Invalid or missing CSRF token')
      }

      // ── authentication ────────────────────────────────────────────────
      let session: SessionUser | null = null
      const auth = options.auth ?? 'public'
      if (auth === 'public') session = await getSession()
      else if (auth === 'user') session = await requireUser()
      else if (auth === 'staff') session = await requireStaff()
      else session = await requirePermission(auth.permission)

      // ── rate limiting ─────────────────────────────────────────────────
      if (options.rateLimit !== false) {
        const preset =
          typeof options.rateLimit === 'string'
            ? RATE_LIMITS[options.rateLimit]
            : options.rateLimit ?? (isWrite ? RATE_LIMITS.write : undefined)
        if (preset) {
          const bucketKey = `${new URL(request.url).pathname}:${session?.id ?? clientIp(request)}`
          const result = rateLimit(bucketKey, preset)
          if (!result.ok) {
            return NextResponse.json(
              { ok: false as const, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
              { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
            )
          }
        }
      }

      // ── body validation ───────────────────────────────────────────────
      let body = undefined as TBody
      if (options.schema) {
        let raw: unknown = {}
        if (isWrite) {
          const contentType = request.headers.get('content-type') ?? ''
          if (contentType.includes('application/json')) {
            raw = await request.json().catch(() => {
              throw badRequest('INVALID_JSON', 'Request body is not valid JSON')
            })
          } else if (contentType.includes('form')) {
            raw = Object.fromEntries((await request.formData()).entries())
          }
        } else {
          raw = Object.fromEntries(new URL(request.url).searchParams.entries())
        }
        body = options.schema.parse(raw)
      }

      const params = ((await args?.params) ?? {}) as TParams

      return await options.handler({
        request,
        body,
        params,
        query: new URL(request.url).searchParams,
        session,
      })
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return fail(
      422,
      'VALIDATION_FAILED',
      'Validation failed',
      error.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code })),
    )
  }
  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message, error.details)
  }
  if (error instanceof AuthError) {
    return fail(
      error.status,
      error.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
      error.message,
    )
  }
  // Prisma unique-constraint violation
  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: string }).code
    if (code === 'P2002') return fail(409, 'DUPLICATE', 'A record with this value already exists')
    if (code === 'P2025') return fail(404, 'NOT_FOUND', 'Record not found')
    if (code === 'P2003') return fail(409, 'FK_CONSTRAINT', 'Referenced record is missing or in use')
  }

  // Never leak internals to the client; the full error stays in the server log.
  console.error('[api] unhandled error', error)
  return fail(500, 'INTERNAL_ERROR', 'Internal server error')
}

// ───────────────────────────── pagination ─────────────────────────────────

export interface Pagination {
  page: number
  perPage: number
  skip: number
  take: number
}

export function readPagination(query: URLSearchParams, defaultPerPage = 20, maxPerPage = 100): Pagination {
  const page = Math.max(1, Number(query.get('page') ?? 1) || 1)
  const perPage = Math.min(maxPerPage, Math.max(1, Number(query.get('perPage') ?? defaultPerPage) || defaultPerPage))
  return { page, perPage, skip: (page - 1) * perPage, take: perPage }
}

export interface PageMeta {
  page: number
  perPage: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export function pageMeta(pagination: Pagination, total: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / pagination.perPage))
  return {
    page: pagination.page,
    perPage: pagination.perPage,
    total,
    totalPages,
    hasNext: pagination.page < totalPages,
    hasPrev: pagination.page > 1,
  }
}
