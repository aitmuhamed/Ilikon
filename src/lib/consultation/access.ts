import 'server-only'

import { cookies } from 'next/headers'

import { ApiError } from '../api'
import { can, type SessionUser } from '../auth'
import { CONSULTATION_COOKIE } from '../constants'
import type { ConsultationRecord } from './session'

/**
 * Who may open a consultation (§28).
 *
 * Health answers are only ever readable by:
 *
 *   • the signed-in customer who owns the consultation;
 *   • the anonymous visitor holding its continuation key — kept in an httpOnly
 *     cookie so no page script, extension or XSS payload can read it;
 *   • staff with the `consultations.view` permission.
 *
 * Anything else is a 404 rather than a 403: a consultation id should not be
 * confirmable by someone who cannot read it.
 */

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 6 // one sitting, not a durable identity

export async function setConsultationCookie(sessionKey: string): Promise<void> {
  const jar = await cookies()
  jar.set(CONSULTATION_COOKIE, sessionKey, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

export async function readConsultationCookie(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(CONSULTATION_COOKIE)?.value ?? null
}

export async function clearConsultationCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(CONSULTATION_COOKIE)
}

export type AccessRole = 'owner' | 'staff'

export interface AccessGrant {
  role: AccessRole
  /** Staff readers never get write access to the questionnaire itself. */
  canAnswer: boolean
  canReview: boolean
}

export async function authorise(input: {
  consultation: ConsultationRecord
  session: SessionUser | null
}): Promise<AccessGrant> {
  const { consultation, session } = input

  const isOwner = Boolean(
    (consultation.userId && session?.id === consultation.userId) ||
      (await readConsultationCookie()) === consultation.sessionKey,
  )

  if (isOwner) {
    return {
      role: 'owner',
      canAnswer: true,
      canReview: false,
    }
  }

  if (session && can(session, 'consultations.view')) {
    return {
      role: 'staff',
      canAnswer: false,
      canReview: can(session, 'consultations.review'),
    }
  }

  throw new ApiError(404, 'NOT_FOUND', 'Consultation not found')
}

export function requireAnswerAccess(grant: AccessGrant): void {
  if (!grant.canAnswer) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the customer can answer their own consultation')
  }
}

export function requireReviewAccess(grant: AccessGrant): void {
  if (!grant.canReview) {
    throw new ApiError(403, 'FORBIDDEN', 'Pharmacist review permission required')
  }
}
