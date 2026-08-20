import { prisma } from '@/lib/prisma'
import { ok, route } from '@/lib/api'

/**
 * Replays a conversation for the widget.
 *
 * The session id is an opaque, browser-scoped key; a conversation created while
 * signed in is additionally restricted to its owner so a leaked key cannot
 * reveal someone's chat history.
 */
export const GET = route({
  auth: 'public',
  rateLimit: false,
  async handler({ query, session }) {
    const sessionId = (query.get('sessionId') ?? '').slice(0, 80)
    if (!sessionId) return ok({ messages: [] })

    const conversation = await prisma.chatbotConversation.findUnique({
      where: { sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 80 } },
    })

    if (!conversation) return ok({ messages: [] })
    if (conversation.userId && conversation.userId !== session?.id) return ok({ messages: [] })

    return ok({
      messages: conversation.messages.map((message) => {
        const attachments = (message.attachments ?? {}) as {
          products?: unknown[]
          actions?: unknown[]
          suggestions?: string[]
        }
        return {
          id: message.id,
          role: message.role,
          content: message.content,
          intent: message.intent,
          products: attachments.products,
          actions: attachments.actions,
          suggestions: attachments.suggestions,
        }
      }),
    })
  },
})
