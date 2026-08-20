import { ApiError, ok, route } from '@/lib/api'
import { chatMessageSchema } from '@/lib/validation'
import { handleChatMessage } from '@/lib/chatbot'
import { getSettings } from '@/lib/settings'
import { coerceLocale } from '@/lib/locale-types'
import { randomBytes } from 'node:crypto'

/**
 * Chatbot turn.
 *
 * All safety screening, intent detection and catalogue grounding happen in
 * `lib/chatbot.ts` on the server — the browser cannot skip them.
 */
export const POST = route({
  auth: 'public',
  schema: chatMessageSchema,
  rateLimit: 'chatbot',
  skipCsrf: true,
  async handler({ body, session }) {
    const settings = await getSettings()
    if (!settings.chatbotEnabled) {
      throw new ApiError(503, 'CHATBOT_DISABLED', 'The assistant is currently unavailable')
    }

    const sessionId = body.sessionId ?? `cs_${randomBytes(12).toString('hex')}`

    const reply = await handleChatMessage({
      sessionId,
      userId: session?.id ?? null,
      locale: coerceLocale(body.locale),
      message: body.message,
      escalate: body.escalate,
    })

    return ok({
      sessionId,
      content: reply.content,
      intent: reply.intent,
      escalated: reply.escalated,
      attachments: reply.attachments,
    })
  },
})
