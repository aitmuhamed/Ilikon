import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { BarChart, ChartCard, DonutChart, LineChart, RankedBars } from '@/components/admin/charts'
import { DateRangeFilter } from '@/components/admin/table'
import { Alert, Badge, Card, ORDER_STATUS_TONE, Spinner } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import {
  getCustomerGrowth,
  getDashboardOverview,
  getPaymentMethodBreakdown,
  getSalesByCategory,
  getSalesTimeSeries,
  getTopProducts,
  resolveRange,
} from '@/lib/reports'
import { getFunnelMetrics } from '@/lib/analytics'
import { getInventoryAlerts } from '@/lib/inventory'
import { prisma } from '@/lib/prisma'
import { formatDateTime, formatMnt, formatNumber } from '@/lib/utils'

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'dashboard.view')) {
    // Delivery staff land straight on their own queue.
    redirect(can(session, 'delivery.own') ? '/admin/delivery' : '/mn')
  }

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams
  const range = resolveRange(query.range ?? '30d', query.from, query.to)

  const [overview, series, topProducts, byCategory, payments, growth, funnel, alerts, recentOrders] =
    await Promise.all([
      getDashboardOverview(range),
      getSalesTimeSeries(range),
      getTopProducts(range, 6),
      getSalesByCategory(range, 6),
      getPaymentMethodBreakdown(range),
      getCustomerGrowth(range),
      getFunnelMetrics(range.from, range.to),
      getInventoryAlerts(),
      prisma.order.findMany({
        include: {
          payment: { select: { method: true, status: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ])

  const rangeLabel = d.admin[range.label as keyof typeof d.admin] as string

  return (
    <>
      <AdminPageHeader
        title={d.admin.dashboard}
        subtitle={`${rangeLabel} · ${formatDateTime(new Date(), locale)}`}
        actions={
          can(session, 'reports.view') ? (
            <Link href="/admin/reports">
              <Button variant="outline" size="sm">
                <TrendingUp className="h-4 w-4" aria-hidden />
                {d.admin.reports}
              </Button>
            </Link>
          ) : null
        }
      />

      <Suspense fallback={<Spinner />}>
        <DateRangeFilter className="mb-5" />
      </Suspense>

      {/* Attention row — anything that needs a human today */}
      {(overview.prescriptionQueue > 0 ||
        alerts.expired.length > 0 ||
        overview.lowStockCount > 0 ||
        overview.unpaidPayments > 0) ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {overview.prescriptionQueue > 0 && can(session, 'prescriptions.view') ? (
            <StatCard
              label={d.admin.prescriptionQueue}
              value={formatNumber(overview.prescriptionQueue, locale)}
              sub={d.prescription.awaitingVerification}
              tone="warning"
              icon={<FileText className="h-4 w-4" />}
              href="/admin/prescriptions"
            />
          ) : null}
          {alerts.expired.length > 0 && can(session, 'inventory.view') ? (
            <StatCard
              label={d.admin.expiredAlert}
              value={formatNumber(alerts.expired.length, locale)}
              sub={d.validation.expiredProduct}
              tone="danger"
              icon={<XCircle className="h-4 w-4" />}
              href="/admin/inventory?filter=expired"
            />
          ) : null}
          {overview.lowStockCount > 0 && can(session, 'inventory.view') ? (
            <StatCard
              label={d.admin.lowStockProducts}
              value={formatNumber(overview.lowStockCount, locale)}
              sub={d.admin.lowStockAlert}
              tone="warning"
              icon={<ClipboardList className="h-4 w-4" />}
              href="/admin/inventory?filter=low"
            />
          ) : null}
          {overview.unpaidPayments > 0 && can(session, 'payments.view') ? (
            <StatCard
              label={d.admin.payments}
              value={formatNumber(overview.unpaidPayments, locale)}
              sub={d.paymentStatus.PENDING}
              tone="accent"
              icon={<CreditCard className="h-4 w-4" />}
              href="/admin/payments"
            />
          ) : null}
        </div>
      ) : null}

      {/* Sales KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.admin.totalSales}
          value={formatMnt(overview.totalSales, locale)}
          sub={`${d.admin.totalOrders}: ${formatNumber(overview.totalOrders, locale)}`}
          tone="brand"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label={d.admin.todaySales}
          value={formatMnt(overview.todaySales, locale)}
          sub={d.admin.today}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label={d.admin.monthSales}
          value={formatMnt(overview.monthSales, locale)}
          sub={d.admin.thisMonth}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label={d.admin.avgOrderValue}
          value={formatMnt(overview.avgOrderValue, locale)}
          sub={`${rangeLabel} · ${formatNumber(overview.rangeOrders, locale)} ${d.cart.items}`}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
      </div>

      {/* Order + customer KPIs */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.admin.pendingOrders}
          value={formatNumber(overview.pendingOrders, locale)}
          tone="accent"
          icon={<ShoppingCart className="h-4 w-4" />}
          href={can(session, 'orders.view') ? '/admin/orders?status=NEW' : undefined}
        />
        <StatCard
          label={d.admin.completedOrders}
          value={formatNumber(overview.completedOrders, locale)}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
          href={can(session, 'orders.view') ? '/admin/orders?status=DELIVERED' : undefined}
        />
        <StatCard
          label={d.admin.cancelledOrders}
          value={formatNumber(overview.cancelledOrders, locale)}
          icon={<XCircle className="h-4 w-4" />}
          href={can(session, 'orders.view') ? '/admin/orders?status=CANCELLED' : undefined}
        />
        <StatCard
          label={d.admin.totalCustomers}
          value={formatNumber(overview.totalCustomers, locale)}
          sub={`+${formatNumber(overview.newCustomers, locale)} · ${rangeLabel}`}
          icon={<Users className="h-4 w-4" />}
          href={can(session, 'customers.view') ? '/admin/customers' : undefined}
        />
      </div>

      {/* Charts */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title={d.admin.salesOverTime}
          subtitle={rangeLabel}
          className="lg:col-span-2"
          action={
            <span className="text-lg font-extrabold text-brand-700 tabular">
              {formatMnt(overview.rangeSales, locale)}
            </span>
          }
        >
          <LineChart
            data={series.map((point) => ({
              label: point.date,
              value: point.sales,
              secondary: point.orders,
            }))}
            locale={locale}
            secondaryKey={d.admin.ordersOverTime}
            labels={{ primary: d.admin.salesOverTime, secondary: d.admin.ordersOverTime }}
          />
        </ChartCard>

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
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title={d.admin.ordersOverTime} subtitle={rangeLabel}>
          <BarChart
            data={series.map((point) => ({ label: point.date, value: point.orders }))}
            valueFormat="number"
            locale={locale}
            height={200}
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
        <ChartCard
          title={d.admin.topProducts}
          subtitle={rangeLabel}
          action={
            can(session, 'products.view') ? (
              <Link href="/admin/products" className="text-xs font-medium text-brand-700 hover:underline">
                {d.common.viewAll} →
              </Link>
            ) : null
          }
        >
          <RankedBars
            data={topProducts.map((product) => ({
              label: product.name,
              value: product.revenue,
              sub: `${product.quantity} ${d.cart.items}`,
            }))}
            locale={locale}
            emptyLabel={d.admin.emptyTable}
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

      {/* Conversion funnel */}
      {can(session, 'reports.view') ? (
        <ChartCard
          title={d.admin.conversionRate}
          subtitle={rangeLabel}
          className="mt-4"
          action={
            <span className="text-lg font-extrabold text-brand-700 tabular">
              {funnel.conversionRate}%
            </span>
          }
        >
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: 'product_viewed', value: funnel.productViews, next: `${funnel.viewToCartRate}%` },
              { label: 'add_to_cart', value: funnel.addToCart, next: `${funnel.cartToCheckoutRate}%` },
              { label: 'checkout_started', value: funnel.checkoutStarted, next: `${funnel.checkoutToOrderRate}%` },
              { label: 'order_completed', value: funnel.ordersCompleted, next: null },
            ].map((step) => (
              <div key={step.label} className="rounded-xl border border-ink-200 p-3.5">
                <p className="text-[11px] font-medium text-ink-500">{step.label}</p>
                <p className="mt-1 text-xl font-extrabold text-ink-900 tabular">
                  {formatNumber(step.value, locale)}
                </p>
                {step.next ? (
                  <p className="mt-0.5 text-[11px] text-brand-600 tabular">→ {step.next}</p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
            {d.admin.marketingConsentNote}
          </p>
        </ChartCard>
      ) : null}

      {/* Recent orders + alerts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {can(session, 'orders.view') ? (
          <Card className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">{d.admin.recentOrders}</h3>
              <Link href="/admin/orders" className="text-xs font-medium text-brand-700 hover:underline">
                {d.common.viewAll} →
              </Link>
            </div>
            <ul className="divide-y divide-ink-100">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 transition-colors hover:bg-brand-50/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900 tabular">{order.orderNumber}</p>
                      <p className="truncate text-xs text-ink-500">
                        {order.customerName} · {order._count.items} {d.cart.items} ·{' '}
                        {formatDateTime(order.createdAt, locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.requiresPrescription && !order.prescriptionCleared ? (
                        <Badge tone="warning">{d.product.prescriptionRequiredShort}</Badge>
                      ) : null}
                      <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                        {d.orderStatus[order.status]}
                      </Badge>
                      <span className="w-24 text-right text-sm font-bold text-ink-900 tabular">
                        {formatMnt(order.total, locale)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
              {recentOrders.length === 0 ? (
                <li className="py-8 text-center text-sm text-ink-400">{d.admin.emptyTable}</li>
              ) : null}
            </ul>
          </Card>
        ) : null}

        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
            {d.admin.alerts}
          </h3>

          <div className="space-y-3">
            {alerts.expired.length > 0 ? (
              <Alert tone="danger" title={`${d.admin.expiredAlert} (${alerts.expired.length})`}>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {alerts.expired.slice(0, 3).map((item) => (
                    <li key={item.productId} className="truncate">
                      {item.name} · {item.sku}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] font-semibold">{d.validation.expiredProduct}</p>
              </Alert>
            ) : null}

            {alerts.expiring.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  {d.admin.expiringAlert} ({alerts.expiring.length})
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-900/90">
                  {alerts.expiring.slice(0, 4).map((item) => (
                    <li key={item.productId} className="flex justify-between gap-2">
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0 tabular">
                        {item.daysLeft} {d.admin.daysLeft}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {alerts.lowStock.length > 0 ? (
              <div className="rounded-xl border border-ink-200 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
                  <Package className="h-3.5 w-3.5 text-ink-500" aria-hidden />
                  {d.admin.lowStockAlert} ({alerts.lowStock.length})
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-ink-600">
                  {alerts.lowStock.slice(0, 5).map((item) => (
                    <li key={item.productId} className="flex justify-between gap-2">
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0 font-semibold text-danger tabular">{item.quantity}</span>
                    </li>
                  ))}
                </ul>
                {can(session, 'inventory.view') ? (
                  <Link
                    href="/admin/inventory?filter=low"
                    className="mt-2 block text-xs font-medium text-brand-700 hover:underline"
                  >
                    {d.common.viewAll} →
                  </Link>
                ) : null}
              </div>
            ) : null}

            {alerts.expired.length === 0 &&
            alerts.expiring.length === 0 &&
            alerts.lowStock.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
                <p className="mt-2 text-sm text-ink-500">{d.common.none}</p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  )
}
