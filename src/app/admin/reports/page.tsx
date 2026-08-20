import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download, Search, TrendingUp } from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { BarChart, ChartCard, DonutChart, LineChart, RankedBars } from '@/components/admin/charts'
import { DateRangeFilter, DataTable, Td, Th, Tr } from '@/components/admin/table'
import { Card, Spinner } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import {
  getCustomerGrowth,
  getDashboardOverview,
  getOrderStatusBreakdown,
  getPaymentMethodBreakdown,
  getSalesByCategory,
  getSalesTimeSeries,
  getTopCustomers,
  getTopProducts,
  resolveRange,
} from '@/lib/reports'
import { getFunnelMetrics, getTopSearches } from '@/lib/analytics'
import { formatMnt, formatNumber, maskEmail, maskPhone } from '@/lib/utils'

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'reports.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams
  const range = resolveRange(query.range ?? '30d', query.from, query.to)
  const rangeLabel = d.admin[range.label as keyof typeof d.admin] as string

  const [
    overview,
    series,
    topProducts,
    byCategory,
    payments,
    growth,
    statusBreakdown,
    topCustomers,
    funnel,
    searches,
  ] = await Promise.all([
    getDashboardOverview(range),
    getSalesTimeSeries(range),
    getTopProducts(range, 12),
    getSalesByCategory(range, 8),
    getPaymentMethodBreakdown(range),
    getCustomerGrowth(range),
    getOrderStatusBreakdown(),
    getTopCustomers(range, 10),
    getFunnelMetrics(range.from, range.to),
    getTopSearches(range.from, range.to, 10),
  ])

  const showContact = can(session, 'customers.viewContact')
  const exportBase = `range=${range.key}${
    range.key === 'custom' ? `&from=${query.from ?? ''}&to=${query.to ?? ''}` : ''
  }`

  const exports = [
    { type: 'sales', label: d.admin.salesReport },
    { type: 'orders', label: d.admin.orders },
    { type: 'products', label: d.admin.productReport },
    { type: 'customers', label: d.admin.customerReport },
    { type: 'inventory', label: d.admin.inventoryReport },
  ]

  return (
    <>
      <AdminPageHeader
        title={d.admin.reports}
        subtitle={`${rangeLabel} · ${range.from.toISOString().slice(0, 10)} → ${range.to
          .toISOString()
          .slice(0, 10)}`}
      />

      <Suspense fallback={<Spinner />}>
        <DateRangeFilter className="mb-5" />
      </Suspense>

      {/* Export row */}
      {can(session, 'reports.export') ? (
        <Card className="mb-5">
          <h2 className="mb-2.5 text-sm font-semibold text-ink-900">{d.admin.exportData}</h2>
          <div className="flex flex-wrap gap-2">
            {exports.map((item) => (
              <a key={item.type} href={`/api/reports/export?type=${item.type}&${exportBase}`} download>
                <Button variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  {item.label}
                </Button>
              </a>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-400">
            {showContact ? '' : d.admin.contactMaskedNote}
          </p>
        </Card>
      ) : null}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.admin.totalSales}
          value={formatMnt(overview.rangeSales, locale)}
          sub={rangeLabel}
          tone="brand"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard label={d.admin.totalOrders} value={formatNumber(overview.rangeOrders, locale)} sub={rangeLabel} />
        <StatCard label={d.admin.avgOrderValue} value={formatMnt(overview.avgOrderValue, locale)} />
        <StatCard
          label={d.admin.conversionRate}
          value={`${funnel.conversionRate}%`}
          sub={`${formatNumber(funnel.productViews, locale)} → ${formatNumber(
            funnel.ordersCompleted,
            locale,
          )}`}
          tone="accent"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard title={d.admin.salesOverTime} subtitle={rangeLabel} className="lg:col-span-2">
          <LineChart
            data={series.map((point) => ({
              label: point.date,
              value: point.sales,
              secondary: point.orders,
            }))}
            locale={locale}
            height={260}
            secondaryKey={d.admin.ordersOverTime}
            labels={{ primary: d.admin.salesOverTime, secondary: d.admin.ordersOverTime }}
          />
        </ChartCard>

        <ChartCard title={d.admin.salesByCategory} subtitle={rangeLabel}>
          <DonutChart
            data={byCategory.map((row) => ({ label: row.name, value: row.revenue }))}
            locale={locale}
            centreLabel={d.admin.totalSales}
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title={d.admin.paymentMethods} subtitle={rangeLabel}>
          <DonutChart
            data={payments.map((row) => ({
              label: d.paymentMethod[row.method],
              value: row.amount,
            }))}
            locale={locale}
            centreLabel={d.cart.total}
          />
        </ChartCard>

        <ChartCard title={d.admin.customerGrowth} subtitle={rangeLabel}>
          <BarChart
            data={growth.map((point) => ({ label: point.date, value: point.count }))}
            valueFormat="number"
            locale={locale}
            height={200}
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title={d.admin.topProducts} subtitle={rangeLabel}>
          <RankedBars
            data={topProducts.map((product) => ({
              label: product.name,
              value: product.revenue,
              sub: `${product.quantity}`,
            }))}
            locale={locale}
            emptyLabel={d.admin.emptyTable}
          />
        </ChartCard>

        <ChartCard title={d.admin.ordersOverTime} subtitle={d.common.status}>
          <RankedBars
            data={statusBreakdown.map((row) => ({
              label: d.orderStatus[row.status],
              value: row.count,
            }))}
            valueFormat="number"
            locale={locale}
            emptyLabel={d.admin.emptyTable}
          />
        </ChartCard>
      </div>

      {/* Search terms */}
      <ChartCard
        title={d.search.title}
        subtitle={`${formatNumber(funnel.searches, locale)} ${d.common.results}`}
        className="mt-4"
        action={<Search className="h-4 w-4 text-ink-400" aria-hidden />}
      >
        {searches.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
        ) : (
          <RankedBars
            data={searches.map((row) => ({ label: row.term, value: row.count }))}
            valueFormat="number"
            locale={locale}
          />
        )}
      </ChartCard>

      {/* Top customers */}
      <div className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.customerReport}</h2>
        <DataTable
          isEmpty={topCustomers.length === 0}
          empty={d.admin.emptyTable}
          head={
            <>
              <Th>{d.common.name}</Th>
              {showContact ? <Th>{d.common.phone}</Th> : null}
              <Th align="center">{d.admin.totalOrders}</Th>
              <Th align="right">{d.account.totalSpent}</Th>
            </>
          }
        >
          {topCustomers.map((customer) => (
            <Tr key={customer.userId} href={`/admin/customers/${customer.userId}`}>
              <Td className="font-medium text-ink-900">{customer.name}</Td>
              {showContact ? (
                <Td className="text-xs tabular">
                  {customer.phone} · {maskEmail(customer.email)}
                </Td>
              ) : null}
              <Td align="center" className="tabular">
                {customer.orders}
              </Td>
              <Td align="right" className="font-bold tabular">
                {formatMnt(customer.revenue, locale)}
              </Td>
            </Tr>
          ))}
        </DataTable>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
        {d.admin.marketingConsentNote} {maskPhone('')}
      </p>
    </>
  )
}
