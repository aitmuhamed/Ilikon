import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { OrderError, cancelOrder } from '@/lib/orders'
import { orderCancelSchema } from '@/lib/validation'
import { can } from '@/lib/auth'
import { audit } from '@/lib/audit'

/**
 * Both staff and the owning customer can cancel — the customer only while the
 * order has not been picked yet (enforced in `cancelOrder`).
 */
export const POST = route<Record<string, unknown>, { id: string }>({
  auth: 'user',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: orderCancelSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof orderCancelSchema>

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, orderNumber: true },
    })
    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found')

    const isStaff = can(session, 'orders.cancel')
    const isOwner = order.userId === session!.id
    if (!isStaff && !isOwner) throw new ApiError(403, 'FORBIDDEN', 'Not allowed')

    try {
      await cancelOrder({
        orderId: params.id,
        actor: session!,
        reason: data.reason,
        byCustomer: !isStaff,
      })
    } catch (error) {
      if (error instanceof OrderError) throw new ApiError(409, error.code, error.code)
      throw error
    }

    await audit({
      actor: session,
      action: isStaff ? 'order.cancel_staff' : 'order.cancel_customer',
      entity: 'Order',
      entityId: params.id,
      summary: `${order.orderNumber}: ${data.reason}`,
      request,
    })

    return ok({ cancelled: true })
  },
})
