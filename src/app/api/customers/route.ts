import { prisma } from '@/lib/prisma'
import { ok, pageMeta, readPagination, route } from '@/lib/api'
import { can } from '@/lib/auth'
import { maskEmail, maskPhone } from '@/lib/utils'

/**
 * Customer directory.
 *
 * Phone numbers and emails are masked unless the caller holds
 * `customers.viewContact` — the list is useful for support without exposing
 * personal data to every staff role.
 */
export const GET = route({
  auth: { permission: 'customers.view' },
  async handler({ query, session }) {
    const pagination = readPagination(query, 25, 100)
    const search = (query.get('q') ?? '').trim()
    const status = query.get('status')

    const where = {
      isStaff: false,
      deletedAt: null,
      ...(status && status !== 'all' ? { status: status as never } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
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
          _count: { select: { orders: true, prescriptions: true, addresses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    // One grouped query rather than N per-customer aggregates.
    const spend = await prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: users.map((u) => u.id) }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _max: { createdAt: true },
    })
    const spendByUser = new Map(spend.map((s) => [s.userId, s]))

    const showContact = can(session, 'customers.viewContact')

    return ok({
      customers: users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        phone: showContact ? user.phone : maskPhone(user.phone),
        email: showContact ? user.email : maskEmail(user.email),
        contactMasked: !showContact,
        status: user.status,
        locale: user.locale,
        marketingOptIn: user.marketingOptIn,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        orderCount: user._count.orders,
        prescriptionCount: user._count.prescriptions,
        addressCount: user._count.addresses,
        totalSpent: spendByUser.get(user.id)?._sum.total ?? 0,
        lastOrderAt: spendByUser.get(user.id)?._max.createdAt ?? null,
      })),
      meta: pageMeta(pagination, total),
    })
  },
})
