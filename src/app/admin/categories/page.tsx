import { notFound } from 'next/navigation'

import { AdminPageHeader } from '@/components/admin/shell'
import { CategoryManager, type CategoryRow } from '@/components/admin/taxonomy-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mediaUrl } from '@/lib/storage'

export default async function AdminCategoriesPage() {
  const session = (await getSession())!
  if (!can(session, 'categories.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)

  const rows = await prisma.category.findMany({
    where: { deletedAt: null },
    include: {
      translations: true,
      _count: { select: { products: true, children: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const categories: CategoryRow[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    parentId: row.parentId,
    imageKey: mediaUrl(row.imageKey),
    icon: row.icon,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    isFeatured: row.isFeatured,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    productCount: row._count.products,
    childCount: row._count.children,
    translations: Object.fromEntries(
      row.translations.map((translation) => [
        translation.locale,
        { name: translation.name, description: translation.description ?? '' },
      ]),
    ),
  }))

  return (
    <>
      <AdminPageHeader
        title={d.admin.categories}
        subtitle={`${categories.length} ${d.common.results}`}
      />
      <CategoryManager categories={categories} canManage={can(session, 'categories.manage')} />
    </>
  )
}
