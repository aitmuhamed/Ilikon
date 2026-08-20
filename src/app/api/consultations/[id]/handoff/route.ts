import { notFound, ok, route } from '@/lib/api'
import { getSettings } from '@/lib/settings'
import { consultationHandoffSchema } from '@/lib/validation'
import {
  authorise,
  buildWireState,
  handoffToPharmacist,
  loadById,
  loadStoredResult,
  requireAnswerAccess,
} from '@/lib/consultation'

/**
 * "Фармацевттай зөвлөх" (§20). Sends the full clinical packet to the pharmacist
 * queue and tells the customer what happens next.
 */
export const POST = route<{ note?: string; phone?: string }, { id: string }>({
  auth: 'public',
  schema: consultationHandoffSchema,
  rateLimit: 'consultation',
  async handler({ body, params, session, request }) {
    const consultation = await loadById(params.id)
    if (!consultation) throw notFound('CONSULTATION_NOT_FOUND')

    const grant = await authorise({ consultation, session })
    requireAnswerAccess(grant)

    const handoff = await handoffToPharmacist({
      consultation,
      note: body.note ?? null,
      request,
    })

    const settings = await getSettings()
    const result = await loadStoredResult({ consultation: handoff.consultation, settings })

    return ok({
      message: handoff.message,
      state: buildWireState({ consultation: handoff.consultation, settings, result }),
    })
  },
})
