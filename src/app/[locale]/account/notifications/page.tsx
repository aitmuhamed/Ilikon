import type { Metadata } from 'next'

import { NotificationList } from '@/components/site/account-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { listNotifications } from '@/lib/notifications'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.account.notifications,
    description: d.account.notifications,
    pathWithoutLocale: '/account/notifications',
    noIndex: true,
  })
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const session = (await getSession())!

  const notifications = await listNotifications(session.id, session.isStaff, 50)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-ink-900">{d.account.notifications}</h1>
      <NotificationList
        initial={notifications.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          linkUrl: item.linkUrl,
          readAt: item.readAt ? item.readAt.toISOString() : null,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
