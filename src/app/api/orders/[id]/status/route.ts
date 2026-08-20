import { ApiError, ok, route } from '@/lib/api'
import { OrderError, updateOrderStatus } from '@/lib/orders'
import { orderStatusSchema } from '@/lib/validation'
import { audit } from '@/lib/audit'

export const PATCH = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'orders.update' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: orderStatusSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof orderStatusSchema>

    if (data.status === 'CANCELLED') {
      throw new ApiError(400, 'USE_CANCEL_ENDPOINT', 'Use the cancel endpoint to cancel an order')
    }

    try {
      await updateOrderStatus({
        orderId: params.id,
        status: data.status,
        actor: session!,
        message: data.message,
      })
    } catch (error) {
      if (error instanceof OrderError) {
        throw new ApiError(409, error.code, error.code)
      }
      throw error
    }

    await audit({
      actor: session,
      action: 'order.status_update',
      entity: 'Order',
      entityId: params.id,
      summary: `→ ${data.status}`,
      request,
    })

    return ok({ status: data.status })
  },
})
