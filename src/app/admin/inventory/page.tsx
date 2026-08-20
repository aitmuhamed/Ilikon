import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download } from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { FilterPills, TablePagination, TableSearch } from '@/components/admin/table'
import {
  InventoryAlertPanel,
  InventoryTable,
  type InventoryRow,
} from '@/components/admin/inventory-client'
import { Spinner } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { getInventoryAlerts } from '@/lib/inventory'
import { formatNumber } from '@/lib/utils'

const PER_PAGE = 25

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; filter?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'inventory.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams
  const settings = await getSettings()

  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const search = (query.q ?? '').trim()
  const filter = query.filter ?? 'all'

  const now = new Date()
  const horizon = new Date(now.getTime() + settings.expiryWarningDays * 86_400_000)

  const where = {
    deletedAt: null,
    status: { not: 'ARCHIVED' as const },
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
            { barcode: { contains: search } },
          ],
        }
      : {}),
    ...(filter === 'expiring' ? { expiryDate: { gt: now, lte: horizon } } : {}),
    ...(filter === 'expired' ? { expiryDate: { lte: now } } : {}),
    ...(filter === 'low'
      ? { inventory: { quantity: { lte: settings.lowStockThreshold } } }
      : {}),
    ...(filter === 'out' ? { inventory: { quantity: 0 } } : {}),
  }

  const [total, rows, alerts, valuation] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        prescriptionRequired: true,
        expiryDate: true,
        category: { select: { name: true } },
        inventory: { select: { quantity: true, lowStockThreshold: true, shelfLocation: true } },
      },
      orderBy: filter === 'all' ? { name: 'asc' } : { expiryDate: 'asc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    getInventoryAlerts(),
    prisma.product.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { price: true, costPrice: true, inventory: { select: { quantity: true } } },
    }),
  ])

  const totalUnits = valuation.reduce((sum, product) => sum + (product.inventory?.quantity ?? 0), 0)
  const retailValue = valuation.reduce(
    (sum, product) => sum + product.price * (product.inventory?.quantity ?? 0),
    0,
  )

  const items: InventoryRow[] = rows.map((row) => {
    const quantity = row.inventory?.quantity ?? 0
    const threshold = row.inventory?.lowStockThreshold || settings.lowStockThreshold
    const daysToExpiry = row.expiryDate
      ? Math.ceil((row.expiryDate.getTime() - now.getTime()) / 86_400_000)
      : null
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      categoryName: row.category.name,
      quantity,
      lowStockThreshold: threshold,
      shelfLocation: row.inventory?.shelfLocation ?? null,
      expiryDate: row.expiryDate ? row.expiryDate.toISOString() : null,
      daysToExpiry,
      prescriptionRequired: row.prescriptionRequired,
      isLowStock: quantity <= threshold,
      isExpired: daysToExpiry !== null && daysToExpiry <= 0,
      isExpiringSoon:
        daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= settings.expiryWarningDays,
    }
  })

  return (
    <>
      <AdminPageHeader
        title={d.admin.inventory}
        subtitle={`${total} ${d.common.results}`}
        actions={
          can(session, 'reports.export') ? (
            <a href="/api/reports/export?type=inventory" download>
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
          label={d.admin.currentStock}
          value={formatNumber(totalUnits, locale)}
          sub={`${valuation.length} ${d.admin.productCount.toLowerCase()}`}
          tone="brand"
        />
        <StatCard
          label={d.admin.inventoryReport}
          value={`${formatNumber(Math.round(retailValue / 1000), locale)}k₮`}
          sub={d.common.price}
        />
        <StatCard
          label={d.admin.lowStockProducts}
          value={formatNumber(alerts.lowStock.length, locale)}
          tone={alerts.lowStock.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label={d.admin.expiredAlert}
          value={formatNumber(alerts.expired.length, locale)}
          tone={alerts.expired.length > 0 ? 'danger' : 'default'}
        />
      </div>

      <InventoryAlertPanel
        expired={alerts.expired.map((item) => ({
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          expiryDate: item.expiryDate.toISOString(),
        }))}
        expiring={alerts.expiring.map((item) => ({
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          expiryDate: item.expiryDate.toISOString(),
          daysLeft: item.daysLeft,
        }))}
        canAdjust={can(session, 'inventory.adjust')}
      />

      <Suspense fallback={<Spinner />}>
        <div className="mb-4 space-y-3">
          <FilterPills
            paramName="filter"
            options={[
              { value: 'all', label: d.common.all },
              { value: 'low', label: d.admin.lowStockAlert, count: alerts.lowStock.length },
              { value: 'out', label: d.product.outOfStock },
              { value: 'expiring', label: d.admin.expiringAlert, count: alerts.expiring.length },
              { value: 'expired', label: d.admin.expiredAlert, count: alerts.expired.length },
            ]}
          />
          <TableSearch placeholder={`${d.common.name} / SKU / ${d.product.barcode}`} />
        </div>
      </Suspense>

      <InventoryTable
        items={items}
        canAdjust={can(session, 'inventory.adjust')}
        lowStockDefault={settings.lowStockThreshold}
      />

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
