import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Providers } from '@/components/providers'
import { AdminShell, type AdminNavGroup } from '@/components/admin/shell'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { prisma } from '@/lib/prisma'
import { unreadCount } from '@/lib/notifications'

export const metadata: Metadata = {
  title: { default: 'Админ — Иликон', template: '%s | Админ — Иликон' },
  robots: { index: false, follow: false },
}

/**
 * Admin shell and authorisation gate.
 *
 * Two checks apply to every admin page: the actor must be staff, and must hold
 * at least one permission. The sidebar is then filtered by permission, so a
 * courier never even sees links to the sections they cannot open — and the API
 * routes behind each section enforce the same permissions independently.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) redirect(`/mn/login?next=${encodeURIComponent('/admin')}`)
  if (!session.isStaff || session.permissions.length === 0) redirect('/mn')

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const settings = await getSettings()

  // Live counters that make the sidebar useful at a glance.
  const [pendingOrders, prescriptionQueue, pendingReviews, unread, lowStock, consultationQueue] =
    await Promise.all([
    can(session, 'orders.view')
      ? prisma.order.count({ where: { status: { in: ['NEW', 'CONFIRMING'] } } })
      : Promise.resolve(0),
    can(session, 'prescriptions.view')
      ? prisma.prescription.count({
          where: { status: { in: ['PENDING', 'CLARIFICATION_REQUESTED'] } },
        })
      : Promise.resolve(0),
    can(session, 'reviews.moderate')
      ? prisma.review.count({ where: { status: 'PENDING', deletedAt: null } })
      : Promise.resolve(0),
    unreadCount(session.id, true),
    can(session, 'inventory.view')
      ? prisma.inventory.count({ where: { quantity: { lte: settings.lowStockThreshold } } })
      : Promise.resolve(0),
    // Consultations waiting on a pharmacist, plus every emergency referral —
    // both are things a human needs to look at today.
    can(session, 'consultations.view')
      ? prisma.consultation.count({
          where: {
            OR: [{ status: 'PHARMACIST_REVIEW' }, { triageLevel: 'EMERGENCY', reviewedAt: null }],
          },
        })
      : Promise.resolve(0),
    ])

  const groups: AdminNavGroup[] = [
    {
      title: d.admin.dashboard,
      items: [
        ...(can(session, 'dashboard.view')
          ? [{ href: '/admin', label: d.admin.dashboard, icon: 'dashboard' }]
          : []),
        ...(can(session, 'reports.view')
          ? [{ href: '/admin/reports', label: d.admin.reports, icon: 'reports' }]
          : []),
      ],
    },
    {
      title: d.admin.orders,
      items: [
        ...(can(session, 'orders.view')
          ? [
              {
                href: '/admin/orders',
                label: d.admin.orders,
                icon: 'orders',
                badge: pendingOrders,
                badgeTone: 'brand' as const,
              },
            ]
          : []),
        ...(can(session, 'prescriptions.view')
          ? [
              {
                href: '/admin/prescriptions',
                label: d.admin.prescriptions,
                icon: 'prescriptions',
                badge: prescriptionQueue,
                badgeTone: 'warning' as const,
              },
            ]
          : []),
        ...(can(session, 'delivery.view')
          ? [{ href: '/admin/delivery', label: d.admin.delivery, icon: 'delivery' }]
          : []),
        ...(can(session, 'payments.view')
          ? [{ href: '/admin/payments', label: d.admin.payments, icon: 'payments' }]
          : []),
      ],
    },
    {
      title: d.admin.products,
      items: [
        ...(can(session, 'products.view')
          ? [{ href: '/admin/products', label: d.admin.products, icon: 'products' }]
          : []),
        ...(can(session, 'categories.view')
          ? [{ href: '/admin/categories', label: d.admin.categories, icon: 'categories' }]
          : []),
        ...(can(session, 'brands.view')
          ? [{ href: '/admin/brands', label: d.admin.brands, icon: 'brands' }]
          : []),
        ...(can(session, 'inventory.view')
          ? [
              {
                href: '/admin/inventory',
                label: d.admin.inventory,
                icon: 'inventory',
                badge: lowStock,
                badgeTone: 'danger' as const,
              },
            ]
          : []),
      ],
    },
    {
      title: d.admin.customers,
      items: [
        ...(can(session, 'customers.view')
          ? [{ href: '/admin/customers', label: d.admin.customers, icon: 'customers' }]
          : []),
        ...(can(session, 'reviews.view')
          ? [
              {
                href: '/admin/reviews',
                label: d.admin.reviews,
                icon: 'reviews',
                badge: pendingReviews,
                badgeTone: 'warning' as const,
              },
            ]
          : []),
        ...(can(session, 'consultations.view')
          ? [
              {
                href: '/admin/consultations',
                label: d.admin.consultations,
                icon: 'consultations',
                badge: consultationQueue,
                badgeTone: 'danger' as const,
              },
            ]
          : []),
        ...(can(session, 'chatbot.view')
          ? [{ href: '/admin/chatbot', label: d.admin.chatbot, icon: 'chatbot' }]
          : []),
        ...(can(session, 'notifications.view')
          ? [{ href: '/admin/notifications', label: d.admin.notifications, icon: 'notifications' }]
          : []),
      ],
    },
    {
      title: d.admin.promotions,
      items: [
        ...(can(session, 'coupons.view')
          ? [{ href: '/admin/coupons', label: d.admin.coupons, icon: 'coupons' }]
          : []),
        ...(can(session, 'promotions.view')
          ? [{ href: '/admin/promotions', label: d.admin.promotions, icon: 'promotions' }]
          : []),
      ],
    },
    {
      title: d.admin.settings,
      items: [
        ...(can(session, 'staff.view')
          ? [{ href: '/admin/staff', label: d.admin.staff, icon: 'staff' }]
          : []),
        ...(can(session, 'staff.roles')
          ? [{ href: '/admin/roles', label: d.admin.roles, icon: 'roles' }]
          : []),
        ...(can(session, 'settings.view')
          ? [{ href: '/admin/settings', label: d.admin.settings, icon: 'settings' }]
          : []),
        ...(can(session, 'audit.view')
          ? [{ href: '/admin/audit', label: d.admin.auditLog, icon: 'audit' }]
          : []),
      ],
    },
  ].filter((group) => group.items.length > 0)

  return (
    <Providers locale={locale} dictionary={d} cartCount={0}>
      <AdminShell
        groups={groups}
        user={{
          fullName: session.fullName,
          roleName: session.roleName ?? d.admin.title,
          jobTitle: null,
        }}
        unread={unread}
        pharmacyName={settings.pharmacyName}
        storefrontHref={`/${locale}`}
      >
        {children}
      </AdminShell>
    </Providers>
  )
}
