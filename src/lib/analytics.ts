import 'server-only'

import { prisma } from './prisma'

/**
 * First-party analytics.
 *
 * Only pharmacy-owned events are recorded, keyed by a rotating anonymous
 * session id — no third-party trackers, no cross-site identifiers, and no
 * health-inferring profile is built for advertising. Product-view rows are the
 * closest thing to sensitive data here, so they are retained for reporting only
 * and can be pruned by `pruneAnalytics`.
 */

export type EventName =
  | 'product_viewed'
  | 'add_to_cart'
  | 'checkout_started'
  | 'order_completed'
  | 'search_performed'
  | 'category_viewed'
  | 'chatbot_opened'

export async function trackEvent(input: {
  name: EventName
  sessionId?: string | null
  userId?: string | null
  productId?: string | null
  value?: number | null
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        sessionId: input.sessionId ?? null,
        userId: input.userId ?? null,
        productId: input.productId ?? null,
        value: input.value ?? null,
        metadata: (input.metadata ?? undefined) as never,
      },
    })
  } catch (error) {
    // Analytics must never break a customer action.
    console.error('[analytics] track failed', error)
  }
}

export interface FunnelMetrics {
  productViews: number
  addToCart: number
  checkoutStarted: number
  ordersCompleted: number
  viewToCartRate: number
  cartToCheckoutRate: number
  checkoutToOrderRate: number
  conversionRate: number
  searches: number
}

export async function getFunnelMetrics(from: Date, to: Date): Promise<FunnelMetrics> {
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ['name'],
    where: { createdAt: { gte: from, lte: to } },
    _count: { _all: true },
  })
  const count = (name: EventName) => grouped.find((g) => g.name === name)?._count._all ?? 0

  const productViews = count('product_viewed')
  const addToCart = count('add_to_cart')
  const checkoutStarted = count('checkout_started')

  // Orders are counted from the orders table, not events: an order created by
  // staff or via a retry is still a real conversion.
  const ordersCompleted = await prisma.order.count({
    where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
  })

  const ratio = (numerator: number, denominator: number) =>
    denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(1))

  return {
    productViews,
    addToCart,
    checkoutStarted,
    ordersCompleted,
    searches: count('search_performed'),
    viewToCartRate: ratio(addToCart, productViews),
    cartToCheckoutRate: ratio(checkoutStarted, addToCart),
    checkoutToOrderRate: ratio(ordersCompleted, checkoutStarted),
    conversionRate: ratio(ordersCompleted, productViews),
  }
}

export async function getTopSearches(from: Date, to: Date, take = 10) {
  const rows = await prisma.analyticsEvent.findMany({
    where: { name: 'search_performed', createdAt: { gte: from, lte: to } },
    select: { metadata: true },
    take: 5000,
  })
  const counts = new Map<string, number>()
  for (const row of rows) {
    const term = (row.metadata as { term?: string } | null)?.term?.trim().toLowerCase()
    if (!term) continue
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([term, count]) => ({ term, count }))
}

/** Retention helper — drop raw event rows older than the given number of days. */
export async function pruneAnalytics(olderThanDays = 400): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000)
  const result = await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
  return result.count
}
