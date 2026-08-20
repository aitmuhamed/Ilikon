import { ApiError, ok, readPagination, route, pageMeta } from '@/lib/api'
import { can } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { coerceLocale } from '@/lib/locale-types'
import { consultationStartSchema, consultationListQuerySchema } from '@/lib/validation'
import {
  buildWireState,
  createConsultation,
  disclaimerText,
  setConsultationCookie,
} from '@/lib/consultation'
import { symptomLabel } from '@/lib/consultation/types'

/**
 * Start a consultation (§1, §2).
 *
 * The response carries the disclaimer and nothing else clinical: the first
 * question is only issued once consent is recorded.
 */
export const POST = route({
  auth: 'public',
  schema: consultationStartSchema,
  rateLimit: 'consultationStart',
  async handler({ body, session }) {
    const settings = await getSettings()
    if (!settings.consultationEnabled) {
      throw new ApiError(503, 'CONSULTATION_DISABLED', 'The consultation assistant is unavailable')
    }

    const requested = coerceLocale(body.locale ?? session?.locale)
    const locale = settings.consultationLocales.includes(requested)
      ? requested
      : coerceLocale(settings.consultationLocales[0] ?? 'mn')

    const consultation = await createConsultation({
      userId: session?.id ?? null,
      locale,
      settings,
    })

    // Ownership proof for anonymous visitors lives in an httpOnly cookie, so no
    // page script can read or replay it.
    await setConsultationCookie(consultation.sessionKey)

    return ok({
      state: buildWireState({ consultation, settings }),
      disclaimer: disclaimerText(settings, locale),
      emergencyNumber: settings.emergencyNumber,
    })
  },
})

/**
 * Consultation history. A customer sees their own; staff holding
 * `consultations.view` may list all of them for the admin dashboard.
 */
export const GET = route({
  auth: 'user',
  schema: consultationListQuerySchema,
  async handler({ body, query, session }) {
    const staffScope = body.scope === 'all' && can(session, 'consultations.view')
    if (body.scope === 'all' && !staffScope) {
      throw new ApiError(403, 'FORBIDDEN', 'Permission required to list all consultations')
    }

    const pagination = readPagination(query, 20, 60)
    const where = {
      ...(staffScope ? {} : { userId: session!.id }),
      ...(body.triage ? { triageLevel: body.triage as never } : {}),
      ...(body.status ? { status: body.status as never } : {}),
      ...(body.symptom ? { primarySymptom: body.symptom } : {}),
      ...(body.q
        ? {
            OR: [
              { code: { contains: body.q, mode: 'insensitive' as const } },
              { primarySymptom: { contains: body.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          code: true,
          locale: true,
          status: true,
          triageLevel: true,
          recommendationType: true,
          primarySymptom: true,
          severity: true,
          createdAt: true,
          assessedAt: true,
          handedOffAt: true,
          reviewedAt: true,
          purgedAt: true,
          pharmacistReviewRequired: true,
          user: staffScope ? { select: { id: true, fullName: true } } : false,
          _count: { select: { redFlags: true, recommendations: true, reviews: true } },
        },
      }),
      prisma.consultation.count({ where }),
    ])

    return ok({
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        triageLevel: row.triageLevel,
        recommendationType: row.recommendationType,
        symptom: row.primarySymptom,
        symptomLabel: symptomLabel(row.primarySymptom, row.locale),
        severity: row.severity,
        createdAt: row.createdAt,
        assessedAt: row.assessedAt,
        handedOff: Boolean(row.handedOffAt),
        reviewed: Boolean(row.reviewedAt),
        purged: Boolean(row.purgedAt),
        pharmacistReviewRequired: row.pharmacistReviewRequired,
        redFlagCount: row._count.redFlags,
        recommendationCount: row._count.recommendations,
        reviewCount: row._count.reviews,
        customerName: 'user' in row && row.user ? row.user.fullName : null,
      })),
      meta: pageMeta(pagination, total),
    })
  },
})
