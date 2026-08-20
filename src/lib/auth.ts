import 'server-only'

import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'

import { prisma } from './prisma'
import { env } from './env'
import { PERMISSION_KEYS, ROLE_KEYS } from './rbac'
import type { Locale } from './locale-types'

export const SESSION_COOKIE = 'ilikon_session'
export const CART_COOKIE = 'ilikon_cart'
export const CSRF_COOKIE = 'ilikon_csrf'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14 // 14 days
const BCRYPT_ROUNDS = 12

export interface SessionUser {
  id: string
  fullName: string
  phone: string
  email: string | null
  isStaff: boolean
  roleKey: string | null
  roleName: string | null
  locale: Locale
  permissions: string[]
}

interface SessionPayload {
  sub: string
  ver: number
  [k: string]: unknown
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().AUTH_SECRET)
}

// ─────────────────────────── passwords ────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Guards against user enumeration on the login endpoint: when no account
 * exists we still burn a comparable amount of time.
 */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.9wA5ZmZ8Ez6mZ.pQ0kzO0kzO0kzO0ka'
export async function dummyPasswordCompare(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH).catch(() => false)
}

// ──────────────────────────── sessions ────────────────────────────────────

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, ver: 1 } satisfies SessionPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('ilikon')
    .setAudience('ilikon-web')
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey())
}

export async function readSessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'ilikon',
      audience: 'ilikon-web',
    })
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export async function startSession(userId: string): Promise<void> {
  const token = await createSessionToken(userId)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  // Double-submit CSRF token: readable by JS, must be echoed in a header.
  jar.set(CSRF_COOKIE, randomBytes(24).toString('base64url'), {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
}

export async function endSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  jar.delete(CSRF_COOKIE)
}

/**
 * Resolves the current actor from the session cookie. Permissions are loaded
 * from the database on every request so a revoked role takes effect
 * immediately rather than at token expiry.
 */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const userId = await readSessionToken(token)
  if (!userId) return null

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, status: 'ACTIVE' },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  })
  if (!user) return null

  const roleKey = user.role?.key ?? null
  const permissions =
    roleKey === ROLE_KEYS.SUPER_ADMIN
      ? [...PERMISSION_KEYS]
      : (user.role?.permissions.map((rp) => rp.permission.key) ?? [])

  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    isStaff: user.isStaff,
    roleKey,
    roleName: user.role?.name ?? null,
    locale: user.locale as Locale,
    permissions,
  }
}

// ──────────────────────── authorisation helpers ───────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export function can(session: SessionUser | null, permission: string): boolean {
  if (!session) return false
  return session.permissions.includes(permission)
}

export function canAny(session: SessionUser | null, permissions: string[]): boolean {
  return permissions.some((p) => can(session, p))
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new AuthError(401, 'Authentication required')
  return session
}

export async function requireStaff(): Promise<SessionUser> {
  const session = await requireUser()
  if (!session.isStaff) throw new AuthError(403, 'Staff access required')
  return session
}

export async function requirePermission(permission: string): Promise<SessionUser> {
  const session = await requireStaff()
  if (!can(session, permission)) {
    throw new AuthError(403, `Missing permission: ${permission}`)
  }
  return session
}

// ───────────────────────── password reset ─────────────────────────────────

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: createHash('sha256').update(token).digest('hex') }
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ─────────────────────────────── CSRF ─────────────────────────────────────

/**
 * Double-submit cookie check for state-changing API calls. Same-site cookies
 * already block the common cases; this closes the gap for older browsers and
 * any future cross-subdomain setup.
 */
export async function verifyCsrf(request: Request): Promise<boolean> {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true

  const jar = await cookies()
  const cookieToken = jar.get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get('x-csrf-token')

  // Anonymous visitors (guest checkout, chatbot) have no session cookie yet;
  // SameSite=Lax plus an origin check is the protection there.
  if (!cookieToken) return true
  if (!headerToken) return false

  const a = Buffer.from(cookieToken)
  const b = Buffer.from(headerToken)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // same-origin navigations and server-side calls
  try {
    const allowed = new Set(
      [process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000']
        .filter(Boolean)
        .map((u) => new URL(u!).host),
    )
    const host = request.headers.get('host')
    if (host) allowed.add(host)
    return allowed.has(new URL(origin).host)
  } catch {
    return false
  }
}
