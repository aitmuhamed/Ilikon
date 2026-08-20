import 'server-only'

import { prisma } from './prisma'
import type { SessionUser } from './auth'

/**
 * Append-only audit trail. Every privileged mutation and every prescription
 * file access writes a row here. Failures are swallowed on purpose: losing an
 * audit row must not roll back the pharmacist's actual work, but it is logged
 * to the server console so it can be alerted on.
 */
export interface AuditInput {
  actor?: SessionUser | null
  action: string
  entity: string
  entityId?: string | null
  summary?: string
  changes?: Record<string, unknown> | null
  request?: Request | null
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorLabel: input.actor ? `${input.actor.fullName} (${input.actor.roleName ?? 'staff'})` : 'system',
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        changes: (input.changes ?? undefined) as never,
        ip: input.request ? headerIp(input.request) : null,
        userAgent: input.request?.headers.get('user-agent')?.slice(0, 400) ?? null,
      },
    })
  } catch (error) {
    console.error('[audit] failed to write audit log', input.action, error)
  }
}

function headerIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')
}

/**
 * Shallow diff for audit `changes`. Only the fields that actually moved are
 * recorded, and values that should never be persisted are redacted.
 */
const REDACTED_FIELDS = new Set(['passwordHash', 'password', 'token', 'tokenHash', 'secret'])

export function diffChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of Object.keys(after)) {
    if (REDACTED_FIELDS.has(key)) {
      if (before[key] !== after[key]) changes[key] = { from: '«redacted»', to: '«redacted»' }
      continue
    }
    const a = normalise(before[key])
    const b = normalise(after[key])
    if (a !== b) changes[key] = { from: before[key] ?? null, to: after[key] ?? null }
  }
  return changes
}

function normalise(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
