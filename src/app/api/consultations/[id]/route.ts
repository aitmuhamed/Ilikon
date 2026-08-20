import { notFound, ok, route } from '@/lib/api'
import { audit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'
import { authorise, buildWireState, loadById, loadStoredResult } from '@/lib/consultation'

/**
 * Current state of a consultation: the next question if it is still running,
 * the stored assessment if it has finished.
 *
 * A staff read is audit-logged, because opening this means reading someone's
 * health answers (§28).
 */
export const GET = route<unknown, { id: string }>({
  auth: 'public',
  async handler({ params, session, request }) {
    const consultation = await loadById(params.id)
    if (!consultation) throw notFound('CONSULTATION_NOT_FOUND')

    const grant = await authorise({ consultation, session })
    const settings = await getSettings()

    if (grant.role === 'staff') {
      await audit({
        actor: session,
        action: 'consultation.view',
        entity: 'Consultation',
        entityId: consultation.id,
        summary: `Opened consultation ${consultation.code}`,
        request,
      })
    }

    const result = await loadStoredResult({ consultation, settings })

    return ok({
      state: buildWireState({ consultation, settings, result }),
      access: grant,
      disclaimer: result?.disclaimer ?? null,
    })
  },
})
