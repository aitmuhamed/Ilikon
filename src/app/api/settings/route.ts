import { ApiError, ok, route } from '@/lib/api'
import {
  DEFAULT_SETTINGS,
  SAFETY_CRITICAL_SETTINGS,
  getSettings,
  updateSettings,
  type PharmacySettings,
} from '@/lib/settings'
import { can } from '@/lib/auth'
import { paymentProviderStatus } from '@/lib/payments'
import { isLlmConfigured } from '@/lib/chatbot'
import { isLlmConfigured as isConsultationLlmConfigured } from '@/lib/consultation'
import { audit, diffChanges } from '@/lib/audit'

export const GET = route({
  auth: { permission: 'settings.view' },
  rateLimit: false,
  async handler() {
    return ok({
      settings: await getSettings(),
      // Read-only diagnostics so staff can see which gateways have credentials
      // without ever seeing the credentials themselves.
      integrations: {
        payments: paymentProviderStatus(),
        chatbotLlm: isLlmConfigured(),
        consultationLlm: isConsultationLlmConfigured(),
      },
    })
  },
})

/**
 * Settings update.
 *
 * Only keys that exist in `DEFAULT_SETTINGS` are accepted, and values are
 * coerced to the default's type — so a posted string cannot turn a numeric
 * delivery fee into text. Secrets are never stored here.
 */
export const PATCH = route({
  auth: { permission: 'settings.manage' },
  async handler({ request, session }) {
    const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const before = await getSettings()
    const patch: Partial<PharmacySettings> = {}

    // Consultation safety rules — escalation threshold, allowed and blocked
    // products, the system prompt, the disclaimer and the emergency number —
    // need their own permission (§23). Rejected loudly rather than dropped
    // silently, so an admin without the permission cannot believe they changed
    // a safety rule when they did not.
    const safetyKeysTouched = SAFETY_CRITICAL_SETTINGS.filter((key) => key in raw)
    if (safetyKeysTouched.length > 0 && !can(session, 'consultations.safety')) {
      throw new ApiError(
        403,
        'SAFETY_PERMISSION_REQUIRED',
        'Changing consultation safety rules requires the consultations.safety permission',
        { keys: safetyKeysTouched },
      )
    }

    for (const [key, value] of Object.entries(raw)) {
      if (!(key in DEFAULT_SETTINGS)) continue
      const reference = DEFAULT_SETTINGS[key as keyof PharmacySettings]

      if (typeof reference === 'number') {
        const numeric = Number(value)
        if (Number.isFinite(numeric) && numeric >= 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(patch as any)[key] = Math.round(numeric)
        }
      } else if (typeof reference === 'boolean') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(patch as any)[key] = value === true || value === 'true' || value === 'on'
      } else if (Array.isArray(reference)) {
        if (Array.isArray(value)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(patch as any)[key] = value.map(String).slice(0, 200)
        }
      } else if (typeof value === 'string') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(patch as any)[key] = value.slice(0, 2000)
      }
    }

    const after = await updateSettings(patch)

    await audit({
      actor: session,
      action: 'settings.update',
      entity: 'Setting',
      summary: `${Object.keys(patch).length} setting(s) changed`,
      changes: diffChanges(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
      request,
    })

    return ok({ settings: after })
  },
})
