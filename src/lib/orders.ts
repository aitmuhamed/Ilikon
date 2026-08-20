import 'server-only'

import type { OrderStatus, Prisma } from '@prisma/client'

import { prisma } from './prisma'
import { getSettings } from './settings'
import { evaluateCoupon, redeemCoupon } from './coupons'
import { applyStockMovement, assertSellable, checkLowStock, StockError } from './inventory'
import { notifyCustomer, notifyStaff } from './notifications'
import { paymentProvider } from './payments'
import { publicEnv } from './env'
import { effectivePrice } from './utils'
import type { SessionUser } from './auth'
import type { z } from 'zod'
import type { checkoutSchema } from './validation'

/**
 * Order lifecycle.
 *
 *   checkout → createOrder (stock committed atomically)
 *            → payment intent
 *            → pharmacist verifies prescription when required
 *            → status transitions, each one writing a timeline event
 *              and a customer notification
 *            → cancellation returns stock to inventory
 */

export class OrderError extends Error {
  constructor(
    public readonly code:
      | 'EMPTY_CART'
      | 'INSUFFICIENT_STOCK'
      | 'EXPIRED_PRODUCT'
      | 'PRODUCT_UNAVAILABLE'
      | 'COUPON_INVALID'
      | 'INVALID_TRANSITION'
      | 'PRESCRIPTION_NOT_CLEARED'
      | 'NOT_CANCELLABLE',
    public readonly detail?: unknown,
  ) {
    super(code)
  }
}

// ────────────────────────── order numbering ───────────────────────────────

/**
 * `ILK-YYYYMMDD-NNNN`, sequential per calendar day.
 *
 * Generated inside the order transaction and retried on unique-constraint
 * collision, so two concurrent checkouts can never share a number.
 */
async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const prefix = `ILK-${datePart}-`

  const last = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })

  const lastSeq = last ? Number.parseInt(last.orderNumber.slice(prefix.length), 10) : 0
  return `${prefix}${String((Number.isNaN(lastSeq) ? 0 : lastSeq) + 1).padStart(4, '0')}`
}

async function nextPrescriptionCode(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const prefix = `RX-${datePart}-`
  const last = await tx.prescription.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })
  const lastSeq = last ? Number.parseInt(last.code.slice(prefix.length), 10) : 0
  return `${prefix}${String((Number.isNaN(lastSeq) ? 0 : lastSeq) + 1).padStart(4, '0')}`
}

export { nextPrescriptionCode }

// ──────────────────────────── create order ────────────────────────────────

export interface CreateOrderResult {
  orderId: string
  orderNumber: string
  total: number
  requiresPrescription: boolean
  payment: {
    method: string
    status: string
    redirectUrl?: string
    qrText?: string
    deeplinks?: { name: string; link: string }[]
    instructions?: Record<string, string>
  }
}

export async function createOrder(input: {
  cartId: string
  userId: string | null
  data: z.infer<typeof checkoutSchema>
}): Promise<CreateOrderResult> {
  const settings = await getSettings()
  const { data } = input

  const result = await prisma.$transaction(
    async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: input.cartId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  price: true,
                  discountPrice: true,
                  prescriptionRequired: true,
                  status: true,
                  deletedAt: true,
                  expiryDate: true,
                  images: { where: { isPrimary: true }, select: { fileKey: true }, take: 1 },
                  inventory: { select: { quantity: true } },
                },
              },
            },
          },
        },
      })

      if (!cart || cart.items.length === 0) throw new OrderError('EMPTY_CART')

      // Re-validate everything against live data — the cart may be minutes old.
      await assertSellable(
        tx,
        cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      )

      const lines = cart.items.map((item) => {
        const unitPrice = effectivePrice(item.product.price, item.product.discountPrice)
        return {
          productId: item.product.id,
          sku: item.product.sku,
          name: item.product.name,
          unitPrice,
          discountPerUnit: Math.max(0, item.product.price - unitPrice),
          quantity: item.quantity,
          lineTotal: unitPrice * item.quantity,
          prescriptionRequired: item.product.prescriptionRequired,
          imageKey: item.product.images[0]?.fileKey ?? null,
        }
      })

      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)

      // ── coupon ──────────────────────────────────────────────────────────
      let discountTotal = 0
      let couponId: string | null = null
      let couponCode: string | null = null
      const requestedCode = data.couponCode ?? (cart.couponId ? undefined : undefined)

      const codeToApply =
        requestedCode ??
        (cart.couponId
          ? (await tx.coupon.findUnique({ where: { id: cart.couponId }, select: { code: true } }))?.code
          : undefined)

      if (codeToApply) {
        const evaluation = await evaluateCoupon({
          code: codeToApply,
          subtotal,
          userId: input.userId,
          tx,
        })
        if (!evaluation.ok || !evaluation.coupon) {
          throw new OrderError('COUPON_INVALID', evaluation.reason)
        }
        discountTotal = evaluation.discount
        couponId = evaluation.coupon.id
        couponCode = evaluation.coupon.code
      }

      const afterDiscount = Math.max(0, subtotal - discountTotal)
      const isPickup = data.deliveryMethod === 'PHARMACY_PICKUP'
      const deliveryFee =
        isPickup || afterDiscount >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee
      const taxTotal = settings.taxIncludedInPrice
        ? 0
        : Math.round((afterDiscount * settings.taxRatePct) / 100)
      const total = afterDiscount + deliveryFee + taxTotal

      const requiresPrescription = lines.some((l) => l.prescriptionRequired)
      const orderNumber = await nextOrderNumber(tx)

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: input.userId,
          status: 'NEW',
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail ?? null,
          subtotal,
          discountTotal,
          deliveryFee,
          taxTotal,
          total,
          couponId,
          couponCode,
          requiresPrescription,
          // A prescription order is never cleared at creation time; only a
          // pharmacist's verification can set this.
          prescriptionCleared: false,
          customerNote: data.customerNote ?? null,
          items: { create: lines },
          delivery: {
            create: {
              method: data.deliveryMethod,
              status: 'PENDING',
              recipient: data.customerName,
              phone: data.customerPhone,
              city: isPickup ? null : 'Улаанбаатар',
              district: isPickup ? null : (data.district ?? null),
              khoroo: isPickup ? null : (data.khoroo ?? null),
              addressLine: isPickup ? null : (data.addressLine ?? null),
              instructions: data.instructions ?? null,
              fee: deliveryFee,
            },
          },
          events: {
            create: {
              status: 'NEW',
              title: 'Захиалга үүслээ',
              message: `Захиалгын дугаар ${orderNumber}`,
              isSystem: true,
            },
          },
        },
      })

      // ── commit stock ────────────────────────────────────────────────────
      for (const line of lines) {
        await applyStockMovement(tx, {
          productId: line.productId,
          type: 'SALE',
          quantity: line.quantity,
          reason: 'Захиалга',
          reference: orderNumber,
          performedById: input.userId,
        })
      }

      if (couponId) {
        await redeemCoupon(tx, {
          couponId,
          userId: input.userId,
          orderId: order.id,
          amount: discountTotal,
        })
      }

      // ── save address for reuse ──────────────────────────────────────────
      if (input.userId && data.saveAddress && !isPickup && data.district && data.khoroo && data.addressLine) {
        await tx.address.create({
          data: {
            userId: input.userId,
            recipient: data.customerName,
            phone: data.customerPhone,
            district: data.district,
            khoroo: data.khoroo,
            addressLine: data.addressLine,
            instructions: data.instructions ?? null,
          },
        })
      }

      // Cart is emptied only once everything above has succeeded.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
      await tx.cart.update({ where: { id: cart.id }, data: { couponId: null } })

      return { order, total, requiresPrescription, orderNumber }
    },
    { timeout: 20_000 },
  )

  // ── payment intent (outside the transaction: it calls a remote gateway) ──
  const provider = paymentProvider(data.paymentMethod)
  let intent
  try {
    intent = await provider.createIntent({
      orderId: result.order.id,
      orderNumber: result.orderNumber,
      amount: result.total,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      description: `${result.orderNumber} — Иликон Уужим Эмийн Сан`,
      returnUrl: `${publicEnv.siteUrl}/api/payments/callback/${data.paymentMethod.toLowerCase()}`,
    })
  } catch (error) {
    // The order exists and stock is committed; flag the payment for staff
    // rather than losing the order.
    console.error('[orders] payment intent failed', error)
    intent = {
      initialStatus: 'FAILED' as const,
      providerName: data.paymentMethod.toLowerCase(),
      settledOffline: true,
      instructions: { note: 'PAYMENT_INIT_FAILED' },
    }
    await notifyStaff({
      type: 'PAYMENT_ISSUE',
      title: 'Төлбөрийн холболтын алдаа',
      body: `${result.orderNumber} — төлбөрийн систем хариу өгсөнгүй. Гараар шалгана уу.`,
      linkUrl: `/admin/orders/${result.order.id}`,
    })
  }

  const payment = await prisma.payment.create({
    data: {
      orderId: result.order.id,
      method: data.paymentMethod,
      status: intent.initialStatus,
      amount: result.total,
      providerName: intent.providerName,
      providerRef: intent.providerRef ?? null,
      metadata: (intent.instructions ?? undefined) as never,
    },
  })

  // ── notifications ───────────────────────────────────────────────────────
  await notifyStaff({
    type: 'NEW_ORDER',
    title: 'Шинэ захиалга',
    body: `${result.orderNumber} — ${data.customerName}, ${result.total.toLocaleString('mn-MN')}₮${
      result.requiresPrescription ? ' (жор шаардлагатай)' : ''
    }`,
    linkUrl: `/admin/orders/${result.order.id}`,
  })

  if (result.requiresPrescription) {
    await notifyStaff({
      type: 'NEW_PRESCRIPTION',
      title: 'Жорын баталгаажуулалт шаардлагатай',
      body: `${result.orderNumber} захиалгад жороор олгох эм байна.`,
      linkUrl: `/admin/prescriptions`,
    })
  }

  if (input.userId) {
    await notifyCustomer({
      userId: input.userId,
      type: 'ORDER_CONFIRMED',
      title: 'Захиалга хүлээн авлаа',
      body: `${result.orderNumber} захиалга бүртгэгдлээ. Бид удахгүй холбогдоно.`,
      linkUrl: `/account/orders/${result.order.id}`,
    })
  }

  // Low-stock alerts after the sale is committed.
  for (const item of await prisma.orderItem.findMany({
    where: { orderId: result.order.id },
    select: { productId: true },
  })) {
    if (item.productId) await checkLowStock(item.productId)
  }

  return {
    orderId: result.order.id,
    orderNumber: result.orderNumber,
    total: result.total,
    requiresPrescription: result.requiresPrescription,
    payment: {
      method: payment.method,
      status: payment.status,
      redirectUrl: intent.redirectUrl,
      qrText: intent.qrText,
      deeplinks: intent.deeplinks,
      instructions: intent.instructions,
    },
  }
}

// ──────────────────────── status transitions ──────────────────────────────

/** Allowed forward moves. Anything else is rejected as an invalid transition. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMING', 'PREPARING', 'CANCELLED'],
  CONFIRMING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'DELIVERED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

const STATUS_NOTIFICATION = {
  CONFIRMING: { type: 'ORDER_CONFIRMED', title: 'Захиалга баталгаажиж байна' },
  PREPARING: { type: 'ORDER_PREPARING', title: 'Захиалга бэлтгэгдэж байна' },
  SHIPPED: { type: 'ORDER_SHIPPED', title: 'Захиалга хүргэлтэнд гарлаа' },
  DELIVERED: { type: 'ORDER_DELIVERED', title: 'Захиалга хүргэгдлээ' },
  CANCELLED: { type: 'ORDER_CANCELLED', title: 'Захиалга цуцлагдлаа' },
} as const

export async function updateOrderStatus(input: {
  orderId: string
  status: OrderStatus
  actor: SessionUser
  message?: string
}): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { prescriptions: true },
  })
  if (!order) throw new OrderError('INVALID_TRANSITION')
  if (order.status === input.status) return
  if (!canTransition(order.status, input.status)) throw new OrderError('INVALID_TRANSITION')

  // Safety gate: a prescription order cannot be prepared or shipped until a
  // pharmacist has verified the prescription.
  const advancing = ['PREPARING', 'SHIPPED', 'DELIVERED'].includes(input.status)
  if (advancing && order.requiresPrescription && !order.prescriptionCleared) {
    throw new OrderError('PRESCRIPTION_NOT_CLEARED')
  }

  if (input.status === 'CANCELLED') {
    await cancelOrder({ orderId: input.orderId, actor: input.actor, reason: input.message ?? 'Админ цуцаллаа' })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: input.orderId },
      data: {
        status: input.status,
        confirmedAt: input.status === 'CONFIRMING' ? new Date() : undefined,
        deliveredAt: input.status === 'DELIVERED' ? new Date() : undefined,
      },
    })

    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        status: input.status,
        title: STATUS_NOTIFICATION[input.status as keyof typeof STATUS_NOTIFICATION]?.title ?? 'Төлөв шинэчлэгдлээ',
        message: input.message ?? null,
        actorId: input.actor.id,
      },
    })

    // Delivery record follows the order.
    if (input.status === 'SHIPPED') {
      await tx.delivery.updateMany({
        where: { orderId: input.orderId },
        data: { status: 'IN_TRANSIT', dispatchedAt: new Date() },
      })
    }
    if (input.status === 'DELIVERED') {
      await tx.delivery.updateMany({
        where: { orderId: input.orderId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      })
      // Cash on delivery settles when the customer receives the order.
      await tx.payment.updateMany({
        where: { orderId: input.orderId, method: 'CASH_ON_DELIVERY', status: { in: ['PENDING', 'AWAITING_CONFIRMATION'] } },
        data: { status: 'PAID', paidAt: new Date() },
      })
      // Reviews from this order count as verified purchases.
      await tx.review.updateMany({
        where: { userId: order.userId ?? '', productId: { in: (await tx.orderItem.findMany({ where: { orderId: input.orderId }, select: { productId: true } })).map((i) => i.productId).filter((id): id is string => Boolean(id)) } },
        data: { isVerifiedBuyer: true },
      })
    }
  })

  const notification = STATUS_NOTIFICATION[input.status as keyof typeof STATUS_NOTIFICATION]
  if (order.userId && notification) {
    await notifyCustomer({
      userId: order.userId,
      type: notification.type,
      title: notification.title,
      body: `${order.orderNumber}${input.message ? ` — ${input.message}` : ''}`,
      linkUrl: `/account/orders/${order.id}`,
    })
  }
}

export async function cancelOrder(input: {
  orderId: string
  actor: SessionUser | null
  reason: string
  byCustomer?: boolean
}): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  })
  if (!order) throw new OrderError('INVALID_TRANSITION')
  if (order.status === 'CANCELLED') return
  if (order.status === 'DELIVERED') throw new OrderError('NOT_CANCELLABLE')

  // A customer may only cancel before the pharmacy starts picking the order.
  if (input.byCustomer && !['NEW', 'CONFIRMING'].includes(order.status)) {
    throw new OrderError('NOT_CANCELLABLE')
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        cancelReason: input.reason,
        cancelledAt: new Date(),
      },
    })

    // Return every committed unit to inventory.
    for (const item of order.items) {
      if (!item.productId) continue
      await applyStockMovement(tx, {
        productId: item.productId,
        type: 'RETURN',
        quantity: item.quantity,
        reason: 'Захиалга цуцлагдсан',
        reference: order.orderNumber,
        performedById: input.actor?.id ?? null,
      })
      await tx.product.update({
        where: { id: item.productId },
        data: { soldCount: { decrement: Math.min(item.quantity, 1_000_000) } },
      })
    }

    // Release the coupon redemption so the customer is not penalised.
    const redemption = await tx.couponRedemption.findUnique({ where: { orderId: order.id } })
    if (redemption) {
      await tx.coupon.update({
        where: { id: redemption.couponId },
        data: { usedCount: { decrement: 1 } },
      })
      await tx.couponRedemption.delete({ where: { id: redemption.id } })
    }

    await tx.payment.updateMany({
      where: { orderId: order.id, status: { in: ['PENDING', 'AWAITING_CONFIRMATION'] } },
      data: { status: 'CANCELLED' },
    })
    await tx.delivery.updateMany({ where: { orderId: order.id }, data: { status: 'RETURNED' } })

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: 'CANCELLED',
        title: 'Захиалга цуцлагдлаа',
        message: input.reason,
        actorId: input.actor?.id ?? null,
        isSystem: !input.actor,
      },
    })
  })

  if (order.userId) {
    await notifyCustomer({
      userId: order.userId,
      type: 'ORDER_CANCELLED',
      title: 'Захиалга цуцлагдлаа',
      body: `${order.orderNumber} — ${input.reason}`,
      linkUrl: `/account/orders/${order.id}`,
    })
  }
  if (input.byCustomer) {
    await notifyStaff({
      type: 'SYSTEM',
      title: 'Харилцагч захиалга цуцаллаа',
      body: `${order.orderNumber} — ${input.reason}`,
      linkUrl: `/admin/orders/${order.id}`,
    })
  }
}

/**
 * Called after a pharmacist verifies (or rejects) a prescription attached to an
 * order. Clearing the gate lets fulfilment continue.
 */
export async function setPrescriptionCleared(
  orderId: string,
  cleared: boolean,
  actor: SessionUser,
  note?: string,
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { prescriptionCleared: cleared },
  })
  await prisma.orderEvent.create({
    data: {
      orderId,
      title: cleared ? 'Жор баталгаажлаа' : 'Жорын баталгаажуулалт хүчингүй болов',
      message: note ?? null,
      actorId: actor.id,
    },
  })
}

// ──────────────────────────── read helpers ────────────────────────────────

export const ORDER_DETAIL_INCLUDE = {
  items: { include: { product: { select: { slug: true, id: true } } } },
  payment: true,
  delivery: { include: { courier: { select: { id: true, fullName: true, phone: true } } } },
  events: { include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: 'asc' as const } },
  notes: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' as const } },
  prescriptions: {
    include: {
      reviews: { include: { reviewer: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' as const } },
    },
  },
  user: { select: { id: true, fullName: true, phone: true, email: true } },
  coupon: { select: { code: true, discountType: true, discountValue: true } },
} satisfies Prisma.OrderInclude

export async function getOrderForCustomer(orderId: string, userId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    include: ORDER_DETAIL_INCLUDE,
  })
}

export async function getOrderForStaff(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE })
}

/** Rebuilds a cart from a previous order, skipping anything no longer sellable. */
export async function reorder(
  orderId: string,
  userId: string,
): Promise<{ added: number; skipped: string[] }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  })
  if (!order) return { added: 0, skipped: [] }

  const { addToCart } = await import('./cart')
  let added = 0
  const skipped: string[] = []

  for (const item of order.items) {
    if (!item.productId) {
      skipped.push(item.name)
      continue
    }
    try {
      await addToCart(userId, item.productId, item.quantity)
      added += 1
    } catch {
      skipped.push(item.name)
    }
  }
  return { added, skipped }
}

export { StockError }
