import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { AdminPageHeader } from '@/components/admin/shell'
import { CouponManager, type CouponRow } from '@/components/admin/commerce-client'
import { TableSearch } from '@/components/admin/table'
import { Spinner } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'coupons.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const search = ((await searchParams).q ?? '').trim().toUpperCase()

  const rows = await prisma.coupon.findMany({
    where: { deletedAt: null, ...(search ? { code: { contains: search } } : {}) },
    include: { _count: { select: { redemptions: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const now = new Date()
  const coupons: CouponRow[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    discountValue: row.discountValue,
    minOrderAmount: row.minOrderAmount,
    maxDiscountAmount: row.maxDiscountAmount,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    usageLimit: row.usageLimit,
    perCustomerLimit: row.perCustomerLimit,
    usedCount: row.usedCount,
    isActive: row.isActive,
    redemptionCount: row._count.redemptions,
    isExpired: row.endsAt < now,
    isScheduled: row.startsAt > now,
    isExhausted: row.usageLimit !== null && row.usedCount >= row.usageLimit,
  }))

  return (
    <>
      <AdminPageHeader title={d.admin.coupons} subtitle={`${coupons.length} ${d.common.results}`} />
      <Suspense fallback={<Spinner />}>
        <div className="mb-4">
          <TableSearch placeholder={d.admin.couponCode} />
        </div>
      </Suspense>
      <CouponManager coupons={coupons} canManage={can(session, 'coupons.manage')} />
    </>
  )
}
