import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download, Lock } from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import {
  DataTable,
  FilterPills,
  TablePagination,
  TableSearch,
  Td,
  Th,
  Tr,
} from '@/components/admin/table'
import { Alert, Badge, Spinner } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate, formatMnt, formatNumber, maskEmail, maskPhone } from '@/lib/utils'

const PER_PAGE = 25

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'customers.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams

  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const search = (query.q ?? '').trim()
  const status = query.status && query.status !== 'all' ? query.status : undefined
  const showContact = can(session, 'customers.viewContact')

  const where = {
    isStaff: false,
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
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

  const [total, customers, counts, optedIn] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        marketingOptIn: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { orders: true, prescriptions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.user.groupBy({
      by: ['status'],
      where: { isStaff: false, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { isStaff: false, deletedAt: null, marketingOptIn: true } }),
  ])

  const spend = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: customers.map((customer) => customer.id) }, status: { not: 'CANCELLED' } },
    _sum: { total: true },
    _max: { createdAt: true },
  })
  const spendByUser = new Map(spend.map((row) => [row.userId, row]))

  const countFor = (value: string) =>
    value === 'all'
      ? counts.reduce((sum, row) => sum + row._count._all, 0)
      : (counts.find((row) => row.status === value)?._count._all ?? 0)

  return (
    <>
      <AdminPageHeader
        title={d.admin.customers}
        subtitle={`${total} ${d.common.results}`}
        actions={
          can(session, 'reports.export') ? (
            <a href="/api/reports/export?type=customers&range=30d" download>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" aria-hidden />
                {d.admin.exportCsv}
              </Button>
            </a>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.admin.totalCustomers}
          value={formatNumber(countFor('all'), locale)}
          tone="brand"
        />
        <StatCard label={d.common.active} value={formatNumber(countFor('ACTIVE'), locale)} tone="success" />
        <StatCard label={d.common.disabled} value={formatNumber(countFor('DISABLED'), locale)} />
        <StatCard
          label={d.account.marketingOptIn}
          value={formatNumber(optedIn, locale)}
          sub={d.admin.marketingConsentNote}
          tone="accent"
        />
      </div>

      {!showContact ? (
        <Alert tone="info" className="mb-4" title={d.admin.contactMasked}>
          {d.admin.contactMaskedNote}
        </Alert>
      ) : null}

      <Suspense fallback={<Spinner />}>
        <div className="mb-4 space-y-3">
          <FilterPills
            paramName="status"
            options={[
              { value: 'all', label: d.common.all, count: countFor('all') },
              { value: 'ACTIVE', label: d.common.active, count: countFor('ACTIVE') },
              { value: 'DISABLED', label: d.common.disabled, count: countFor('DISABLED') },
            ]}
          />
          <TableSearch placeholder={`${d.common.name} / ${d.common.phone} / ${d.common.email}`} />
        </div>
      </Suspense>

      <DataTable
        isEmpty={customers.length === 0}
        empty={d.admin.emptyTable}
        head={
          <>
            <Th>{d.common.name}</Th>
            <Th>{d.common.phone}</Th>
            <Th align="center">{d.admin.totalOrders}</Th>
            <Th align="right">{d.account.totalSpent}</Th>
            <Th align="center">{d.admin.prescriptions}</Th>
            <Th>{d.admin.lastOrder}</Th>
            <Th>{d.admin.customerSince}</Th>
            <Th>{d.common.status}</Th>
          </>
        }
      >
        {customers.map((customer) => {
          const stats = spendByUser.get(customer.id)
          return (
            <Tr key={customer.id} href={`/admin/customers/${customer.id}`}>
              <Td>
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="block max-w-[200px] truncate font-medium text-ink-900 hover:text-brand-700"
                >
                  {customer.fullName}
                </Link>
                <span className="block truncate text-xs text-ink-400">
                  {showContact ? (customer.email ?? '—') : maskEmail(customer.email)}
                </span>
              </Td>
              <Td className="text-xs tabular">
                {showContact ? customer.phone : maskPhone(customer.phone)}
                {!showContact ? <Lock className="ml-1 inline h-3 w-3 text-ink-300" aria-hidden /> : null}
              </Td>
              <Td align="center" className="tabular">
                {customer._count.orders}
              </Td>
              <Td align="right" className="font-semibold tabular">
                {formatMnt(stats?._sum.total ?? 0, locale)}
              </Td>
              <Td align="center" className="tabular">
                {customer._count.prescriptions}
              </Td>
              <Td className="text-xs text-ink-500">
                {stats?._max.createdAt ? formatDate(stats._max.createdAt, locale) : '—'}
              </Td>
              <Td className="text-xs text-ink-500">{formatDate(customer.createdAt, locale)}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={customer.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {customer.status === 'ACTIVE' ? d.common.active : d.common.disabled}
                  </Badge>
                  {customer.marketingOptIn ? <Badge tone="accent">✉</Badge> : null}
                </div>
              </Td>
            </Tr>
          )
        })}
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
