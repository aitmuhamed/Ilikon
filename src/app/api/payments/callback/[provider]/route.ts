import { NextResponse } from 'next/server'
import type { PaymentMethod } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { paymentProvider } from '@/lib/payments'
import { notifyCustomer, notifyStaff } from '@/lib/notifications'
import { audit } from '@/lib/audit'
import { clientIp, rateLimit } from '@/lib/rate-limit'

/**
 * Gateway callback.
 *
 * Deliberately *not* trusted: the posted body only tells us which invoice to
 * look at. The provider's `verifyCallback` performs a server-to-server payment
 * lookup, and only that result can mark an order paid.
 */
const PROVIDER_BY_SLUG: Record<string, PaymentMethod> = {
  qpay: 'QPAY',
  card: 'CARD',
  bank_transfer: 'BANK_TRANSFER',
  cash_on_delivery: 'CASH_ON_DELIVERY',
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const limit = rateLimit(`payment-callback:${clientIp(request)}`, { max: 60, windowMs: 60_000 })
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429 })
  }

  const { provider: slug } = await context.params
  const method = PROVIDER_BY_SLUG[slug]
  if (!method) {
    return NextResponse.json({ ok: false, error: 'UNKNOWN_PROVIDER' }, { status: 404 })
  }

  const provider = paymentProvider(method)
  if (!provider.verifyCallback) {
    // Offline methods have no callback surface.
    return NextResponse.json({ ok: false, error: 'NO_CALLBACK' }, { status: 400 })
  }

  const payload = await request.json().catch(() => ({}))
  const signature = request.headers.get('x-signature')

  type Verification = { ok: boolean; providerRef?: string; paid: boolean }
  const verification: Verification = await provider
    .verifyCallback(payload, signature)
    .catch((error): Verification => {
      console.error('[payments] callback verification failed', error)
      return { ok: false, paid: false }
    })

  if (!verification.ok) {
    await audit({
      action: 'payment.callback_rejected',
      entity: 'Payment',
      summary: `${slug} callback failed verification`,
      changes: { payload: payload as Record<string, unknown> },
      request,
    })
    return NextResponse.json({ ok: false, error: 'VERIFICATION_FAILED' }, { status: 400 })
  }

  const payment = verification.providerRef
    ? await prisma.payment.findFirst({
        where: { providerRef: verification.providerRef, method },
        include: { order: { select: { id: true, orderNumber: true, userId: true, status: true } } },
      })
    : null

  if (!payment) {
    return NextResponse.json({ ok: false, error: 'PAYMENT_NOT_FOUND' }, { status: 404 })
  }

  if (verification.paid && payment.status !== 'PAID') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paidAt: new Date() },
    })
    await prisma.orderEvent.create({
      data: {
        orderId: payment.orderId,
        title: 'Төлбөр хүлээн авлаа',
        message: `${method} — ${verification.providerRef}`,
        isSystem: true,
      },
    })

    if (payment.order.userId) {
      await notifyCustomer({
        userId: payment.order.userId,
        type: 'ORDER_CONFIRMED',
        title: 'Төлбөр хүлээн авлаа',
        body: `${payment.order.orderNumber} захиалгын төлбөр баталгаажлаа.`,
        linkUrl: `/account/orders/${payment.orderId}`,
      })
    }
    await notifyStaff({
      type: 'SYSTEM',
      title: 'Төлбөр хүлээн авлаа',
      body: `${payment.order.orderNumber} — ${method}`,
      linkUrl: `/admin/orders/${payment.orderId}`,
    })

    await audit({
      action: 'payment.callback_paid',
      entity: 'Payment',
      entityId: payment.id,
      summary: `${payment.order.orderNumber} paid via ${method}`,
      request,
    })
  }

  return NextResponse.json({ ok: true })
}

/** Some gateways probe the callback URL with GET before enabling it. */
export async function GET() {
  return NextResponse.json({ ok: true, ready: true })
}
