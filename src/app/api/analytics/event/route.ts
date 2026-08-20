import { ok, route } from '@/lib/api'
import { analyticsEventSchema } from '@/lib/validation'
import { trackEvent } from '@/lib/analytics'

/**
 * First-party event collection.
 *
 * The session id is an opaque, rotating value generated in the browser; no
 * cross-site identifier is accepted or stored, and the endpoint records nothing
 * the caller did not explicitly send.
 */
export const POST = route({
  auth: 'public',
  schema: analyticsEventSchema,
  rateLimit: { max: 120, windowMs: 60_000 },
  skipCsrf: true,
  async handler({ body, session, request }) {
    await trackEvent({
      name: body.name,
      userId: session?.id ?? null,
      productId: body.productId ?? null,
      value: body.value ?? null,
      metadata: body.metadata ?? null,
      sessionId: request.headers.get('x-analytics-session')?.slice(0, 80) ?? null,
    })
    return ok({ recorded: true })
  },
})
