import { ApiError, ok, route } from '@/lib/api'
import { CartError, addToCart, getCartSummary, setCartQuantity } from '@/lib/cart'
import { cartAddSchema, cartUpdateSchema } from '@/lib/validation'
import { coerceLocale } from '@/lib/locale-types'
import { trackEvent } from '@/lib/analytics'

function toApiError(error: unknown): never {
  if (error instanceof CartError) {
    const status = error.code === 'PRODUCT_NOT_FOUND' ? 404 : 409
    throw new ApiError(status, error.code, error.code, { available: error.available })
  }
  throw error
}

export const POST = route({
  auth: 'public',
  schema: cartAddSchema,
  skipCsrf: true, // guests add to cart before any session exists
  async handler({ body, session, query, request }) {
    try {
      await addToCart(session?.id ?? null, body.productId, body.quantity)
    } catch (error) {
      toApiError(error)
    }

    void trackEvent({
      name: 'add_to_cart',
      userId: session?.id ?? null,
      productId: body.productId,
      value: body.quantity,
      sessionId: request.headers.get('x-analytics-session'),
    })

    const summary = await getCartSummary(session?.id ?? null, coerceLocale(query.get('locale')))
    return ok(summary)
  },
})

export const PATCH = route({
  auth: 'public',
  schema: cartUpdateSchema,
  skipCsrf: true,
  async handler({ body, session, query }) {
    try {
      await setCartQuantity(session?.id ?? null, body.productId, body.quantity)
    } catch (error) {
      toApiError(error)
    }
    const summary = await getCartSummary(session?.id ?? null, coerceLocale(query.get('locale')))
    return ok(summary)
  },
})
