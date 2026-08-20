import { ok, route } from '@/lib/api'
import { reorder } from '@/lib/orders'
import { cartBadgeCount } from '@/lib/cart'

/** Rebuilds the cart from a past order, reporting anything no longer sellable. */
export const POST = route<unknown, { id: string }>({
  auth: 'user',
  async handler({ params, session }) {
    const result = await reorder(params.id, session!.id)
    return ok({ ...result, cartCount: await cartBadgeCount(session!.id) })
  },
})
