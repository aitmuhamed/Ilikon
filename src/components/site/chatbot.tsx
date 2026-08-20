'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, MessageCircle, Package, Phone, RefreshCw, Send, ShieldCheck, X } from 'lucide-react'

import { useCartCount, useI18n, useLocalePath } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/client-api'
import { CHAT_SESSION_KEY } from '@/lib/constants'
import { cn, formatMnt } from '@/lib/utils'

/**
 * "Иликон" — floating pharmacy assistant.
 *
 * The client is deliberately thin: intent detection, safety screening and all
 * catalogue lookups happen server-side in `lib/chatbot.ts`. This component only
 * renders what the server returns, so no safety rule can be bypassed by
 * tampering with browser code.
 */

interface ChatProduct {
  id: string
  slug: string
  name: string
  price: number
  discountPrice: number | null
  imageUrl: string | null
  prescriptionRequired: boolean
  inStock: boolean
  stock: number
}

interface ChatAction {
  type: 'link' | 'pharmacist' | 'upload_prescription'
  label: string
  href?: string
}

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  intent?: string | null
  products?: ChatProduct[]
  actions?: ChatAction[]
  suggestions?: string[]
}

export function ChatbotWidget({ greeting, enabled }: { greeting: string; enabled: boolean }) {
  const { d, locale } = useI18n()
  const localePath = useLocalePath()
  const toast = useToast()
  const cart = useCartCount()

  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  // Session id lives in sessionStorage: history survives navigation inside the
  // tab but is not a durable cross-visit identifier.
  React.useEffect(() => {
    let id = window.sessionStorage.getItem(CHAT_SESSION_KEY)
    if (!id) {
      id = `cs_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
      window.sessionStorage.setItem(CHAT_SESSION_KEY, id)
    }
    setSessionId(id)
  }, [])

  React.useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'greeting',
          role: 'ASSISTANT',
          content: greeting,
          suggestions: [d.chatbot.suggestion1, d.chatbot.suggestion2, d.chatbot.suggestion3, d.chatbot.suggestion4],
        },
      ])
    }
  }, [greeting, d, messages.length])

  React.useEffect(() => {
    if (!open) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, open])

  // Load prior history for this session when the panel is first opened.
  React.useEffect(() => {
    if (!open || !sessionId || messages.length > 1) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<{ messages: Message[] }>(
          `/api/chatbot/history?sessionId=${encodeURIComponent(sessionId)}`,
        )
        if (!cancelled && data.messages.length > 0) setMessages(data.messages)
      } catch {
        // A fresh conversation is a perfectly good fallback.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, sessionId, messages.length])

  async function send(text: string, escalate = false) {
    const trimmed = text.trim()
    if ((!trimmed && !escalate) || sending || !sessionId) return

    const userMessage: Message = {
      id: `u_${Date.now()}`,
      role: 'USER',
      content: trimmed || d.chatbot.contactPharmacist,
    }
    setMessages((current) => [...current, userMessage])
    setInput('')
    setSending(true)

    try {
      const data = await apiFetch<{
        content: string
        intent: string
        escalated: boolean
        attachments: { products?: ChatProduct[]; actions?: ChatAction[]; suggestions?: string[] }
      }>('/api/chatbot/message', {
        method: 'POST',
        body: { message: userMessage.content, sessionId, locale, escalate },
      })

      setMessages((current) => [
        ...current,
        {
          id: `a_${Date.now()}`,
          role: 'ASSISTANT',
          content: data.content,
          intent: data.intent,
          products: data.attachments.products,
          actions: data.attachments.actions,
          suggestions: data.attachments.suggestions,
        },
      ])
    } catch {
      setMessages((current) => [
        ...current,
        { id: `e_${Date.now()}`, role: 'ASSISTANT', content: d.chatbot.error },
      ])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function reset() {
    const id = `cs_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    window.sessionStorage.setItem(CHAT_SESSION_KEY, id)
    setSessionId(id)
    setMessages([
      {
        id: 'greeting',
        role: 'ASSISTANT',
        content: greeting,
        suggestions: [d.chatbot.suggestion1, d.chatbot.suggestion2, d.chatbot.suggestion3, d.chatbot.suggestion4],
      },
    ])
  }

  async function addToCart(product: ChatProduct) {
    try {
      await apiFetch('/api/cart/items', { method: 'POST', body: { productId: product.id, quantity: 1 } })
      await cart.refresh()
      toast.success(d.cart.added, product.name)
    } catch {
      toast.error(d.errors.generic)
    }
  }

  if (!enabled) return null

  return (
    <>
      {/* Floating launcher */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={d.chatbot.openLabel}
          className="fixed bottom-[84px] right-4 z-50 flex items-center gap-2.5 rounded-full bg-brand-600 py-3 pl-3.5 pr-4 text-white shadow-pop transition-transform hover:scale-[1.03] active:scale-95 lg:bottom-6 lg:right-6"
        >
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <MessageCircle className="h-4 w-4" aria-hidden />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-600 bg-green-400" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-sm font-bold">{d.chatbot.name}</span>
            <span className="hidden text-[10px] opacity-85 sm:block">{d.chatbot.subtitle}</span>
          </span>
        </button>
      ) : null}

      {/* Panel */}
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-end sm:inset-auto sm:bottom-6 sm:right-6">
          <div
            className="absolute inset-0 bg-ink-900/30 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label={`${d.chatbot.name} — ${d.chatbot.subtitle}`}
            className="relative z-10 flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:h-[640px] sm:max-h-[80vh] sm:w-[400px] sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 bg-brand-600 px-4 py-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{d.chatbot.name}</p>
                <p className="truncate text-[11px] opacity-85">{d.chatbot.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
                aria-label={d.chatbot.newChat}
                title={d.chatbot.newChat}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
                aria-label={d.common.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Safety banner — always visible, not dismissible. */}
            <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3.5 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
              <p className="text-[11px] leading-snug text-amber-900">{d.chatbot.disclaimer}</p>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-canvas p-3.5 scroll-thin">
              {messages.map((message) => (
                <div key={message.id}>
                  <div
                    className={cn(
                      'flex',
                      message.role === 'USER' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                        message.role === 'USER'
                          ? 'rounded-br-md bg-brand-600 text-white'
                          : 'rounded-bl-md border border-ink-200 bg-white text-ink-800',
                        message.intent === 'emergency' && 'border-red-300 bg-red-50 text-red-900',
                        message.intent === 'medical_advice_blocked' && 'border-amber-300 bg-amber-50 text-amber-900',
                      )}
                    >
                      <ChatMarkdown text={message.content} />
                    </div>
                  </div>

                  {/* Grounded product cards */}
                  {message.products && message.products.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {message.products.map((product) => (
                        <div
                          key={product.id}
                          className="flex gap-3 rounded-xl border border-ink-200 bg-white p-2.5"
                        >
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-ink-300" aria-hidden />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-xs font-semibold leading-snug text-ink-900">
                              {product.name}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="text-sm font-bold text-ink-900 tabular">
                                {formatMnt(product.discountPrice ?? product.price)}
                              </span>
                              {product.discountPrice ? (
                                <span className="text-[10px] text-ink-400 line-through tabular">
                                  {formatMnt(product.price)}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <Badge tone={product.prescriptionRequired ? 'rx' : 'otc'}>
                                {product.prescriptionRequired
                                  ? d.product.prescriptionRequiredShort
                                  : d.product.otcShort}
                              </Badge>
                              {!product.inStock ? (
                                <Badge tone="neutral">{d.product.outOfStock}</Badge>
                              ) : null}
                            </div>
                            <div className="mt-2 flex gap-1.5">
                              <Link
                                href={localePath(`/products/${product.slug}`)}
                                onClick={() => setOpen(false)}
                                className="rounded-lg border border-ink-200 px-2.5 py-1 text-[11px] font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                              >
                                {d.chatbot.viewProduct}
                              </Link>
                              <button
                                type="button"
                                disabled={!product.inStock}
                                onClick={() => addToCart(product)}
                                className="rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-ink-300"
                              >
                                {d.chatbot.orderButton}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Quick actions */}
                  {message.actions && message.actions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.actions.map((action, index) =>
                        action.type === 'pharmacist' ? (
                          <button
                            key={index}
                            type="button"
                            onClick={() => send('', true)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-700"
                          >
                            <Phone className="h-3 w-3" aria-hidden />
                            {action.label}
                          </button>
                        ) : action.href?.startsWith('tel:') ? (
                          <a
                            key={index}
                            href={action.href}
                            className="inline-flex items-center gap-1.5 rounded-full border border-ink-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700 transition-colors hover:border-brand-300"
                          >
                            <Phone className="h-3 w-3" aria-hidden />
                            {action.label}
                          </a>
                        ) : (
                          <Link
                            key={index}
                            href={action.href ?? '#'}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                          >
                            {action.label}
                          </Link>
                        ),
                      )}
                    </div>
                  ) : null}

                  {/* Suggested questions */}
                  {message.suggestions && message.suggestions.length > 0 && !sending ? (
                    <div className="mt-2.5">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                        {d.chatbot.suggested}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {message.suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => send(suggestion)}
                            className="rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}

              {sending ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-ink-200 bg-white px-3.5 py-3">
                    <span className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-brand-400" />
                    <span
                      className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-brand-400"
                      style={{ animationDelay: '0.15s' }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-brand-400"
                      style={{ animationDelay: '0.3s' }}
                    />
                    <span className="ml-1 text-[11px] text-ink-400">{d.chatbot.typing}…</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Composer */}
            <div className="border-t border-ink-200 bg-white p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      send(input)
                    }
                  }}
                  placeholder={d.chatbot.placeholder}
                  maxLength={1000}
                  className="max-h-24 min-h-[42px] flex-1 resize-none rounded-xl border border-ink-300 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <Button
                  size="icon"
                  onClick={() => send(input)}
                  disabled={!input.trim() || sending}
                  aria-label={d.chatbot.send}
                >
                  <Send className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <button
                type="button"
                onClick={() => send('', true)}
                className="mt-2 w-full rounded-lg bg-ink-50 py-1.5 text-[11px] font-semibold text-ink-600 transition-colors hover:bg-accent-50 hover:text-accent-700"
              >
                {d.chatbot.contactPharmacist}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

/**
 * Minimal renderer for the small markdown subset the assistant emits
 * (**bold**, _italic_, bullet lines). Text is escaped by React — no HTML from
 * the model is ever injected.
 */
function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => {
        if (!line.trim()) return null
        const bullet = /^[•\-*]\s+/.test(line)
        const content = bullet ? line.replace(/^[•\-*]\s+/, '') : line
        return (
          <p key={index} className={cn(bullet && 'flex gap-1.5')}>
            {bullet ? <span aria-hidden>•</span> : null}
            <span className={cn(bullet && 'flex-1')}>{renderInline(content)}</span>
          </p>
        )
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${match.index}-b`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      parts.push(
        <em key={`${match.index}-i`} className="opacity-80">
          {token.slice(1, -1)}
        </em>,
      )
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}
