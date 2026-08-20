import { notFound } from 'next/navigation'
import Link from 'next/link'

import { AdminPageHeader } from '@/components/admin/shell'
import { NotificationSender } from '@/components/admin/misc-client'
import { Badge, Card } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listNotifications, markAllRead } from '@/lib/notifications'
import { formatDateTime } from '@/lib/utils'

export default async function AdminNotificationsPage() {
  const session = (await getSession())!
  if (!can(session, 'notifications.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)

  const [items, optedIn, totalCustomers, staffCount] = await Promise.all([
    listNotifications(session.id, true, 50),
    prisma.user.count({ where: { isStaff: false, deletedAt: null, marketingOptIn: true } }),
    prisma.user.count({ where: { isStaff: false, deletedAt: null, status: 'ACTIVE' } }),
    prisma.user.count({ where: { isStaff: true, deletedAt: null, status: 'ACTIVE' } }),
  ])

  // Opening the admin notification centre marks the staff feed as read.
  await markAllRead(session.id, true).catch(() => undefined)

  return (
    <>
      <AdminPageHeader
        title={d.admin.notifications}
        subtitle={`${items.length} ${d.common.results}`}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.alerts}</h2>
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">{d.account.noNotifications}</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {items.map((item) => {
                const content = (
                  <div className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          item.type === 'LOW_STOCK' || item.type === 'EXPIRING_PRODUCT'
                            ? 'warning'
                            : item.type === 'PAYMENT_ISSUE'
                              ? 'danger'
                              : item.type === 'NEW_PRESCRIPTION'
                                ? 'accent'
                                : 'brand'
                        }
                      >
                        {d.notification[item.type as keyof typeof d.notification] ??
                          d.notification.SYSTEM}
                      </Badge>
                      <span className="text-sm font-semibold text-ink-900">{item.title}</span>
                      {!item.readAt ? <span className="h-2 w-2 rounded-full bg-brand-500" /> : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-600">{item.body}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {formatDateTime(item.createdAt, locale)}
                      {item.audience === 'STAFF' ? ` · ${d.admin.audienceStaff}` : ''}
                    </p>
                  </div>
                )

                return (
                  <li key={item.id}>
                    {item.linkUrl ? (
                      <Link href={item.linkUrl} className="block transition-colors hover:bg-brand-50/40">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div>
          {can(session, 'notifications.send') ? (
            <NotificationSender
              optedInCount={optedIn}
              totalCustomers={totalCustomers}
              staffCount={staffCount}
            />
          ) : (
            <Card>
              <p className="text-sm text-ink-500">{d.errors.forbiddenBody}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
