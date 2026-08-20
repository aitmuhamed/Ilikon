import { ApiError, notFound, ok, route } from '@/lib/api'
import { getSettings } from '@/lib/settings'
import {
  authorise,
  buildWireState,
  isLockedByPharmacist,
  loadById,
  requireAnswerAccess,
  runAssessment,
} from '@/lib/consultation'
import { nextQuestion } from '@/lib/consultation/questionnaire'
import { toAnswerState } from '@/lib/consultation'

/**
 * Runs (or re-runs) the assessment pipeline.
 *
 * The answer endpoint already triggers this on completion; this exists so a
 * customer can retry after a transient model or database failure without
 * re-answering the questionnaire.
 */
export const POST = route<unknown, { id: string }>({
  auth: 'public',
  rateLimit: 'consultationAssess',
  async handler({ params, session }) {
    const consultation = await loadById(params.id)
    if (!consultation) throw notFound('CONSULTATION_NOT_FOUND')

    const grant = await authorise({ consultation, session })
    requireAnswerAccess(grant)

    if (isLockedByPharmacist(consultation)) {
      throw new ApiError(409, 'CONSULTATION_REVIEWED', 'A pharmacist has already reviewed this consultation')
    }
    if (nextQuestion(toAnswerState(consultation)) !== null) {
      throw new ApiError(409, 'QUESTIONNAIRE_INCOMPLETE', 'The questionnaire is not finished yet')
    }

    const settings = await getSettings()
    const assessment = await runAssessment({ consultation, settings })

    return ok({
      state: buildWireState({
        consultation: assessment.consultation,
        settings,
        result: assessment.result,
      }),
    })
  },
})
