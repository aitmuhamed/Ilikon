import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { customerStatusSchema } from '@/lib/validation'
import { can } from '@/lib/auth'
import { maskEmail, maskPhone } from '@/lib/utils'
import { audit } from '@/lib/audit'

export const GET = route<unknown, { id: string }>({
  auth: { permission: 'customers.view' },
  async handler({ params, session }) {
    const user = await prisma.user.findFirst({
      where: { id: params.id, isStaff: false, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        locale: true,
        marketingOptIn: true,
        createdAt: true,
        lastLoginAt: true,
        addresses: { where: { deletedAt: null } },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        prescriptions: {
          select: { id: true, code: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Customer not found')

    const showContact = can(session, 'customers.viewContact')

    const stats = await prisma.order.aggregate({
      where: { userId: params.id, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: { _all: true },
      _avg: { total: true },
    })

    return ok({
      customer: {
        ...user,
        phone: showContact ? user.phone : maskPhone(user.phone),
        email: showContact ? user.email : maskEmail(user.email),
        contactMasked: !showContact,
        // A masked view also hides the street address.
        addresses: showContact
          ? user.addresses
          : user.addresses.map((address) => ({
              ...address,
              phone: maskPhone(address.phone),
              addressLine: '•••',
            })),
      },
      stats: {
        orders: stats._count._all,
        totalSpent: stats._sum.total ?? 0,
        averageOrder: Math.round(stats._avg.total ?? 0),
      },
    })
  },
})

/** Enable / disable a customer account. */
export const PATCH = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'customers.manage' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: customerStatusSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof customerStatusSchema>

    const user = await prisma.user.findFirst({
      where: { id: params.id, isStaff: false, deletedAt: null },
      select: { id: true, fullName: true, status: true },
    })
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Customer not found')

    await prisma.user.update({ where: { id: params.id }, data: { status: data.status } })

    await audit({
      actor: session,
      action: data.status === 'ACTIVE' ? 'customer.enable' : 'customer.disable',
      entity: 'User',
      entityId: params.id,
      summary: `${user.fullName}: ${user.status} → ${data.status}`,
      request,
    })

    return ok({ status: data.status })
  },
})
