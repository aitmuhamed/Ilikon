import Link from 'next/link'
import { Suspense } from 'react'
import { Download, Package, Plus } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/shell'
import {
  DataTable,
  FilterPills,
  ParamSelect,
  TablePagination,
  TableSearch,
  Td,
  Th,
  Tr,
} from '@/components/admin/table'
import { Badge, PRODUCT_STATUS_TONE, Spinner } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { mediaUrl } from '@/lib/storage'
import { daysUntil, formatDate, formatMnt } from '@/lib/utils'

const PER_PAGE = 20

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
    rx?: string
    category?: string
  }>
}) {
  const session = (await getSession())!
  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams
  const settings = await getSettings()

  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const search = (query.q ?? '').trim()

  const where = {
    ...(query.status && query.status !== 'all'
      ? { status: query.status as never, deletedAt: query.status === 'ARCHIVED' ? undefined : null }
      : { deletedAt: null }),
    ...(query.rx === 'rx' ? { prescriptionRequired: true } : {}),
    ...(query.rx === 'otc' ? { prescriptionRequired: false } : {}),
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
            { barcode: { contains: search } },
            { translations: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
          ],
        }
      : {}),
  }

  const [total, products, statusCounts, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: { where: { isPrimary: true }, select: { fileKey: true }, take: 1 },
        inventory: { select: { quantity: true, lowStockThreshold: true } },
        _count: { select: { orderItems: true, reviews: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.category.findMany({
      where: { deletedAt: null },
      select: { slug: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const countFor = (value: string) =>
    value === 'all'
      ? statusCounts.reduce((sum, row) => sum + row._count._all, 0)
      : (statusCounts.find((row) => row.status === value)?._count._all ?? 0)

  return (
    <>
      <AdminPageHeader
        title={d.admin.products}
        subtitle={`${total} ${d.common.results}`}
        actions={
          <>
            {can(session, 'reports.export') ? (
              <a href="/api/reports/export?type=inventory" download>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" aria-hidden />
                  {d.admin.exportCsv}
                </Button>
              </a>
            ) : null}
            {can(session, 'products.create') ? (
              <Link href="/admin/products/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" aria-hidden />
                  {d.admin.newProduct}
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <Suspense fallback={<Spinner />}>
        <div className="mb-4 space-y-3">
          <FilterPills
            paramName="status"
            options={[
              { value: 'all', label: d.common.all, count: countFor('all') },
              { value: 'ACTIVE', label: d.common.active, count: countFor('ACTIVE') },
              { value: 'DRAFT', label: 'DRAFT', count: countFor('DRAFT') },
              { value: 'INACTIVE', label: d.common.inactive, count: countFor('INACTIVE') },
              { value: 'ARCHIVED', label: d.admin.archived, count: countFor('ARCHIVED') },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <TableSearch placeholder={`${d.common.name} / SKU / ${d.product.barcode}`} />
            <ParamSelect
              paramName="rx"
              label={d.search.filterPrescription}
              options={[
                { value: 'all', label: d.search.filterPrescription },
                { value: 'rx', label: d.product.prescriptionRequired },
                { value: 'otc', label: d.product.otc },
              ]}
            />
            <ParamSelect
              paramName="category"
              label={d.product.category}
              options={[
                { value: '', label: d.product.category },
                ...categories.map((category) => ({ value: category.slug, label: category.name })),
              ]}
            />
          </div>
        </div>
      </Suspense>

      <DataTable
        isEmpty={products.length === 0}
        empty={d.admin.emptyTable}
        head={
          <>
            <Th className="w-14" />
            <Th>{d.common.name}</Th>
            <Th>SKU</Th>
            <Th>{d.product.category}</Th>
            <Th align="right">{d.common.price}</Th>
            <Th align="center">{d.admin.currentStock}</Th>
            <Th align="center">{d.search.filterPrescription}</Th>
            <Th>{d.common.status}</Th>
            <Th>{d.product.expiryDate}</Th>
            <Th align="right">{d.common.actions}</Th>
          </>
        }
      >
        {products.map((product) => {
          const quantity = product.inventory?.quantity ?? 0
          const threshold = product.inventory?.lowStockThreshold ?? settings.lowStockThreshold
          const days = daysUntil(product.expiryDate)
          const expired = days !== null && days <= 0
          const expiringSoon = days !== null && days > 0 && days <= settings.expiryWarningDays

          return (
            <Tr key={product.id}>
              <Td>
                <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-ink-50">
                  {mediaUrl(product.images[0]?.fileKey) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(product.images[0]!.fileKey)!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-4 w-4 text-ink-300" aria-hidden />
                  )}
                </span>
              </Td>
              <Td>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="block max-w-[240px] truncate font-medium text-ink-900 hover:text-brand-700"
                >
                  {product.name}
                </Link>
                <span className="block text-xs text-ink-400">
                  {product.brand?.name ?? '—'}
                  {product._count.orderItems > 0 ? ` · ${product._count.orderItems} sold` : ''}
                </span>
              </Td>
              <Td className="text-xs tabular">{product.sku}</Td>
              <Td className="text-xs">{product.category.name}</Td>
              <Td align="right">
                <span className="font-semibold text-ink-900 tabular">
                  {formatMnt(product.discountPrice ?? product.price, locale)}
                </span>
                {product.discountPrice ? (
                  <span className="block text-xs text-ink-400 line-through tabular">
                    {formatMnt(product.price, locale)}
                  </span>
                ) : null}
              </Td>
              <Td align="center">
                <span
                  className={
                    quantity === 0
                      ? 'font-bold text-danger tabular'
                      : quantity <= threshold
                        ? 'font-bold text-warning tabular'
                        : 'font-medium text-ink-900 tabular'
                  }
                >
                  {quantity}
                </span>
              </Td>
              <Td align="center">
                <Badge tone={product.prescriptionRequired ? 'rx' : 'otc'}>
                  {product.prescriptionRequired
                    ? d.product.prescriptionRequiredShort
                    : d.product.otcShort}
                </Badge>
              </Td>
              <Td>
                <Badge tone={PRODUCT_STATUS_TONE[product.status] ?? 'neutral'}>
                  {product.status === 'ACTIVE'
                    ? d.common.active
                    : product.status === 'INACTIVE'
                      ? d.common.inactive
                      : product.status === 'ARCHIVED'
                        ? d.admin.archived
                        : 'DRAFT'}
                </Badge>
              </Td>
              <Td>
                {product.expiryDate ? (
                  <span
                    className={
                      expired
                        ? 'text-xs font-semibold text-danger'
                        : expiringSoon
                          ? 'text-xs font-semibold text-warning'
                          : 'text-xs text-ink-500'
                    }
                  >
                    {formatDate(product.expiryDate, locale)}
                    {expired ? ` · ${d.admin.expiredAlert}` : ''}
                    {expiringSoon ? ` · ${days} ${d.admin.daysLeft}` : ''}
                  </span>
                ) : (
                  <span className="text-xs text-ink-300">—</span>
                )}
              </Td>
              <Td align="right">
                <Link href={`/admin/products/${product.id}`}>
                  <Button size="sm" variant="outline">
                    {d.common.edit}
                  </Button>
                </Link>
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
