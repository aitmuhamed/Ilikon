import { ok, route } from '@/lib/api'
import { broadcast, listNotifications, markAllRead, unreadCount } from '@/lib/notifications'
import { notificationSendSchema } from '@/lib/validation'
import { can } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import { audit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'

export const GET = route({
  auth: 'user',
  rateLimit: false,
  async handler({ session }) {
    const [items, unread] = await Promise.all([
      listNotifications(session!.id, session!.isStaff, 40),
      unreadCount(session!.id, session!.isStaff),
    ])
    return ok({ notifications: items, unread })
  },
})

/** Marks everything visible to the caller as read. */
export const PATCH = route({
  auth: 'user',
  async handler({ session }) {
    const count = await markAllRead(session!.id, session!.isStaff)
    return ok({ marked: count })
  },
})

/**
 * Staff broadcast. Promotional sends respect marketing consent — a customer who
 * never opted in is not messaged, regardless of what the sender ticks.
 */
export const POST = route({
  auth: { permission: 'notifications.send' },
  schema: notificationSendSchema,
  async handler({ body, session, request }) {
    if (!can(session, 'notifications.send')) {
      throw new ApiError(403, 'FORBIDDEN', 'Missing permission')
    }

    const settings = await getSettings()
    void settings

    const recipients = await broadcast({
      audience: body.audience,
      type: body.type,
      title: body.title,
      body: body.body,
      linkUrl: body.linkUrl,
      respectMarketingConsent: body.respectMarketingConsent,
    })

    await audit({
      actor: session,
      action: 'notification.broadcast',
      entity: 'Notification',
      summary: `${body.type} → ${body.audience} (${recipients} recipients)`,
      request,
    })

    return ok({ recipients })
  },
})
