import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { couponSchema } from '@/lib/validation'
import { audit, diffChanges } from '@/lib/audit'

export const PUT = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'coupons.manage' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: couponSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof couponSchema>
    const current = await prisma.coupon.findUnique({ where: { id: params.id } })
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Coupon not found')

    if (data.code !== current.code) {
      const taken = await prisma.coupon.findUnique({ where: { code: data.code } })
      if (taken) throw new ApiError(409, 'CODE_TAKEN', 'A coupon with this code already exists')
    }

    const updated = await prisma.coupon.update({
      where: { id: params.id },
      data: {
        code: data.code,
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount,
        maxDiscountAmount: data.maxDiscountAmount ?? null,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        usageLimit: data.usageLimit ?? null,
        perCustomerLimit: data.perCustomerLimit,
        isActive: data.isActive,
      },
    })

    await audit({
      actor: session,
      action: 'coupon.update',
      entity: 'Coupon',
      entityId: params.id,
      summary: updated.code,
      changes: diffChanges(
        current as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      ),
      request,
    })

    return ok({ coupon: updated })
  },
})

/** Redeemed coupons are archived so historical orders keep their reference. */
export const DELETE = route<unknown, { id: string }>({
  auth: { permission: 'coupons.manage' },
  async handler({ params, session, request }) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: params.id },
      include: { _count: { select: { redemptions: true, orders: true } } },
    })
    if (!coupon) throw new ApiError(404, 'NOT_FOUND', 'Coupon not found')

    const inUse = coupon._count.redemptions > 0 || coupon._count.orders > 0

    if (inUse) {
      await prisma.coupon.update({
        where: { id: params.id },
        data: { isActive: false, deletedAt: new Date() },
      })
    } else {
      await prisma.coupon.delete({ where: { id: params.id } })
    }

    await audit({
      actor: session,
      action: inUse ? 'coupon.archive' : 'coupon.delete',
      entity: 'Coupon',
      entityId: params.id,
      summary: coupon.code,
      request,
    })

    return ok({ archived: inUse, deleted: !inUse })
  },
})
