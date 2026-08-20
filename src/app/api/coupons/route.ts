import { prisma } from '@/lib/prisma'
import { ApiError, ok, pageMeta, readPagination, route } from '@/lib/api'
import { couponSchema } from '@/lib/validation'
import { audit } from '@/lib/audit'

export const GET = route({
  auth: { permission: 'coupons.view' },
  async handler({ query }) {
    const pagination = readPagination(query, 25, 100)
    const search = (query.get('q') ?? '').trim().toUpperCase()

    const where = {
      deletedAt: null,
      ...(search ? { code: { contains: search } } : {}),
    }

    const [total, coupons] = await Promise.all([
      prisma.coupon.count({ where }),
      prisma.coupon.findMany({
        where,
        include: { _count: { select: { redemptions: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    const now = new Date()
    return ok({
      coupons: coupons.map((coupon) => ({
        ...coupon,
        redemptionCount: coupon._count.redemptions,
        isExpired: coupon.endsAt < now,
        isScheduled: coupon.startsAt > now,
        isExhausted: coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit,
      })),
      meta: pageMeta(pagination, total),
    })
  },
})

export const POST = route({
  auth: { permission: 'coupons.manage' },
  schema: couponSchema,
  async handler({ body, session, request }) {
    const existing = await prisma.coupon.findUnique({ where: { code: body.code } })
    if (existing) throw new ApiError(409, 'CODE_TAKEN', 'A coupon with this code already exists')

    const coupon = await prisma.coupon.create({
      data: {
        code: body.code,
        description: body.description ?? null,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minOrderAmount: body.minOrderAmount,
        maxDiscountAmount: body.maxDiscountAmount ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        usageLimit: body.usageLimit ?? null,
        perCustomerLimit: body.perCustomerLimit,
        isActive: body.isActive,
      },
    })

    await audit({
      actor: session,
      action: 'coupon.create',
      entity: 'Coupon',
      entityId: coupon.id,
      summary: `${coupon.code} — ${coupon.discountType} ${coupon.discountValue}`,
      request,
    })

    return ok({ coupon }, { status: 201 })
  },
})
