import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, Check, MessageCircle, Phone, X } from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { Alert, Badge, Card } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { isLlmConfigured } from '@/lib/chatbot'
import { formatDateTime, formatNumber, truncate } from '@/lib/utils'

export default async function AdminChatbotPage() {
  const session = (await getSession())!
  if (!can(session, 'chatbot.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const settings = await getSettings()

  const [conversations, totalConversations, escalatedCount, messageCount, blockedCount] =
    await Promise.all([
      prisma.chatbotConversation.findMany({
        include: {
          user: { select: { id: true, fullName: true } },
          messages: { orderBy: { createdAt: 'asc' }, take: 3 },
          _count: { select: { messages: true } },
        },
        orderBy: [{ escalatedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 40,
      }),
      prisma.chatbotConversation.count(),
      prisma.chatbotConversation.count({ where: { escalatedAt: { not: null } } }),
      prisma.chatbotMessage.count(),
      prisma.chatbotMessage.count({
        where: { intent: { in: ['medical_advice_blocked', 'emergency'] } },
      }),
    ])

  return (
    <>
      <AdminPageHeader
        title={d.admin.chatbot}
        subtitle={`${d.chatbot.name} — ${d.chatbot.subtitle}`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.admin.conversations}
          value={formatNumber(totalConversations, locale)}
          tone="brand"
          icon={<MessageCircle className="h-4 w-4" />}
        />
        <StatCard label={d.admin.messages} value={formatNumber(messageCount, locale)} />
        <StatCard
          label={d.admin.escalated}
          value={formatNumber(escalatedCount, locale)}
          tone={escalatedCount > 0 ? 'accent' : 'default'}
          icon={<Phone className="h-4 w-4" />}
        />
        <StatCard
          label={d.chatbot.disclaimer.slice(0, 28)}
          value={formatNumber(blockedCount, locale)}
          sub={d.chatbot.safetyRedirect.slice(0, 40)}
          tone={blockedCount > 0 ? 'warning' : 'default'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">{d.admin.chatbotSettings}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge
                tone={settings.chatbotEnabled ? 'success' : 'neutral'}
                icon={settings.chatbotEnabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              >
                {d.admin.chatbotEnabled}
              </Badge>
              <Badge tone={isLlmConfigured() ? 'success' : 'neutral'}>
                {isLlmConfigured() ? d.admin.chatbotLlmOn : d.admin.chatbotLlmOff}
              </Badge>
            </div>
          </div>
          {can(session, 'settings.view') ? (
            <Link
              href="/admin/settings"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              {d.admin.settings} →
            </Link>
          ) : null}
        </div>
      </Card>

      <Alert tone="warning" className="mb-4" title={d.chatbot.disclaimer}>
        {d.chatbot.safetyRedirect}
      </Alert>

      {conversations.length === 0 ? (
        <Card>
          <p className="py-12 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {conversations.map((conversation) => (
            <Link key={conversation.id} href={`/admin/chatbot/${conversation.id}`} className="block">
              <Card className="card-hover h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {conversation.title ?? d.admin.conversations}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {conversation.user?.fullName ?? d.common.none} ·{' '}
                      {formatDateTime(conversation.updatedAt, locale)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="neutral">{conversation.locale.toUpperCase()}</Badge>
                    {conversation.escalatedAt ? (
                      <Badge tone="accent">{d.admin.escalated}</Badge>
                    ) : null}
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
                  {conversation.messages.map((message) => (
                    <li key={message.id} className="flex gap-2 text-xs">
                      <span
                        className={
                          message.role === 'USER'
                            ? 'shrink-0 font-semibold text-brand-700'
                            : 'shrink-0 font-semibold text-ink-400'
                        }
                      >
                        {message.role === 'USER' ? '→' : '←'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-600">
                        {truncate(message.content, 90)}
                      </span>
                      {message.intent === 'medical_advice_blocked' || message.intent === 'emergency' ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                      ) : null}
                    </li>
                  ))}
                </ul>

                <p className="mt-2 text-[11px] text-ink-400 tabular">
                  {conversation._count.messages} {d.admin.messages.toLowerCase()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
