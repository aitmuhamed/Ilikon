import { ok, route } from '@/lib/api'
import { endSession } from '@/lib/auth'

export const POST = route({
  auth: 'public',
  rateLimit: false,
  async handler() {
    await endSession()
    return ok({ loggedOut: true })
  },
})
