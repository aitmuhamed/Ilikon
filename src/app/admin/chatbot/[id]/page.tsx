import { notFound } from 'next/navigation'
import { AlertTriangle, Package, Phone } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/shell'
import { Alert, Badge, Card } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cn, formatDateTime, formatMnt } from '@/lib/utils'

export default async function AdminChatbotConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = (await getSession())!
  if (!can(session, 'chatbot.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)

  const conversation = await prisma.chatbotConversation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, phone: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!conversation) notFound()

  const showContact = can(session, 'customers.viewContact')

  return (
    <>
      <AdminPageHeader
        title={conversation.title ?? d.admin.conversations}
        backHref="/admin/chatbot"
        subtitle={`${conversation.user?.fullName ?? d.common.none} · ${formatDateTime(
          conversation.createdAt,
          locale,
        )}`}
        badge={
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">{conversation.locale.toUpperCase()}</Badge>
            {conversation.escalatedAt ? <Badge tone="accent">{d.admin.escalated}</Badge> : null}
          </div>
        }
      />

      {conversation.escalatedAt ? (
        <Alert tone="info" className="mb-4" title={d.chatbot.contactPharmacist}>
          {formatDateTime(conversation.escalatedAt, locale)}
          {conversation.user && showContact ? (
            <span className="ml-2 inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              <a href={`tel:${conversation.user.phone}`} className="font-semibold underline tabular">
                {conversation.user.phone}
              </a>
            </span>
          ) : null}
        </Alert>
      ) : null}

      <Card className="max-w-3xl">
        <ul className="space-y-3">
          {conversation.messages.map((message) => {
            const attachments = (message.attachments ?? {}) as {
              products?: {
                id: string
                name: string
                price: number
                discountPrice: number | null
                prescriptionRequired: boolean
              }[]
            }
            const isUser = message.role === 'USER'
            const flagged =
              message.intent === 'medical_advice_blocked' || message.intent === 'emergency'

            return (
              <li key={message.id}>
                <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      isUser
                        ? 'rounded-br-md bg-brand-600 text-white'
                        : 'rounded-bl-md border border-ink-200 bg-white text-ink-800',
                      flagged && 'border-amber-300 bg-amber-50 text-amber-900',
                    )}
                  >
                    <p className="whitespace-pre-line">{message.content}</p>

                    {attachments.products && attachments.products.length > 0 ? (
                      <ul className="mt-2 space-y-1 border-t border-ink-200/40 pt-2">
                        {attachments.products.map((product) => (
                          <li key={product.id} className="flex items-center gap-2 text-xs">
                            <Package className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{product.name}</span>
                            <span className="shrink-0 tabular">
                              {formatMnt(product.discountPrice ?? product.price, locale)}
                            </span>
                            {product.prescriptionRequired ? (
                              <span className="shrink-0 rounded bg-accent-600 px-1 text-[10px] font-bold text-white">
                                {d.product.prescriptionRequiredShort}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>

                <p
                  className={cn(
                    'mt-1 flex items-center gap-1.5 text-[11px] text-ink-400',
                    isUser ? 'justify-end' : 'justify-start',
                  )}
                >
                  {flagged ? <AlertTriangle className="h-3 w-3 text-warning" aria-hidden /> : null}
                  {message.intent ? <span className="tabular">{message.intent}</span> : null}
                  <span>{formatDateTime(message.createdAt, locale)}</span>
                </p>
              </li>
            )
          })}
        </ul>
      </Card>

      <Alert tone="warning" className="mt-4 max-w-3xl">
        {d.chatbot.disclaimer}
      </Alert>
    </>
  )
}
