import { notFound } from 'next/navigation'

import { AdminPageHeader } from '@/components/admin/shell'
import { PromotionManager, type PromotionRow } from '@/components/admin/commerce-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mediaUrl } from '@/lib/storage'

export default async function AdminPromotionsPage() {
  const session = (await getSession())!
  if (!can(session, 'promotions.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)

  const [rows, categories] = await Promise.all([
    prisma.promotion.findMany({
      include: { translations: true },
      orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const promotions: PromotionRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageKey: mediaUrl(row.imageKey),
    linkUrl: row.linkUrl,
    placement: row.placement,
    badgeText: row.badgeText,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    categoryId: row.categoryId,
    productId: row.productId,
    translations: Object.fromEntries(
      row.translations.map((translation) => [
        translation.locale,
        { title: translation.title, subtitle: translation.subtitle ?? '' },
      ]),
    ),
  }))

  return (
    <>
      <AdminPageHeader
        title={d.admin.promotions}
        subtitle={`${promotions.length} ${d.common.results}`}
      />
      <PromotionManager
        promotions={promotions}
        categories={categories}
        canManage={can(session, 'promotions.manage')}
      />
    </>
  )
}
