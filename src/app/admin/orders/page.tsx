import Link from 'next/link'
import { Suspense } from 'react'
import { Download, FileText } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/shell'
import {
  DataTable,
  FilterPills,
  TableSearch,
  TablePagination,
  Td,
  Th,
  Tr,
} from '@/components/admin/table'
import {
  Badge,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  Spinner,
} from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDateTime, formatMnt, maskPhone } from '@/lib/utils'

const PER_PAGE = 20

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>
}) {
  const session = (await getSession())!
  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams

  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const status = query.status && query.status !== 'all' ? query.status : undefined
  const search = (query.q ?? '').trim()

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: 'insensitive' as const } },
            { customerName: { contains: search, mode: 'insensitive' as const } },
            { customerPhone: { contains: search } },
          ],
        }
      : {}),
  }

  const [total, orders, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        payment: { select: { method: true, status: true } },
        delivery: { select: { method: true, status: true } },
        _count: { select: { items: true, prescriptions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const countFor = (value: string) =>
    value === 'all'
      ? counts.reduce((sum, row) => sum + row._count._all, 0)
      : (counts.find((row) => row.status === value)?._count._all ?? 0)

  const showContact = can(session, 'customers.viewContact')

  return (
    <>
      <AdminPageHeader
        title={d.admin.orders}
        subtitle={`${total} ${d.common.results}`}
        actions={
          can(session, 'reports.export') ? (
            <a href="/api/reports/export?type=orders&range=30d" download>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" aria-hidden />
                {d.admin.exportCsv}
              </Button>
            </a>
          ) : null
        }
      />

      <Suspense fallback={<Spinner />}>
        <div className="mb-4 space-y-3">
          <FilterPills
            paramName="status"
            options={[
              { value: 'all', label: d.common.all, count: countFor('all') },
              { value: 'NEW', label: d.orderStatus.NEW, count: countFor('NEW') },
              { value: 'CONFIRMING', label: d.orderStatus.CONFIRMING, count: countFor('CONFIRMING') },
              { value: 'PREPARING', label: d.orderStatus.PREPARING, count: countFor('PREPARING') },
              { value: 'SHIPPED', label: d.orderStatus.SHIPPED, count: countFor('SHIPPED') },
              { value: 'DELIVERED', label: d.orderStatus.DELIVERED, count: countFor('DELIVERED') },
              { value: 'CANCELLED', label: d.orderStatus.CANCELLED, count: countFor('CANCELLED') },
            ]}
          />
          <TableSearch placeholder={`${d.admin.orderNumber} / ${d.admin.customer} / ${d.common.phone}`} />
        </div>
      </Suspense>

      <DataTable
        isEmpty={orders.length === 0}
        empty={d.admin.emptyTable}
        head={
          <>
            <Th>{d.admin.orderNumber}</Th>
            <Th>{d.admin.customer}</Th>
            <Th align="center">{d.admin.itemsCount}</Th>
            <Th align="right">{d.cart.total}</Th>
            <Th>{d.admin.payments}</Th>
            <Th>{d.admin.delivery}</Th>
            <Th>{d.common.status}</Th>
            <Th>{d.common.date}</Th>
          </>
        }
      >
        {orders.map((order) => (
          <Tr key={order.id} href={`/admin/orders/${order.id}`}>
            <Td>
              <Link
                href={`/admin/orders/${order.id}`}
                className="font-semibold text-ink-900 hover:text-brand-700 tabular"
              >
                {order.orderNumber}
              </Link>
              {order.requiresPrescription ? (
                <span className="mt-1 block">
                  <Badge
                    tone={order.prescriptionCleared ? 'success' : 'warning'}
                    icon={<FileText className="h-3 w-3" />}
                  >
                    {order.prescriptionCleared
                      ? d.prescription.statusVERIFIED
                      : `${d.prescription.statusPENDING} (${order._count.prescriptions})`}
                  </Badge>
                </span>
              ) : null}
            </Td>
            <Td>
              <span className="block max-w-[180px] truncate font-medium text-ink-900">
                {order.customerName}
              </span>
              <span className="block text-xs text-ink-500 tabular">
                {showContact ? order.customerPhone : maskPhone(order.customerPhone)}
              </span>
            </Td>
            <Td align="center" className="tabular">
              {order._count.items}
            </Td>
            <Td align="right">
              <span className="font-bold text-ink-900 tabular">{formatMnt(order.total, locale)}</span>
              {order.discountTotal > 0 ? (
                <span className="block text-xs text-success tabular">
                  −{formatMnt(order.discountTotal, locale)}
                </span>
              ) : null}
            </Td>
            <Td>
              {order.payment ? (
                <>
                  <span className="block text-xs text-ink-600">
                    {d.paymentMethod[order.payment.method]}
                  </span>
                  <Badge tone={PAYMENT_STATUS_TONE[order.payment.status] ?? 'neutral'}>
                    {d.paymentStatus[order.payment.status]}
                  </Badge>
                </>
              ) : (
                '—'
              )}
            </Td>
            <Td>
              {order.delivery ? (
                <>
                  <span className="block text-xs text-ink-600">
                    {d.deliveryMethod[order.delivery.method]}
                  </span>
                  <span className="block text-xs text-ink-400">
                    {d.deliveryStatus[order.delivery.status]}
                  </span>
                </>
              ) : (
                '—'
              )}
            </Td>
            <Td>
              <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                {d.orderStatus[order.status]}
              </Badge>
            </Td>
            <Td className="whitespace-nowrap text-xs text-ink-500">
              {formatDateTime(order.createdAt, locale)}
            </Td>
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
