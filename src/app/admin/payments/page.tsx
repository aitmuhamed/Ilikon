import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Check, X } from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { PaymentStatusControl } from '@/components/admin/order-client'
import { DataTable, FilterPills, TablePagination, Td, Th, Tr } from '@/components/admin/table'
import { Alert, Badge, Card, PAYMENT_STATUS_TONE, Spinner } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { paymentProviderStatus } from '@/lib/payments'
import { formatDateTime, formatMnt, formatNumber } from '@/lib/utils'

const PER_PAGE = 25

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; method?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'payments.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams

  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const status = query.status && query.status !== 'all' ? query.status : undefined

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(query.method && query.method !== 'all' ? { method: query.method as never } : {}),
  }

  const [total, payments, statusCounts, methodTotals] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        order: {
          select: { id: true, orderNumber: true, customerName: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.payment.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true } }),
    prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'PAID' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])

  const countFor = (value: string) =>
    value === 'all'
      ? statusCounts.reduce((sum, row) => sum + row._count._all, 0)
      : (statusCounts.find((row) => row.status === value)?._count._all ?? 0)

  const paidTotal = statusCounts.find((row) => row.status === 'PAID')?._sum.amount ?? 0
  const pendingTotal =
    (statusCounts.find((row) => row.status === 'PENDING')?._sum.amount ?? 0) +
    (statusCounts.find((row) => row.status === 'AWAITING_CONFIRMATION')?._sum.amount ?? 0)

  const providers = paymentProviderStatus()

  return (
    <>
      <AdminPageHeader title={d.admin.payments} subtitle={`${total} ${d.common.results}`} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={d.paymentStatus.PAID} value={formatMnt(paidTotal, locale)} tone="success" />
        <StatCard
          label={d.paymentStatus.PENDING}
          value={formatMnt(pendingTotal, locale)}
          tone={pendingTotal > 0 ? 'warning' : 'default'}
        />
        <StatCard label={d.paymentStatus.FAILED} value={formatNumber(countFor('FAILED'), locale)} tone={countFor('FAILED') > 0 ? 'danger' : 'default'} />
        <StatCard label={d.paymentStatus.REFUNDED} value={formatNumber(countFor('REFUNDED'), locale)} />
      </div>

      {/* Gateway configuration state — credentials themselves stay in env */}
      <Card className="mb-4">
        <h2 className="mb-2.5 text-sm font-semibold text-ink-900">{d.admin.paymentSettings}</h2>
        <div className="flex flex-wrap gap-2">
          {providers.map((provider) => {
            const paid = methodTotals.find((row) => row.method === provider.method)
            return (
              <span
                key={provider.method}
                className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs"
              >
                <Badge
                  tone={provider.configured ? 'success' : 'neutral'}
                  icon={provider.configured ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                >
                  {d.paymentMethod[provider.method]}
                </Badge>
                <span className="font-semibold text-ink-800 tabular">
                  {formatMnt(paid?._sum.amount ?? 0, locale)}
                </span>
                <span className="text-ink-400 tabular">{paid?._count._all ?? 0}</span>
              </span>
            )
          })}
        </div>
        <Alert tone="info" className="mt-3">
          {d.admin.secretsNote}
        </Alert>
      </Card>

      <Suspense fallback={<Spinner />}>
        <FilterPills
          className="mb-4"
          paramName="status"
          options={[
            { value: 'all', label: d.common.all, count: countFor('all') },
            { value: 'PENDING', label: d.paymentStatus.PENDING, count: countFor('PENDING') },
            {
              value: 'AWAITING_CONFIRMATION',
              label: d.paymentStatus.AWAITING_CONFIRMATION,
              count: countFor('AWAITING_CONFIRMATION'),
            },
            { value: 'PAID', label: d.paymentStatus.PAID, count: countFor('PAID') },
            { value: 'FAILED', label: d.paymentStatus.FAILED, count: countFor('FAILED') },
            { value: 'REFUNDED', label: d.paymentStatus.REFUNDED, count: countFor('REFUNDED') },
          ]}
        />
      </Suspense>

      <DataTable
        isEmpty={payments.length === 0}
        empty={d.admin.emptyTable}
        head={
          <>
            <Th>{d.admin.orderNumber}</Th>
            <Th>{d.admin.customer}</Th>
            <Th>{d.checkout.paymentMethod}</Th>
            <Th align="right">{d.cart.total}</Th>
            <Th>{d.common.status}</Th>
            <Th>Ref</Th>
            <Th>{d.common.date}</Th>
            {can(session, 'payments.manage') ? <Th align="right">{d.common.actions}</Th> : null}
          </>
        }
      >
        {payments.map((payment) => (
          <Tr key={payment.id}>
            <Td>
              <Link
                href={`/admin/orders/${payment.order.id}`}
                className="font-semibold text-ink-900 hover:text-brand-700 tabular"
              >
                {payment.order.orderNumber}
              </Link>
            </Td>
            <Td className="max-w-[160px] truncate text-xs">{payment.order.customerName}</Td>
            <Td className="text-xs">{d.paymentMethod[payment.method]}</Td>
            <Td align="right" className="font-bold tabular">
              {formatMnt(payment.amount, locale)}
            </Td>
            <Td>
              <Badge tone={PAYMENT_STATUS_TONE[payment.status] ?? 'neutral'}>
                {d.paymentStatus[payment.status]}
              </Badge>
            </Td>
            <Td className="max-w-[140px] truncate text-xs text-ink-400 tabular">
              {payment.providerRef ?? '—'}
            </Td>
            <Td className="whitespace-nowrap text-xs text-ink-500">
              {formatDateTime(payment.createdAt, locale)}
            </Td>
            {can(session, 'payments.manage') ? (
              <Td align="right">
                <div className="w-44">
                  <PaymentStatusControl
                    paymentId={payment.id}
                    status={payment.status}
                    method={payment.method}
                  />
                </div>
              </Td>
            ) : null}
          </Tr>
        ))}
      </DataTable>

      <Suspense fallback={null}>
        <TablePagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
          total={total}
        />
      </Suspense>
    </>
  )
}
