import { ok, route } from '@/lib/api'
import { clearCart, getCartSummary } from '@/lib/cart'
import { coerceLocale } from '@/lib/locale-types'

export const GET = route({
  auth: 'public',
  rateLimit: false,
  async handler({ session, query }) {
    const summary = await getCartSummary(session?.id ?? null, coerceLocale(query.get('locale')))
    return ok(summary)
  },
})

export const DELETE = route({
  auth: 'public',
  skipCsrf: true,
  async handler({ session, query }) {
    await clearCart(session?.id ?? null)
    const summary = await getCartSummary(session?.id ?? null, coerceLocale(query.get('locale')))
    return ok(summary)
  },
})
