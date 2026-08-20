import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { paymentStatusSchema } from '@/lib/validation'
import { notifyCustomer } from '@/lib/notifications'
import { audit } from '@/lib/audit'

/**
 * Manual payment reconciliation — used when a bank transfer lands or a card
 * charge is confirmed out-of-band. The customer is notified either way.
 */
export const PATCH = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'payments.manage' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: paymentStatusSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof paymentStatusSchema>

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      include: { order: { select: { id: true, orderNumber: true, userId: true } } },
    })
    if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Payment not found')

    const updated = await prisma.payment.update({
      where: { id: params.id },
      data: {
        status: data.status,
        providerRef: data.providerRef ?? payment.providerRef,
        failureReason: data.failureReason ?? null,
        paidAt: data.status === 'PAID' ? (payment.paidAt ?? new Date()) : payment.paidAt,
      },
    })

    await prisma.orderEvent.create({
      data: {
        orderId: payment.orderId,
        title: `Төлбөрийн төлөв: ${data.status}`,
        message: data.failureReason ?? data.providerRef ?? null,
        actorId: session!.id,
      },
    })

    if (payment.order.userId) {
      if (data.status === 'PAID') {
        await notifyCustomer({
          userId: payment.order.userId,
          type: 'ORDER_CONFIRMED',
          title: 'Төлбөр хүлээн авлаа',
          body: `${payment.order.orderNumber} захиалгын төлбөр баталгаажлаа.`,
          linkUrl: `/account/orders/${payment.orderId}`,
        })
      } else if (data.status === 'FAILED') {
        await notifyCustomer({
          userId: payment.order.userId,
          type: 'PAYMENT_ISSUE',
          title: 'Төлбөрийн асуудал',
          body: `${payment.order.orderNumber}: ${data.failureReason ?? 'Төлбөр амжилтгүй болсон'}`,
          linkUrl: `/account/orders/${payment.orderId}`,
        })
      }
    }

    await audit({
      actor: session,
      action: 'payment.status_update',
      entity: 'Payment',
      entityId: params.id,
      summary: `${payment.order.orderNumber}: ${payment.status} → ${data.status}`,
      request,
    })

    return ok({ status: updated.status })
  },
})
