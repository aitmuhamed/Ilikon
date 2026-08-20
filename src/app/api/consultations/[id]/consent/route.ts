import { notFound, ok, route } from '@/lib/api'
import { getSettings } from '@/lib/settings'
import { consultationConsentSchema } from '@/lib/validation'
import {
  acceptDisclaimer,
  authorise,
  buildWireState,
  loadById,
  requireAnswerAccess,
} from '@/lib/consultation'

/**
 * Records the customer's confirmation of the disclaimer (§1). Until this is
 * stored the questionnaire issues no questions, so consent cannot be bypassed
 * by calling the answer endpoint directly.
 */
export const POST = route<{ accepted: true }, { id: string }>({
  auth: 'public',
  schema: consultationConsentSchema,
  rateLimit: 'consultation',
  async handler({ params, session }) {
    const consultation = await loadById(params.id)
    if (!consultation) throw notFound('CONSULTATION_NOT_FOUND')

    const grant = await authorise({ consultation, session })
    requireAnswerAccess(grant)

    const updated = await acceptDisclaimer(consultation)
    const settings = await getSettings()

    return ok({ state: buildWireState({ consultation: updated, settings }) })
  },
})
