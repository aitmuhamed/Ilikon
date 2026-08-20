import { ApiError, notFound, ok, route, unprocessable } from '@/lib/api'
import { getSettings } from '@/lib/settings'
import { consultationAnswerSchema } from '@/lib/validation'
import {
  authorise,
  buildWireState,
  isLockedByPharmacist,
  loadById,
  recordAnswer,
  requireAnswerAccess,
  runAssessment,
} from '@/lib/consultation'
import { AnswerError } from '@/lib/consultation/questionnaire'

/**
 * Answers the current question and returns the next one (§5).
 *
 * The assessment runs automatically the moment the questionnaire is complete —
 * or the moment an emergency red flag fires, which ends the questionnaire early
 * rather than continuing to ask about medication history (§9).
 */
export const POST = route<{ questionKey: string; value?: unknown }, { id: string }>({
  auth: 'public',
  schema: consultationAnswerSchema,
  rateLimit: 'consultation',
  async handler({ body, params, session }) {
    const consultation = await loadById(params.id)
    if (!consultation) throw notFound('CONSULTATION_NOT_FOUND')

    const grant = await authorise({ consultation, session })
    requireAnswerAccess(grant)

    const settings = await getSettings()
    if (!settings.consultationEnabled) {
      throw new ApiError(503, 'CONSULTATION_DISABLED', 'The consultation assistant is unavailable')
    }
    if (!consultation.disclaimerAcceptedAt) {
      throw new ApiError(409, 'CONSENT_REQUIRED', 'The disclaimer must be accepted first')
    }
    // A pharmacist's verdict is final; re-answering would silently invalidate it.
    if (isLockedByPharmacist(consultation)) {
      throw new ApiError(409, 'CONSULTATION_REVIEWED', 'This consultation has been reviewed by a pharmacist')
    }

    let recorded
    try {
      recorded = await recordAnswer({
        consultation,
        questionKey: body.questionKey,
        value: body.value,
      })
    } catch (error) {
      if (error instanceof AnswerError) throw unprocessable(error.code, `Invalid answer: ${error.code}`)
      throw error
    }

    if (!recorded.complete) {
      return ok({ state: buildWireState({ consultation: recorded.consultation, settings }) })
    }

    const assessment = await runAssessment({ consultation: recorded.consultation, settings })

    return ok({
      state: buildWireState({
        consultation: assessment.consultation,
        settings,
        result: assessment.result,
      }),
    })
  },
})
