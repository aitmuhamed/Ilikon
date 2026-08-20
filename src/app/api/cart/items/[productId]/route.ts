import { ok, route } from '@/lib/api'
import { getCartSummary, removeFromCart } from '@/lib/cart'
import { coerceLocale } from '@/lib/locale-types'

export const DELETE = route<unknown, { productId: string }>({
  auth: 'public',
  skipCsrf: true,
  async handler({ params, session, query }) {
    await removeFromCart(session?.id ?? null, params.productId)
    const summary = await getCartSummary(session?.id ?? null, coerceLocale(query.get('locale')))
    return ok(summary)
  },
})
