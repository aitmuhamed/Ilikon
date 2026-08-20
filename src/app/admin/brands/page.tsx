import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { AdminPageHeader } from '@/components/admin/shell'
import { BrandManager, type BrandRow } from '@/components/admin/taxonomy-client'
import { TableSearch } from '@/components/admin/table'
import { Spinner } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mediaUrl } from '@/lib/storage'

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'brands.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const search = ((await searchParams).q ?? '').trim()

  const rows = await prisma.brand.findMany({
    where: {
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  })

  const brands: BrandRow[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoKey: mediaUrl(row.logoKey),
    description: row.description,
    country: row.country,
    website: row.website,
    isActive: row.isActive,
    productCount: row._count.products,
  }))

  return (
    <>
      <AdminPageHeader title={d.admin.brands} subtitle={`${brands.length} ${d.common.results}`} />
      <Suspense fallback={<Spinner />}>
        <div className="mb-4">
          <TableSearch placeholder={d.admin.brands} />
        </div>
      </Suspense>
      <BrandManager brands={brands} canManage={can(session, 'brands.manage')} />
    </>
  )
}
