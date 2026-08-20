import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Package } from 'lucide-react'

import { Badge, Card, EmptyState } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { PasswordForm, ProfileForm } from '@/components/site/account-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildMetadata } from '@/lib/seo'
import { formatDate, formatMnt } from '@/lib/utils'
import { ORDER_STATUS_TONE } from '@/components/ui/primitives'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.account.title,
    description: d.account.profile,
    pathWithoutLocale: '/account',
    noIndex: true,
  })
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const session = (await getSession())!

  const [user, recentOrders] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.id },
      select: { fullName: true, phone: true, email: true, marketingOptIn: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { userId: session.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        requiresPrescription: true,
        prescriptionCleared: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
  ])

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-br from-brand-600 to-brand-700 text-white">
        <p className="text-sm text-white/80">{d.auth.loginSuccess}</p>
        <h1 className="mt-0.5 text-xl font-bold">{user.fullName}</h1>
        <p className="mt-1 text-xs text-white/70">
          {d.account.memberSince}: {formatDate(user.createdAt, locale)}
        </p>
      </Card>

      {/* Recent orders */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">{d.admin.recentOrders}</h2>
          <Link
            href={`/${locale}/account/orders`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
          >
            {d.common.viewAll}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={d.account.noOrders}
            body={d.account.noOrdersBody}
            action={
              <Link href={`/${locale}/products`}>
                <Button size="sm">{d.cart.continueShopping}</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/${locale}/account/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 tabular">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {formatDate(order.createdAt, locale)} · {order._count.items} {d.cart.items}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {order.requiresPrescription && !order.prescriptionCleared ? (
                      <Badge tone="warning">{d.prescription.awaitingVerification}</Badge>
                    ) : null}
                    <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                      {d.orderStatus[order.status]}
                    </Badge>
                    <span className="text-sm font-bold text-ink-900 tabular">
                      {formatMnt(order.total, locale)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ProfileForm
        initial={{
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          marketingOptIn: user.marketingOptIn,
        }}
      />

      <PasswordForm />
    </div>
  )
}
