import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { deliveryUpdateSchema } from '@/lib/validation'
import { can } from '@/lib/auth'
import { notifyCustomer } from '@/lib/notifications'
import { audit } from '@/lib/audit'

/**
 * Delivery assignment and status.
 *
 * `delivery.manage` can assign couriers and update any delivery; a courier with
 * only `delivery.own` can update the deliveries assigned to them and nothing
 * else.
 */
export const PATCH = route<Record<string, unknown>, { id: string }>({
  auth: 'staff',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: deliveryUpdateSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof deliveryUpdateSchema>

    const delivery = await prisma.delivery.findUnique({
      where: { id: params.id },
      include: { order: { select: { id: true, orderNumber: true, userId: true, status: true } } },
    })
    if (!delivery) throw new ApiError(404, 'NOT_FOUND', 'Delivery not found')

    const canManage = can(session, 'delivery.manage')
    const isAssignedCourier = delivery.courierId === session!.id && can(session, 'delivery.own')

    if (!canManage && !isAssignedCourier) {
      throw new ApiError(403, 'FORBIDDEN', 'Not allowed to update this delivery')
    }
    // A courier may move status but never reassign the job.
    if (!canManage && data.courierId !== undefined) {
      throw new ApiError(403, 'FORBIDDEN', 'Only a delivery manager can assign a courier')
    }

    const updated = await prisma.delivery.update({
      where: { id: params.id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(canManage && data.courierId !== undefined ? { courierId: data.courierId } : {}),
        ...(data.trackingNote !== undefined ? { trackingNote: data.trackingNote ?? null } : {}),
        ...(data.scheduledFor !== undefined
          ? { scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null }
          : {}),
        ...(data.status === 'IN_TRANSIT' ? { dispatchedAt: new Date() } : {}),
        ...(data.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    })

    // Keep the order in step with the delivery so both views agree.
    if (data.status === 'IN_TRANSIT' && delivery.order.status === 'PREPARING') {
      await prisma.order.update({ where: { id: delivery.orderId }, data: { status: 'SHIPPED' } })
      await prisma.orderEvent.create({
        data: {
          orderId: delivery.orderId,
          status: 'SHIPPED',
          title: 'Захиалга хүргэлтэнд гарлаа',
          actorId: session!.id,
        },
      })
      if (delivery.order.userId) {
        await notifyCustomer({
          userId: delivery.order.userId,
          type: 'ORDER_SHIPPED',
          title: 'Захиалга хүргэлтэнд гарлаа',
          body: `${delivery.order.orderNumber} хүргэлтэнд гарлаа.`,
          linkUrl: `/account/orders/${delivery.orderId}`,
        })
      }
    }

    if (data.status === 'DELIVERED' && delivery.order.status !== 'DELIVERED') {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      })
      await prisma.payment.updateMany({
        where: {
          orderId: delivery.orderId,
          method: 'CASH_ON_DELIVERY',
          status: { in: ['PENDING', 'AWAITING_CONFIRMATION'] },
        },
        data: { status: 'PAID', paidAt: new Date() },
      })
      await prisma.orderEvent.create({
        data: {
          orderId: delivery.orderId,
          status: 'DELIVERED',
          title: 'Захиалга хүргэгдлээ',
          actorId: session!.id,
        },
      })
      if (delivery.order.userId) {
        await notifyCustomer({
          userId: delivery.order.userId,
          type: 'ORDER_DELIVERED',
          title: 'Захиалга хүргэгдлээ',
          body: `${delivery.order.orderNumber} хүргэгдлээ. Танд баярлалаа!`,
          linkUrl: `/account/orders/${delivery.orderId}`,
        })
      }
    }

    await audit({
      actor: session,
      action: 'delivery.update',
      entity: 'Delivery',
      entityId: params.id,
      summary: `${delivery.order.orderNumber}: ${delivery.status} → ${updated.status}`,
      request,
    })

    return ok({ delivery: updated })
  },
})
