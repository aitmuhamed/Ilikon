import { notFound, ok, route } from '@/lib/api'
import { getSettings } from '@/lib/settings'
import { consultationReviewSchema } from '@/lib/validation'
import {
  authorise,
  buildWireState,
  loadById,
  loadStoredResult,
  recordReview,
  requireReviewAccess,
  type ReviewAction,
} from '@/lib/consultation'
import type { TriageLevelKey } from '@/lib/consultation/types'

interface ReviewBody {
  action: ReviewAction
  pharmacistRecommendation?: string
  reasonForChange?: string
  note?: string
  triageOverride?: TriageLevelKey
  productId?: string
  removeRecommendationIds?: string[]
}

/**
 * Pharmacist review (§20, §21).
 *
 * Gated on `consultations.review`, which only the pharmacist role holds by
 * default — accepting, modifying or rejecting a medicines recommendation is a
 * licensed act, so a general admin cannot do it even though they can read the
 * consultation.
 */
export const POST = route<ReviewBody, { id: string }>({
  auth: { permission: 'consultations.view' },
  schema: consultationReviewSchema,
  async handler({ body, params, session, request }) {
    const consultation = await loadById(params.id)
    if (!consultation) throw notFound('CONSULTATION_NOT_FOUND')

    const grant = await authorise({ consultation, session })
    requireReviewAccess(grant)

    const updated = await recordReview({
      consultation,
      pharmacist: session!,
      action: body.action,
      pharmacistRecommendation: body.pharmacistRecommendation,
      reasonForChange: body.reasonForChange,
      note: body.note,
      triageOverride: body.triageOverride,
      productId: body.productId,
      removeRecommendationIds: body.removeRecommendationIds,
      request,
    })

    const settings = await getSettings()
    const result = await loadStoredResult({ consultation: updated, settings })

    return ok({ state: buildWireState({ consultation: updated, settings, result }) })
  },
})
