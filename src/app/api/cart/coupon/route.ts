import { ApiError, ok, route } from '@/lib/api'
import { applyCartCoupon, getCartSummary, removeCartCoupon } from '@/lib/cart'
import { couponApplySchema } from '@/lib/validation'
import { couponRejectionMessage, type CouponRejection } from '@/lib/coupons'
import { coerceLocale } from '@/lib/locale-types'

export const POST = route({
  auth: 'public',
  schema: couponApplySchema,
  skipCsrf: true,
  async handler({ body, session, query }) {
    const locale = coerceLocale(query.get('locale'))
    const result = await applyCartCoupon(session?.id ?? null, body.code, locale)

    if (!result.ok) {
      const reason = (result.reason ?? 'NOT_FOUND') as CouponRejection
      throw new ApiError(400, reason, couponRejectionMessage(reason, locale))
    }

    return ok(await getCartSummary(session?.id ?? null, locale))
  },
})

export const DELETE = route({
  auth: 'public',
  skipCsrf: true,
  async handler({ session, query }) {
    await removeCartCoupon(session?.id ?? null)
    return ok(await getCartSummary(session?.id ?? null, coerceLocale(query.get('locale'))))
  },
})
