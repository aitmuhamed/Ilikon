import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { ReviewModeration, type ReviewRow } from '@/components/admin/commerce-client'
import { FilterPills } from '@/components/admin/table'
import { Spinner } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatNumber } from '@/lib/utils'

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'reviews.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const status = (await searchParams).status ?? 'PENDING'

  const [rows, counts] = await Promise.all([
    prisma.review.findMany({
      where: {
        deletedAt: null,
        ...(status !== 'all' ? { status: status as never } : {}),
      },
      include: {
        product: { select: { id: true, name: true, slug: true, sku: true } },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 60,
    }),
    prisma.review.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
  ])

  const countFor = (value: string) =>
    value === 'all'
      ? counts.reduce((sum, row) => sum + row._count._all, 0)
      : (counts.find((row) => row.status === value)?._count._all ?? 0)

  const reviews: ReviewRow[] = rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    status: row.status,
    isVerifiedBuyer: row.isVerifiedBuyer,
    createdAt: row.createdAt.toISOString(),
    product: row.product,
    user: row.user,
  }))

  return (
    <>
      <AdminPageHeader
        title={d.admin.reviews}
        subtitle={`${countFor('PENDING')} ${d.prescription.statusPENDING}`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label={d.prescription.statusPENDING}
          value={formatNumber(countFor('PENDING'), locale)}
          tone={countFor('PENDING') > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label={d.common.active}
          value={formatNumber(countFor('APPROVED'), locale)}
          tone="success"
        />
        <StatCard label={d.admin.hideReview} value={formatNumber(countFor('HIDDEN'), locale)} />
      </div>

      <Suspense fallback={<Spinner />}>
        <FilterPills
          className="mb-4"
          paramName="status"
          options={[
            { value: 'PENDING', label: d.prescription.statusPENDING, count: countFor('PENDING') },
            { value: 'APPROVED', label: d.common.active, count: countFor('APPROVED') },
            { value: 'HIDDEN', label: d.admin.hideReview, count: countFor('HIDDEN') },
            { value: 'all', label: d.common.all, count: countFor('all') },
          ]}
        />
      </Suspense>

      <ReviewModeration reviews={reviews} canModerate={can(session, 'reviews.moderate')} />
    </>
  )
}
