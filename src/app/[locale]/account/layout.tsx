import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, FileText, Heart, LayoutDashboard, MapPin, Package, Stethoscope, User } from 'lucide-react'

import { Badge, Breadcrumbs } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unreadCount } from '@/lib/notifications'
import { formatMnt } from '@/lib/utils'

/**
 * Account shell. Unauthenticated visitors are redirected to login with a
 * `next` parameter so they land back where they intended.
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)

  const session = await getSession()
  if (!session) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`)
  }

  const [stats, unread, wishlistCount, prescriptionCount, consultationCount] = await Promise.all([
    prisma.order.aggregate({
      where: { userId: session.id, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    unreadCount(session.id, session.isStaff),
    prisma.wishlistItem.count({ where: { wishlist: { userId: session.id } } }),
    prisma.prescription.count({ where: { userId: session.id } }),
    prisma.consultation.count({ where: { userId: session.id, status: { not: 'DRAFT' } } }),
  ])

  const nav = [
    { href: '/account', label: d.account.profile, icon: User },
    { href: '/account/orders', label: d.account.orders, icon: Package, count: stats._count._all },
    { href: '/account/prescriptions', label: d.account.prescriptions, icon: FileText, count: prescriptionCount },
    {
      href: '/account/consultations',
      label: d.consultation.history.title,
      icon: Stethoscope,
      count: consultationCount,
    },
    { href: '/account/addresses', label: d.account.addresses, icon: MapPin },
    { href: '/account/wishlist', label: d.account.wishlist, icon: Heart, count: wishlistCount },
    { href: '/account/notifications', label: d.account.notifications, icon: Bell, count: unread, highlight: unread > 0 },
  ]

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: d.common.home, href: `/${locale}` }, { label: d.account.title }]}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside>
          <div className="card p-4">
            <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
                {session.fullName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{session.fullName}</p>
                <p className="truncate text-xs text-ink-500">{session.phone}</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 border-b border-ink-100 py-4">
              <div>
                <dt className="text-[11px] text-ink-500">{d.account.totalOrders}</dt>
                <dd className="text-base font-bold text-ink-900 tabular">{stats._count._all}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-500">{d.account.totalSpent}</dt>
                <dd className="text-base font-bold text-brand-700 tabular">
                  {formatMnt(stats._sum.total ?? 0, locale)}
                </dd>
              </div>
            </dl>

            <nav className="mt-3 space-y-0.5">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={`/${locale}${item.href}`}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.count !== undefined && item.count > 0 ? (
                    <Badge tone={item.highlight ? 'danger' : 'neutral'}>{item.count}</Badge>
                  ) : null}
                </Link>
              ))}

              {session.isStaff && session.permissions.length > 0 ? (
                <Link
                  href="/admin"
                  className="mt-2 flex items-center gap-2.5 rounded-lg bg-brand-50 px-2.5 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
                  {d.nav.admin}
                </Link>
              ) : null}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
