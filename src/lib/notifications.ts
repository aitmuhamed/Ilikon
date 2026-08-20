import 'server-only'

import type { NotificationType } from '@prisma/client'

import { prisma } from './prisma'

/**
 * Notifications are rows, not push messages: the storefront bell and the admin
 * bell both read from here. An email/SMS transport can subscribe later without
 * changing any call site.
 */

export interface NotifyCustomerInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  linkUrl?: string
  data?: Record<string, unknown>
}

export async function notifyCustomer(input: NotifyCustomerInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        audience: 'CUSTOMER',
        type: input.type,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
        data: (input.data ?? undefined) as never,
      },
    })
  } catch (error) {
    console.error('[notifications] customer notify failed', error)
  }
}

export interface NotifyStaffInput {
  type: NotificationType
  title: string
  body: string
  linkUrl?: string
  data?: Record<string, unknown>
  /**
   * Suppresses a duplicate alert within the dedupe window — stops a low-stock
   * warning firing on every single sale of the same product.
   */
  dedupeKey?: string
}

const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000
const recentAlerts = new Map<string, number>()

export async function notifyStaff(input: NotifyStaffInput): Promise<void> {
  if (input.dedupeKey) {
    const last = recentAlerts.get(input.dedupeKey)
    if (last && Date.now() - last < DEDUPE_WINDOW_MS) return
    recentAlerts.set(input.dedupeKey, Date.now())
  }

  try {
    await prisma.notification.create({
      data: {
        userId: null,
        audience: 'STAFF',
        type: input.type,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl ?? null,
        data: (input.data ?? undefined) as never,
      },
    })
  } catch (error) {
    console.error('[notifications] staff notify failed', error)
  }
}

export async function unreadCount(userId: string, isStaff: boolean): Promise<number> {
  return prisma.notification.count({
    where: isStaff
      ? { OR: [{ userId }, { audience: 'STAFF', userId: null }], readAt: null }
      : { userId, readAt: null },
  })
}

export async function listNotifications(userId: string, isStaff: boolean, take = 30) {
  return prisma.notification.findMany({
    where: isStaff ? { OR: [{ userId }, { audience: 'STAFF', userId: null }] } : { userId },
    orderBy: { createdAt: 'desc' },
    take,
  })
}

export async function markAllRead(userId: string, isStaff: boolean): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: isStaff
      ? { OR: [{ userId }, { audience: 'STAFF', userId: null }], readAt: null }
      : { userId, readAt: null },
    data: { readAt: new Date() },
  })
  return result.count
}

/**
 * Broadcast from the admin notifications screen.
 * Promotional sends deliberately exclude customers who have not opted in.
 */
export async function broadcast(input: {
  audience: 'CUSTOMER' | 'STAFF'
  type: 'PROMOTION' | 'SYSTEM'
  title: string
  body: string
  linkUrl?: string
  respectMarketingConsent: boolean
}): Promise<number> {
  if (input.audience === 'STAFF') {
    await notifyStaff({ type: input.type, title: input.title, body: input.body, linkUrl: input.linkUrl })
    return 1
  }

  const recipients = await prisma.user.findMany({
    where: {
      isStaff: false,
      deletedAt: null,
      status: 'ACTIVE',
      ...(input.type === 'PROMOTION' && input.respectMarketingConsent ? { marketingOptIn: true } : {}),
    },
    select: { id: true },
  })

  if (!recipients.length) return 0

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      audience: 'CUSTOMER' as const,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? null,
    })),
  })
  return recipients.length
}
