import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { changePasswordSchema, updateProfileSchema } from '@/lib/validation'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { audit, diffChanges } from '@/lib/audit'

/** Profile read + update, and password change, for the signed-in customer. */

export const GET = route({
  auth: 'user',
  async handler({ session }) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session!.id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        locale: true,
        marketingOptIn: true,
        createdAt: true,
      },
    })

    const [orderStats, addressCount] = await Promise.all([
      prisma.order.aggregate({
        where: { userId: session!.id, status: { not: 'CANCELLED' } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.address.count({ where: { userId: session!.id, deletedAt: null } }),
    ])

    return ok({
      user,
      stats: {
        orders: orderStats._count._all,
        totalSpent: orderStats._sum.total ?? 0,
        addresses: addressCount,
      },
    })
  },
})

export const PATCH = route({
  auth: 'user',
  schema: updateProfileSchema,
  async handler({ body, session, request }) {
    const current = await prisma.user.findUniqueOrThrow({ where: { id: session!.id } })

    if (body.phone !== current.phone) {
      const taken = await prisma.user.findUnique({ where: { phone: body.phone } })
      if (taken) throw new ApiError(409, 'PHONE_TAKEN', 'This phone number is already registered')
    }
    if (body.email && body.email !== current.email) {
      const taken = await prisma.user.findUnique({ where: { email: body.email } })
      if (taken) throw new ApiError(409, 'EMAIL_TAKEN', 'This email is already registered')
    }

    const updated = await prisma.user.update({
      where: { id: session!.id },
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email ?? null,
        locale: body.locale ?? current.locale,
        marketingOptIn: body.marketingOptIn ?? current.marketingOptIn,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        locale: true,
        marketingOptIn: true,
      },
    })

    await audit({
      actor: session,
      action: 'account.update',
      entity: 'User',
      entityId: session!.id,
      changes: diffChanges(current as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>),
      request,
    })

    return ok({ user: updated })
  },
})

export const PUT = route({
  auth: 'user',
  schema: changePasswordSchema,
  rateLimit: 'passwordReset',
  async handler({ body, session, request }) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session!.id } })
    const valid = await verifyPassword(body.currentPassword, user.passwordHash)
    if (!valid) throw new ApiError(400, 'INVALID_PASSWORD', 'Current password is incorrect')

    await prisma.user.update({
      where: { id: session!.id },
      data: { passwordHash: await hashPassword(body.password) },
    })

    await audit({
      actor: session,
      action: 'account.password_change',
      entity: 'User',
      entityId: session!.id,
      request,
    })

    return ok({ changed: true })
  },
})
