import 'server-only'

import { prisma } from './prisma'
import { getInventoryAlerts } from './inventory'

/**
 * Aggregations for the admin dashboard and the reports screens.
 * Every figure excludes cancelled orders unless stated otherwise.
 */

export type RangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom'

export interface DateRange {
  from: Date
  to: Date
  key: RangeKey
  label: string
}

export function resolveRange(key: string | undefined, fromParam?: string, toParam?: string): DateRange {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000 - 1)

  switch (key) {
    case 'yesterday': {
      const from = new Date(startOfToday.getTime() - 86_400_000)
      return { from, to: new Date(startOfToday.getTime() - 1), key: 'yesterday', label: 'yesterday' }
    }
    case '7d':
      return { from: new Date(startOfToday.getTime() - 6 * 86_400_000), to: endOfToday, key: '7d', label: 'last7Days' }
    case '30d':
      return { from: new Date(startOfToday.getTime() - 29 * 86_400_000), to: endOfToday, key: '30d', label: 'last30Days' }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday, key: 'month', label: 'thisMonth' }
    case 'custom': {
      const from = fromParam ? new Date(fromParam) : new Date(startOfToday.getTime() - 29 * 86_400_000)
      const to = toParam ? new Date(`${toParam}T23:59:59`) : endOfToday
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
        return { from: new Date(startOfToday.getTime() - 29 * 86_400_000), to: endOfToday, key: '30d', label: 'last30Days' }
      }
      return { from, to, key: 'custom', label: 'customRange' }
    }
    case 'today':
    default:
      return { from: startOfToday, to: endOfToday, key: 'today', label: 'today' }
  }
}

const SOLD_STATUSES = ['NEW', 'CONFIRMING', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const

export interface DashboardOverview {
  totalSales: number
  rangeSales: number
  todaySales: number
  monthSales: number
  totalOrders: number
  rangeOrders: number
  pendingOrders: number
  completedOrders: number
  cancelledOrders: number
  totalCustomers: number
  newCustomers: number
  avgOrderValue: number
  lowStockCount: number
  expiringCount: number
  expiredCount: number
  prescriptionQueue: number
  unpaidPayments: number
}

export async function getDashboardOverview(range: DateRange): Promise<DashboardOverview> {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const soldWhere = { status: { in: [...SOLD_STATUSES] } }

  const [
    allTime,
    rangeAgg,
    todayAgg,
    monthAgg,
    totalOrders,
    rangeOrders,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    totalCustomers,
    newCustomers,
    prescriptionQueue,
    unpaidPayments,
    alerts,
  ] = await Promise.all([
    prisma.order.aggregate({ where: soldWhere, _sum: { total: true } }),
    prisma.order.aggregate({
      where: { ...soldWhere, createdAt: { gte: range.from, lte: range.to } },
      _sum: { total: true },
      _avg: { total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({ where: { ...soldWhere, createdAt: { gte: startOfToday } }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { ...soldWhere, createdAt: { gte: startOfMonth } }, _sum: { total: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.order.count({ where: { status: { in: ['NEW', 'CONFIRMING', 'PREPARING'] } } }),
    prisma.order.count({ where: { status: 'DELIVERED' } }),
    prisma.order.count({ where: { status: 'CANCELLED' } }),
    prisma.user.count({ where: { isStaff: false, deletedAt: null } }),
    prisma.user.count({
      where: { isStaff: false, deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
    }),
    prisma.prescription.count({ where: { status: { in: ['PENDING', 'CLARIFICATION_REQUESTED'] } } }),
    prisma.payment.count({ where: { status: { in: ['PENDING', 'AWAITING_CONFIRMATION', 'FAILED'] } } }),
    getInventoryAlerts(),
  ])

  return {
    totalSales: allTime._sum.total ?? 0,
    rangeSales: rangeAgg._sum.total ?? 0,
    todaySales: todayAgg._sum.total ?? 0,
    monthSales: monthAgg._sum.total ?? 0,
    totalOrders,
    rangeOrders,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    totalCustomers,
    newCustomers,
    avgOrderValue: Math.round(rangeAgg._avg.total ?? 0),
    lowStockCount: alerts.lowStock.length,
    expiringCount: alerts.expiring.length,
    expiredCount: alerts.expired.length,
    prescriptionQueue,
    unpaidPayments,
  }
}

export interface TimeSeriesPoint {
  date: string
  sales: number
  orders: number
}

export async function getSalesTimeSeries(range: DateRange): Promise<TimeSeriesPoint[]> {
  const orders = await prisma.order.findMany({
    where: { status: { in: [...SOLD_STATUSES] }, createdAt: { gte: range.from, lte: range.to } },
    select: { createdAt: true, total: true },
    orderBy: { createdAt: 'asc' },
  })

  const spanDays = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86_400_000))
  const useHours = spanDays <= 2

  const buckets = new Map<string, { sales: number; orders: number }>()

  // Pre-seed buckets so a quiet day renders as zero rather than a gap.
  if (useHours) {
    for (let h = 0; h < 24; h += 1) {
      buckets.set(`${String(h).padStart(2, '0')}:00`, { sales: 0, orders: 0 })
    }
  } else {
    for (let d = 0; d < spanDays; d += 1) {
      const day = new Date(range.from.getTime() + d * 86_400_000)
      buckets.set(day.toISOString().slice(0, 10), { sales: 0, orders: 0 })
    }
  }

  for (const order of orders) {
    const key = useHours
      ? `${String(order.createdAt.getHours()).padStart(2, '0')}:00`
      : order.createdAt.toISOString().slice(0, 10)
    const bucket = buckets.get(key) ?? { sales: 0, orders: 0 }
    bucket.sales += order.total
    bucket.orders += 1
    buckets.set(key, bucket)
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }))
}

export async function getTopProducts(range: DateRange, take = 8) {
  const grouped = await prisma.orderItem.groupBy({
    by: ['productId', 'name', 'sku'],
    where: {
      order: { status: { in: [...SOLD_STATUSES] }, createdAt: { gte: range.from, lte: range.to } },
    },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { lineTotal: 'desc' } },
    take,
  })
  return grouped.map((g) => ({
    productId: g.productId,
    name: g.name,
    sku: g.sku,
    quantity: g._sum.quantity ?? 0,
    revenue: g._sum.lineTotal ?? 0,
  }))
}

export async function getSalesByCategory(range: DateRange, take = 8) {
  const items = await prisma.orderItem.findMany({
    where: {
      order: { status: { in: [...SOLD_STATUSES] }, createdAt: { gte: range.from, lte: range.to } },
      productId: { not: null },
    },
    select: {
      lineTotal: true,
      quantity: true,
      product: { select: { category: { select: { id: true, name: true } } } },
    },
  })

  const totals = new Map<string, { name: string; revenue: number; units: number }>()
  for (const item of items) {
    const category = item.product?.category
    if (!category) continue
    const entry = totals.get(category.id) ?? { name: category.name, revenue: 0, units: 0 }
    entry.revenue += item.lineTotal
    entry.units += item.quantity
    totals.set(category.id, entry)
  }

  return [...totals.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, take)
}

export async function getPaymentMethodBreakdown(range: DateRange) {
  const grouped = await prisma.payment.groupBy({
    by: ['method'],
    where: { order: { createdAt: { gte: range.from, lte: range.to }, status: { not: 'CANCELLED' } } },
    _sum: { amount: true },
    _count: { _all: true },
  })
  return grouped.map((g) => ({
    method: g.method,
    amount: g._sum.amount ?? 0,
    count: g._count._all,
  }))
}

export async function getCustomerGrowth(range: DateRange): Promise<{ date: string; count: number }[]> {
  const users = await prisma.user.findMany({
    where: { isStaff: false, deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const spanDays = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86_400_000))
  const buckets = new Map<string, number>()
  for (let d = 0; d < spanDays; d += 1) {
    buckets.set(new Date(range.from.getTime() + d * 86_400_000).toISOString().slice(0, 10), 0)
  }
  for (const user of users) {
    const key = user.createdAt.toISOString().slice(0, 10)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }))
}

export async function getOrderStatusBreakdown() {
  const grouped = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } })
  return grouped.map((g) => ({ status: g.status, count: g._count._all }))
}

export async function getTopCustomers(range: DateRange, take = 10) {
  const grouped = await prisma.order.groupBy({
    by: ['userId'],
    where: {
      status: { in: [...SOLD_STATUSES] },
      createdAt: { gte: range.from, lte: range.to },
      userId: { not: null },
    },
    _sum: { total: true },
    _count: { _all: true },
    orderBy: { _sum: { total: 'desc' } },
    take,
  })

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId!).filter(Boolean) } },
    select: { id: true, fullName: true, phone: true, email: true, createdAt: true },
  })
  const byId = new Map(users.map((u) => [u.id, u]))

  return grouped.map((g) => ({
    userId: g.userId!,
    name: byId.get(g.userId!)?.fullName ?? '—',
    phone: byId.get(g.userId!)?.phone ?? '',
    email: byId.get(g.userId!)?.email ?? null,
    orders: g._count._all,
    revenue: g._sum.total ?? 0,
  }))
}

/** Minimal, dependency-free CSV writer used by the report export routes. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0]!)
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const text = value instanceof Date ? value.toISOString() : String(value)
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n')
}
