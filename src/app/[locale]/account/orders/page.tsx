import type { Metadata } from 'next'
import Link from 'next/link'
import { Package } from 'lucide-react'

import { Badge, Card, EmptyState, ORDER_STATUS_TONE, Pagination } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mediaUrl } from '@/lib/storage'
import { buildMetadata } from '@/lib/seo'
import { formatDateTime, formatMnt } from '@/lib/utils'

const PER_PAGE = 10

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.account.orderHistory,
    description: d.account.orderHistory,
    pathWithoutLocale: '/account/orders',
    noIndex: true,
  })
}

export default async function AccountOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const session = (await getSession())!
  const query = await searchParams

  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const status = query.status && query.status !== 'all' ? query.status : undefined

  const where = {
    userId: session.id,
    ...(status ? { status: status as never } : {}),
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        items: { select: { name: true, quantity: true, imageKey: true }, take: 4 },
        payment: { select: { method: true, status: true } },
        delivery: { select: { method: true, status: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ])

  const statusFilters = [
    { value: 'all', label: d.common.all },
    { value: 'NEW', label: d.orderStatus.NEW },
    { value: 'CONFIRMING', label: d.orderStatus.CONFIRMING },
    { value: 'PREPARING', label: d.orderStatus.PREPARING },
    { value: 'SHIPPED', label: d.orderStatus.SHIPPED },
    { value: 'DELIVERED', label: d.orderStatus.DELIVERED },
    { value: 'CANCELLED', label: d.orderStatus.CANCELLED },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">{d.account.orderHistory}</h1>
        <span className="text-sm text-ink-500 tabular">
          {total} {d.common.results}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {statusFilters.map((filter) => {
          const active = (query.status ?? 'all') === filter.value
          return (
            <Link
              key={filter.value}
              href={`/${locale}/account/orders${filter.value === 'all' ? '' : `?status=${filter.value}`}`}
              className={
                active
                  ? 'rounded-full border border-brand-500 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700'
                  : 'rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 transition-colors hover:border-brand-300'
              }
            >
              {filter.label}
            </Link>
          )
        })}
      </div>

      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={d.account.noOrders}
            body={d.account.noOrdersBody}
            action={
              <Link href={`/${locale}/products`}>
                <Button size="sm">{d.cart.continueShopping}</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-3">
                  <div className="min-w-0">
                    <Link
                      href={`/${locale}/account/orders/${order.id}`}
                      className="text-sm font-bold text-ink-900 hover:text-brand-700 tabular"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {formatDateTime(order.createdAt, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {order.requiresPrescription ? (
                      <Badge tone={order.prescriptionCleared ? 'success' : 'warning'}>
                        {order.prescriptionCleared
                          ? d.prescription.statusVERIFIED
                          : d.prescription.awaitingVerification}
                      </Badge>
                    ) : null}
                    <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                      {d.orderStatus[order.status]}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                  <div className="flex items-center gap-1.5">
                    {order.items.map((item, index) => (
                      <span
                        key={index}
                        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-ink-50"
                        title={item.name}
                      >
                        {mediaUrl(item.imageKey) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(item.imageKey)!} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-ink-300" aria-hidden />
                        )}
                      </span>
                    ))}
                    {order._count.items > order.items.length ? (
                      <span className="text-xs font-medium text-ink-500 tabular">
                        +{order._count.items - order.items.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[11px] text-ink-400">
                        {order.payment ? d.paymentMethod[order.payment.method] : '—'}
                      </p>
                      <p className="text-base font-bold text-ink-900 tabular">
                        {formatMnt(order.total, locale)}
                      </p>
                    </div>
                    <Link href={`/${locale}/account/orders/${order.id}`}>
                      <Button size="sm" variant="outline">
                        {d.common.details}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        className="pt-2"
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
        buildHref={(next) =>
          `/${locale}/account/orders?page=${next}${query.status ? `&status=${query.status}` : ''}`
        }
      />
    </div>
  )
}
