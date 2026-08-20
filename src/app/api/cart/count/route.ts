import { ok, route } from '@/lib/api'
import { cartBadgeCount } from '@/lib/cart'

export const GET = route({
  auth: 'public',
  rateLimit: false,
  async handler({ session }) {
    return ok({ count: await cartBadgeCount(session?.id ?? null) })
  },
})
