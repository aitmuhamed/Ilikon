import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma, PrismaClient } from '@prisma/client'

/**
 * Order history, prescriptions, reviews and notifications.
 *
 * Orders are written with their stock movements, payment, delivery and timeline
 * so the admin dashboard, the customer account and the inventory ledger all
 * agree with each other — the same invariants the live checkout maintains.
 */

interface Ctx {
  prisma: PrismaClient
  daysAgo: (days: number) => Date
}

interface OrderPlan {
  daysAgo: number
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  delivery: 'PHARMACY_PICKUP' | 'HOME_DELIVERY'
  customerIndex: number
  lines: { sku: string; quantity: number }[]
  couponCode?: string
  note?: string
  cancelReason?: string
  withPrescription?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CLARIFICATION_REQUESTED'
}

const ORDER_PLANS: OrderPlan[] = [
  { daysAgo: 41, status: 'DELIVERED', paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PAID', delivery: 'HOME_DELIVERY', customerIndex: 0, lines: [{ sku: 'ILK-PAR-500', quantity: 2 }, { sku: 'ILK-VITC-1000', quantity: 1 }] },
  { daysAgo: 37, status: 'DELIVERED', paymentMethod: 'QPAY', paymentStatus: 'PAID', delivery: 'PHARMACY_PICKUP', customerIndex: 1, lines: [{ sku: 'ILK-IBU-400', quantity: 1 }, { sku: 'ILK-THROAT-LOZ', quantity: 2 }] },
  { daysAgo: 33, status: 'DELIVERED', paymentMethod: 'CARD', paymentStatus: 'PAID', delivery: 'HOME_DELIVERY', customerIndex: 2, lines: [{ sku: 'ILK-BIODER-H2O', quantity: 1 }, { sku: 'ILK-CERAVE-MB', quantity: 1 }], couponCode: 'ILIKON10' },
  { daysAgo: 29, status: 'DELIVERED', paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PAID', delivery: 'HOME_DELIVERY', customerIndex: 3, lines: [{ sku: 'ILK-AMO-500', quantity: 1 }], withPrescription: 'VERIFIED' },
  { daysAgo: 25, status: 'CANCELLED', paymentMethod: 'BANK_TRANSFER', paymentStatus: 'CANCELLED', delivery: 'HOME_DELIVERY', customerIndex: 1, lines: [{ sku: 'ILK-OMRON-M3', quantity: 1 }], cancelReason: 'Харилцагч утсаар цуцлах хүсэлт гаргасан' },
  { daysAgo: 22, status: 'DELIVERED', paymentMethod: 'QPAY', paymentStatus: 'PAID', delivery: 'PHARMACY_PICKUP', customerIndex: 4, lines: [{ sku: 'ILK-BABY-PARA', quantity: 1 }, { sku: 'ILK-BABY-CREAM', quantity: 1 }, { sku: 'ILK-ORS-SACH', quantity: 2 }] },
  { daysAgo: 18, status: 'DELIVERED', paymentMethod: 'CARD', paymentStatus: 'PAID', delivery: 'HOME_DELIVERY', customerIndex: 0, lines: [{ sku: 'ILK-VITD-2000', quantity: 1 }, { sku: 'ILK-OMEGA3', quantity: 1 }], couponCode: 'VITAMIN15' },
  { daysAgo: 14, status: 'DELIVERED', paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PAID', delivery: 'HOME_DELIVERY', customerIndex: 5, lines: [{ sku: 'ILK-HAND-SAN', quantity: 2 }, { sku: 'ILK-MASK-50', quantity: 1 }] },
  { daysAgo: 11, status: 'DELIVERED', paymentMethod: 'QPAY', paymentStatus: 'PAID', delivery: 'PHARMACY_PICKUP', customerIndex: 2, lines: [{ sku: 'ILK-METF-850', quantity: 2 }], withPrescription: 'VERIFIED' },
  { daysAgo: 8, status: 'DELIVERED', paymentMethod: 'CARD', paymentStatus: 'PAID', delivery: 'HOME_DELIVERY', customerIndex: 6, lines: [{ sku: 'ILK-THERM-FT', quantity: 1 }, { sku: 'ILK-NASAL-SPR', quantity: 1 }] },
  { daysAgo: 6, status: 'SHIPPED', paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PENDING', delivery: 'HOME_DELIVERY', customerIndex: 4, lines: [{ sku: 'ILK-MULTI-50', quantity: 1 }, { sku: 'ILK-ZINC-25', quantity: 1 }], note: 'Ажлын байранд 18:00-аас хойш хүргэнэ үү' },
  { daysAgo: 4, status: 'PREPARING', paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PAID', delivery: 'HOME_DELIVERY', customerIndex: 3, lines: [{ sku: 'ILK-PROBIO', quantity: 1 }, { sku: 'ILK-SMECT', quantity: 1 }] },
  { daysAgo: 3, status: 'PREPARING', paymentMethod: 'QPAY', paymentStatus: 'PAID', delivery: 'PHARMACY_PICKUP', customerIndex: 0, lines: [{ sku: 'ILK-SPF50', quantity: 1 }, { sku: 'ILK-NIVEA-SOFT', quantity: 2 }] },
  { daysAgo: 2, status: 'CONFIRMING', paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PENDING', delivery: 'HOME_DELIVERY', customerIndex: 5, lines: [{ sku: 'ILK-SALB-INH', quantity: 1 }], withPrescription: 'PENDING', note: 'Жороо хуулж илгээсэн' },
  { daysAgo: 1, status: 'CONFIRMING', paymentMethod: 'CARD', paymentStatus: 'AWAITING_CONFIRMATION', delivery: 'HOME_DELIVERY', customerIndex: 6, lines: [{ sku: 'ILK-CETI-10', quantity: 2 }, { sku: 'ILK-LOR-10', quantity: 1 }] },
  { daysAgo: 1, status: 'NEW', paymentMethod: 'QPAY', paymentStatus: 'PENDING', delivery: 'PHARMACY_PICKUP', customerIndex: 1, lines: [{ sku: 'ILK-OMEP-20', quantity: 1 }], withPrescription: 'CLARIFICATION_REQUESTED' },
  { daysAgo: 0, status: 'NEW', paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PENDING', delivery: 'HOME_DELIVERY', customerIndex: 2, lines: [{ sku: 'ILK-COLD-SYR', quantity: 2 }, { sku: 'ILK-THROAT-LOZ', quantity: 1 }, { sku: 'ILK-PAR-500', quantity: 1 }] },
  { daysAgo: 0, status: 'NEW', paymentMethod: 'BANK_TRANSFER', paymentStatus: 'AWAITING_CONFIRMATION', delivery: 'HOME_DELIVERY', customerIndex: 4, lines: [{ sku: 'ILK-ASP-100', quantity: 1 }], withPrescription: 'PENDING' },
  { daysAgo: 0, status: 'NEW', paymentMethod: 'QPAY', paymentStatus: 'PENDING', delivery: 'PHARMACY_PICKUP', customerIndex: 3, lines: [{ sku: 'ILK-GLUCO-MTR', quantity: 1 }, { sku: 'ILK-MAGB6', quantity: 1 }] },
  { daysAgo: 0, status: 'NEW', paymentMethod: 'CARD', paymentStatus: 'PENDING', delivery: 'HOME_DELIVERY', customerIndex: 5, lines: [{ sku: 'ILK-CHICCO-BTL', quantity: 1 }, { sku: 'ILK-PRENATAL', quantity: 1 }] },
]

const DISTRICTS = ['Сүхбаатар', 'Баянзүрх', 'Хан-Уул', 'Чингэлтэй', 'Баянгол', 'Сонгинохайрхан']

const STATUS_TIMELINE: Record<string, { title: string; status: OrderStatus }[]> = {
  NEW: [{ title: 'Захиалга үүслээ', status: 'NEW' }],
  CONFIRMING: [
    { title: 'Захиалга үүслээ', status: 'NEW' },
    { title: 'Баталгаажуулж байна', status: 'CONFIRMING' },
  ],
  PREPARING: [
    { title: 'Захиалга үүслээ', status: 'NEW' },
    { title: 'Баталгаажуулж байна', status: 'CONFIRMING' },
    { title: 'Бэлтгэж байна', status: 'PREPARING' },
  ],
  SHIPPED: [
    { title: 'Захиалга үүслээ', status: 'NEW' },
    { title: 'Баталгаажуулж байна', status: 'CONFIRMING' },
    { title: 'Бэлтгэж байна', status: 'PREPARING' },
    { title: 'Хүргэлтэнд гарлаа', status: 'SHIPPED' },
  ],
  DELIVERED: [
    { title: 'Захиалга үүслээ', status: 'NEW' },
    { title: 'Баталгаажуулж байна', status: 'CONFIRMING' },
    { title: 'Бэлтгэж байна', status: 'PREPARING' },
    { title: 'Хүргэлтэнд гарлаа', status: 'SHIPPED' },
    { title: 'Хүлээн авсан', status: 'DELIVERED' },
  ],
  CANCELLED: [
    { title: 'Захиалга үүслээ', status: 'NEW' },
    { title: 'Захиалга цуцлагдлаа', status: 'CANCELLED' },
  ],
}

export async function seedOrders(ctx: Ctx) {
  const { prisma, daysAgo } = ctx

  const existing = await prisma.order.count()
  if (existing > 0) {
    console.log(`  • orders already present (${existing}) — skipping`)
    return
  }

  const customers = await prisma.user.findMany({
    where: { isStaff: false },
    orderBy: { createdAt: 'asc' },
  })
  const staff = await prisma.user.findMany({
    where: { isStaff: true },
    include: { role: { select: { key: true } } },
  })
  const pharmacist = staff.find((s) => s.role?.key === 'pharmacist')!
  const orderManager = staff.find((s) => s.role?.key === 'order_manager')!
  const courier = staff.find((s) => s.role?.key === 'delivery_staff')!

  const products = await prisma.product.findMany({
    include: { images: { where: { isPrimary: true }, take: 1 }, inventory: true },
  })
  const bySku = new Map(products.map((p) => [p.sku, p]))
  const settings = { deliveryFee: 5000, freeDeliveryThreshold: 80_000 }

  const counters = new Map<string, number>()
  let prescriptionSeq = 0

  for (const plan of ORDER_PLANS) {
    const createdAt = daysAgo(plan.daysAgo)
    const datePart = [
      createdAt.getFullYear(),
      String(createdAt.getMonth() + 1).padStart(2, '0'),
      String(createdAt.getDate()).padStart(2, '0'),
    ].join('')
    const next = (counters.get(datePart) ?? 0) + 1
    counters.set(datePart, next)
    const orderNumber = `ILK-${datePart}-${String(next).padStart(4, '0')}`

    const customer = customers[plan.customerIndex % customers.length]!

    const items = plan.lines
      .map((line) => {
        const product = bySku.get(line.sku)
        if (!product) return null
        const unitPrice =
          product.discountPrice && product.discountPrice < product.price
            ? product.discountPrice
            : product.price
        return {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPrice,
          discountPerUnit: Math.max(0, product.price - unitPrice),
          quantity: line.quantity,
          lineTotal: unitPrice * line.quantity,
          prescriptionRequired: product.prescriptionRequired,
          imageKey: product.images[0]?.fileKey ?? null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    if (!items.length) continue

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)

    let discountTotal = 0
    let couponId: string | null = null
    if (plan.couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: plan.couponCode } })
      if (coupon && subtotal >= coupon.minOrderAmount) {
        couponId = coupon.id
        const raw =
          coupon.discountType === 'PERCENTAGE'
            ? Math.floor((subtotal * coupon.discountValue) / 100)
            : coupon.discountValue
        discountTotal = coupon.maxDiscountAmount ? Math.min(raw, coupon.maxDiscountAmount) : raw
      }
    }

    const afterDiscount = Math.max(0, subtotal - discountTotal)
    const isPickup = plan.delivery === 'PHARMACY_PICKUP'
    const deliveryFee =
      isPickup || afterDiscount >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee
    const total = afterDiscount + deliveryFee
    const requiresPrescription = items.some((item) => item.prescriptionRequired)

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: customer.id,
        status: plan.status,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        subtotal,
        discountTotal,
        deliveryFee,
        total,
        couponId,
        couponCode: plan.couponCode ?? null,
        requiresPrescription,
        prescriptionCleared: plan.withPrescription === 'VERIFIED',
        customerNote: plan.note ?? null,
        cancelReason: plan.cancelReason ?? null,
        confirmedAt: plan.status === 'NEW' ? null : createdAt,
        deliveredAt: plan.status === 'DELIVERED' ? daysAgo(Math.max(0, plan.daysAgo - 1)) : null,
        cancelledAt: plan.status === 'CANCELLED' ? daysAgo(Math.max(0, plan.daysAgo - 1)) : null,
        createdAt,
        items: { create: items },
        payment: {
          create: {
            method: plan.paymentMethod,
            status: plan.paymentStatus,
            amount: total,
            providerName: plan.paymentMethod.toLowerCase(),
            providerRef: plan.paymentStatus === 'PAID' ? `DEMO-${orderNumber}` : null,
            paidAt: plan.paymentStatus === 'PAID' ? createdAt : null,
            createdAt,
          },
        },
        delivery: {
          create: {
            method: plan.delivery,
            status:
              plan.status === 'DELIVERED'
                ? 'DELIVERED'
                : plan.status === 'SHIPPED'
                  ? 'IN_TRANSIT'
                  : plan.status === 'CANCELLED'
                    ? 'RETURNED'
                    : 'PENDING',
            recipient: customer.fullName,
            phone: customer.phone,
            city: isPickup ? null : 'Улаанбаатар',
            district: isPickup ? null : DISTRICTS[plan.customerIndex % DISTRICTS.length]!,
            khoroo: isPickup ? null : `${(plan.customerIndex % 12) + 1}-р хороо`,
            addressLine: isPickup ? null : `${12 + plan.customerIndex}-р хороолол, ${plan.customerIndex + 2} байр`,
            fee: deliveryFee,
            courierId: ['SHIPPED', 'DELIVERED'].includes(plan.status) ? courier.id : null,
            dispatchedAt: ['SHIPPED', 'DELIVERED'].includes(plan.status) ? createdAt : null,
            deliveredAt: plan.status === 'DELIVERED' ? daysAgo(Math.max(0, plan.daysAgo - 1)) : null,
            createdAt,
          },
        },
      },
    })

    // Timeline
    const steps = STATUS_TIMELINE[plan.status] ?? STATUS_TIMELINE.NEW!
    for (const [index, step] of steps.entries()) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: step.status,
          title: step.title,
          message: index === 0 ? `Захиалгын дугаар ${orderNumber}` : plan.cancelReason ?? null,
          actorId: index === 0 ? null : orderManager.id,
          isSystem: index === 0,
          createdAt: new Date(createdAt.getTime() + index * 45 * 60_000),
        },
      })
    }

    // Stock ledger: sold, and returned again when the order was cancelled.
    for (const item of items) {
      if (!item.productId) continue
      const inventory = await prisma.inventory.findUnique({ where: { productId: item.productId } })
      if (!inventory) continue

      if (plan.status !== 'CANCELLED') {
        const balance = Math.max(0, inventory.quantity - item.quantity)
        await prisma.inventory.update({
          where: { productId: item.productId },
          data: { quantity: balance },
        })
        await prisma.inventoryTransaction.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantityDelta: -item.quantity,
            balanceAfter: balance,
            reason: 'Захиалга',
            reference: orderNumber,
            createdAt,
          },
        })
      } else {
        await prisma.inventoryTransaction.create({
          data: {
            productId: item.productId,
            type: 'RETURN',
            quantityDelta: 0,
            balanceAfter: inventory.quantity,
            reason: 'Захиалга цуцлагдсан — нөөц буцаагдсан',
            reference: orderNumber,
            createdAt,
          },
        })
      }
    }

    if (couponId) {
      await prisma.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } })
      await prisma.couponRedemption.create({
        data: { couponId, userId: customer.id, orderId: order.id, amount: discountTotal, createdAt },
      })
    }

    // Internal note on a couple of orders so the admin view has content.
    if (plan.note) {
      await prisma.orderNote.create({
        data: {
          orderId: order.id,
          authorId: orderManager.id,
          body: `Харилцагчтай утсаар холбогдож баталгаажуулсан. ${plan.note}`,
          createdAt,
        },
      })
    }

    // Prescription with its review trail.
    if (plan.withPrescription) {
      prescriptionSeq += 1
      const code = `RX-${datePart}-${String(prescriptionSeq).padStart(4, '0')}`
      const prescription = await prisma.prescription.create({
        data: {
          code,
          userId: customer.id,
          orderId: order.id,
          // Demo placeholder: the real flow writes an uploaded object key here.
          fileKey: 'prescriptions/demo/seed-placeholder.png',
          fileName: `${code}.png`,
          mimeType: 'image/png',
          sizeBytes: 184_320,
          status: plan.withPrescription,
          patientName: customer.fullName,
          doctorName: 'Э. Батзориг',
          clinic: 'Улсын 1-р клиникийн эмнэлэг',
          issuedAt: daysAgo(plan.daysAgo + 2),
          expiresAt: daysAgo(plan.daysAgo - 28),
          customerNote: 'Эмчийн бичсэн жорыг хуулж илгээв.',
          createdAt,
        },
      })

      if (plan.withPrescription !== 'PENDING') {
        const action =
          plan.withPrescription === 'VERIFIED'
            ? 'APPROVE'
            : plan.withPrescription === 'REJECTED'
              ? 'REJECT'
              : 'REQUEST_CLARIFICATION'
        await prisma.prescriptionReview.create({
          data: {
            prescriptionId: prescription.id,
            reviewerId: pharmacist.id,
            action,
            resultStatus: plan.withPrescription,
            reason:
              action === 'APPROVE'
                ? null
                : action === 'REJECT'
                  ? 'Жорын хугацаа дууссан байна'
                  : 'Жорын тун, давтамж бүдэг харагдаж байна. Тодорхой зураг дахин илгээнэ үү.',
            pharmacistNote:
              action === 'APPROVE'
                ? 'Жор бүрэн, эмчийн тамга, тун тодорхой. Олгохыг зөвшөөрөв.'
                : 'Харилцагчтай холбогдож тодруулга хүссэн.',
            createdAt: new Date(createdAt.getTime() + 3 * 3_600_000),
          },
        })
      }
    }
  }

  console.log(`  ✓ ${ORDER_PLANS.length} orders with payments, deliveries, timelines and stock ledger`)
}

// ═══════════════════════════════ reviews ══════════════════════════════════

const REVIEW_TEXTS: { rating: number; title: string; comment: string }[] = [
  { rating: 5, title: 'Хурдан хүргэлт', comment: 'Захиалснаас хойш 2 цагийн дотор хүргэж өглөө. Савлагаа бүтэн, хугацаа хол байсан.' },
  { rating: 5, title: 'Фармацевт тайлбарлаж өгсөн', comment: 'Хэрэглэх зааврыг утсаар дэлгэрэнгүй тайлбарлаж өгсөнд баярлалаа.' },
  { rating: 4, title: 'Сайн', comment: 'Үнэ боломжийн. Хайрцагны заавар монгол хэл дээр байсан нь тохиромжтой.' },
  { rating: 5, title: 'Дахин захиална', comment: 'Хүүхдийн эмийг шпринцтэй нь авсан, тун хэмжихэд ойлгомжтой.' },
  { rating: 4, title: 'Хугацаа хол', comment: 'Хүчинтэй хугацаа 2 жил гаруй байсан. Сайтаас харсан мэдээлэл тохирсон.' },
  { rating: 5, title: 'Санал болгож байна', comment: 'Эмийн сан дээр өөрөө авлаа, хүлээлгүй, ажилтнууд эелдэг.' },
  { rating: 3, title: 'Боломжийн', comment: 'Бүтээгдэхүүн сайн, гэхдээ хүргэлт бага зэрэг хоцорсон.' },
  { rating: 5, title: 'Найдвартай', comment: 'Бүртгэлийн дугаар, үйлдвэрлэгчийн мэдээлэл сайтад бүрэн байгаа нь итгэл төрүүлсэн.' },
]

export async function seedReviews(ctx: Ctx) {
  const { prisma, daysAgo } = ctx

  const existing = await prisma.review.count()
  if (existing > 0) {
    console.log(`  • reviews already present (${existing}) — skipping`)
    return
  }

  // Only customers who actually received the product — the same rule the API
  // enforces for live submissions.
  const delivered = await prisma.orderItem.findMany({
    where: { order: { status: 'DELIVERED' }, productId: { not: null } },
    include: { order: { select: { userId: true, createdAt: true } } },
  })

  const seen = new Set<string>()
  let created = 0

  for (const [index, item] of delivered.entries()) {
    if (!item.productId || !item.order.userId) continue
    const key = `${item.productId}:${item.order.userId}`
    if (seen.has(key)) continue
    seen.add(key)

    const template = REVIEW_TEXTS[index % REVIEW_TEXTS.length]!
    // Leave a couple pending so the moderation queue is not empty.
    const status = index % 7 === 3 ? 'PENDING' : 'APPROVED'

    await prisma.review.create({
      data: {
        productId: item.productId,
        userId: item.order.userId,
        rating: template.rating,
        title: template.title,
        comment: template.comment,
        status,
        isVerifiedBuyer: true,
        moderatedAt: status === 'APPROVED' ? daysAgo(2) : null,
        createdAt: daysAgo(3 + (index % 20)),
      },
    })
    created += 1
  }

  // Rating aggregates, recomputed from approved reviews only.
  const grouped = await prisma.review.groupBy({
    by: ['productId'],
    where: { status: 'APPROVED', deletedAt: null },
    _avg: { rating: true },
    _count: { _all: true },
  })
  for (const group of grouped) {
    await prisma.product.update({
      where: { id: group.productId },
      data: {
        ratingAvg: Number((group._avg.rating ?? 0).toFixed(2)),
        ratingCount: group._count._all,
      },
    })
  }

  console.log(`  ✓ ${created} reviews (${grouped.length} products rated)`)
}

// ═════════════════════════ notifications & analytics ══════════════════════

export async function seedNotifications(ctx: Ctx) {
  const { prisma, daysAgo } = ctx

  const existing = await prisma.notification.count()
  if (existing > 0) {
    console.log(`  • notifications already present (${existing}) — skipping`)
    return
  }

  const customers = await prisma.user.findMany({ where: { isStaff: false }, take: 4 })
  const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 6 })

  const rows: Prisma.NotificationCreateManyInput[] = []

  for (const [index, order] of orders.entries()) {
    if (!order.userId) continue
    rows.push({
      userId: order.userId,
      audience: 'CUSTOMER',
      type:
        order.status === 'DELIVERED'
          ? 'ORDER_DELIVERED'
          : order.status === 'SHIPPED'
            ? 'ORDER_SHIPPED'
            : order.status === 'CANCELLED'
              ? 'ORDER_CANCELLED'
              : 'ORDER_CONFIRMED',
      title:
        order.status === 'DELIVERED'
          ? 'Захиалга хүргэгдлээ'
          : order.status === 'SHIPPED'
            ? 'Захиалга хүргэлтэнд гарлаа'
            : order.status === 'CANCELLED'
              ? 'Захиалга цуцлагдлаа'
              : 'Захиалга хүлээн авлаа',
      body: `${order.orderNumber} захиалгын төлөв шинэчлэгдлээ.`,
      linkUrl: `/account/orders/${order.id}`,
      readAt: index > 2 ? daysAgo(1) : null,
      createdAt: order.createdAt,
    })
  }

  for (const customer of customers.filter((c) => c.marketingOptIn).slice(0, 2)) {
    rows.push({
      userId: customer.id,
      audience: 'CUSTOMER',
      type: 'PROMOTION',
      title: 'Витамин, био нэмэлтэд 15% хямдрал',
      body: 'VITAMIN15 кодыг сагсандаа хэрэглээд 15% хямдрал аваарай. Урамшуулал 2 сарын дараа дуусна.',
      linkUrl: '/mn/categories/vitamin',
      createdAt: daysAgo(5),
    })
  }

  // Staff notifications (broadcast rows, userId = null).
  rows.push(
    {
      audience: 'STAFF',
      type: 'NEW_PRESCRIPTION',
      title: 'Шинэ жор шалгуулахаар ирлээ',
      body: 'Шалгах дараалалд 3 жор байна.',
      linkUrl: '/admin/prescriptions',
      createdAt: daysAgo(1),
    },
    {
      audience: 'STAFF',
      type: 'LOW_STOCK',
      title: 'Нөөц багассан',
      body: 'Omron M3 Comfort даралт хэмжигч — үлдэгдэл доод хязгаарт хүрсэн.',
      linkUrl: '/admin/inventory?filter=low',
      createdAt: daysAgo(2),
    },
    {
      audience: 'STAFF',
      type: 'EXPIRING_PRODUCT',
      title: 'Хугацаа дуусах дөхсөн',
      body: 'Ханиадны сироп 100 мл — 34 хоногийн дараа хугацаа дуусна.',
      linkUrl: '/admin/inventory?filter=expiring',
      createdAt: daysAgo(3),
    },
  )

  await prisma.notification.createMany({ data: rows })
  console.log(`  ✓ ${rows.length} notifications`)
}

export async function seedAnalytics(ctx: Ctx) {
  const { prisma, daysAgo } = ctx

  const existing = await prisma.analyticsEvent.count()
  if (existing > 0) {
    console.log(`  • analytics already present (${existing}) — skipping`)
    return
  }

  const products = await prisma.product.findMany({ select: { id: true }, take: 20 })
  const rows: Prisma.AnalyticsEventCreateManyInput[] = []
  const searchTerms = ['парацетамол', 'витамин c', 'даралт хэмжигч', 'ханиад', 'хүүхдийн эм', 'амоксициллин', 'омега 3']

  // A plausible funnel over the last 30 days: views > carts > checkouts.
  for (let day = 29; day >= 0; day -= 1) {
    const createdAt = daysAgo(day)
    const views = 40 + ((day * 7) % 35)
    for (let i = 0; i < views; i += 1) {
      rows.push({
        name: 'product_viewed',
        productId: products[(day + i) % products.length]!.id,
        sessionId: `seed-${day}-${i % 12}`,
        createdAt,
      })
    }
    for (let i = 0; i < Math.round(views * 0.22); i += 1) {
      rows.push({
        name: 'add_to_cart',
        productId: products[(day + i) % products.length]!.id,
        sessionId: `seed-${day}-${i % 12}`,
        createdAt,
      })
    }
    for (let i = 0; i < Math.round(views * 0.09); i += 1) {
      rows.push({ name: 'checkout_started', sessionId: `seed-${day}-${i % 12}`, createdAt })
    }
    for (let i = 0; i < Math.round(views * 0.15); i += 1) {
      rows.push({
        name: 'search_performed',
        sessionId: `seed-${day}-${i % 12}`,
        metadata: { term: searchTerms[(day + i) % searchTerms.length]! },
        createdAt,
      })
    }
  }

  // createMany in chunks — a single 4k-row statement is needlessly large.
  for (let offset = 0; offset < rows.length; offset += 1000) {
    await prisma.analyticsEvent.createMany({ data: rows.slice(offset, offset + 1000) })
  }

  console.log(`  ✓ ${rows.length} analytics events (30-day funnel)`)
}

export async function seedChatbot(ctx: Ctx) {
  const { prisma, daysAgo } = ctx

  const existing = await prisma.chatbotConversation.count()
  if (existing > 0) {
    console.log(`  • chatbot conversations already present — skipping`)
    return
  }

  const customer = await prisma.user.findFirst({ where: { isStaff: false } })
  const vitaminC = await prisma.product.findUnique({ where: { sku: 'ILK-VITC-1000' } })

  const conversation = await prisma.chatbotConversation.create({
    data: {
      sessionId: 'seed-conversation-1',
      userId: customer?.id ?? null,
      locale: 'mn',
      title: 'Витамин C байна уу?',
      createdAt: daysAgo(2),
    },
  })

  await prisma.chatbotMessage.createMany({
    data: [
      {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content:
          'Сайн байна уу! Би Иликон, Уужим Эмийн Сангийн виртуал туслах. Танд эм, бүтээгдэхүүн хайх эсвэл захиалга хийхэд тусалъя.',
        intent: 'greeting',
        createdAt: daysAgo(2),
      },
      {
        conversationId: conversation.id,
        role: 'USER',
        content: 'Витамин C байна уу?',
        createdAt: daysAgo(2),
      },
      {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: '«витамин C» хайлтаар 1 бүтээгдэхүүн олдлоо:',
        intent: 'product_search',
        attachments: vitaminC
          ? {
              products: [
                {
                  id: vitaminC.id,
                  slug: vitaminC.slug,
                  name: vitaminC.name,
                  price: vitaminC.price,
                  discountPrice: vitaminC.discountPrice,
                  imageUrl: '/media/vitamin.svg',
                  prescriptionRequired: false,
                  inStock: true,
                  stock: 118,
                },
              ],
            }
          : undefined,
        createdAt: daysAgo(2),
      },
    ],
  })

  // A second conversation showing the safety redirect being exercised.
  const escalated = await prisma.chatbotConversation.create({
    data: {
      sessionId: 'seed-conversation-2',
      locale: 'mn',
      title: 'Толгой өвдөж байна, ямар эм уувал зохих вэ?',
      escalatedAt: daysAgo(1),
      createdAt: daysAgo(1),
    },
  })

  await prisma.chatbotMessage.createMany({
    data: [
      {
        conversationId: escalated.id,
        role: 'USER',
        content: 'Толгой өвдөж байна, надад ямар эм уувал зохих вэ?',
        createdAt: daysAgo(1),
      },
      {
        conversationId: escalated.id,
        role: 'ASSISTANT',
        content:
          'Уучлаарай, би өвчин тодорхойлох, эм заах, тун тогтоох боломжгүй — эдгээрийг зөвхөн эмч, фармацевт хийх ёстой. Мэргэжлийн фармацевт танд тохирох зөвлөгөө өгөх боломжтой.',
        intent: 'medical_advice_blocked',
        createdAt: daysAgo(1),
      },
    ],
  })

  console.log('  ✓ 2 chatbot conversations (including a safety redirect)')
}
