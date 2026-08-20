import 'server-only'

import { prisma } from './prisma'
import { env } from './env'
import { getSettings, localizedAddress, localizedGreeting } from './settings'
import { quickSearch, getCategoryTree, type ProductCard } from './products'
import { formatMnt } from './utils'
import type { Locale } from './locale-types'

/**
 * "Иликон" — the pharmacy assistant.
 *
 * Design rules, in priority order:
 *
 *  1. SAFETY FIRST. Before anything else, the message is screened for requests
 *     that require a licensed professional — symptoms, diagnosis, personalised
 *     dosage, drug interactions, pregnancy, paediatric dosing, overdose,
 *     emergencies. Those never reach the LLM and never get a medical answer;
 *     they get a redirect to a pharmacist or emergency services.
 *  2. GROUNDED. Product answers come from live catalogue rows — price, stock and
 *     prescription status are read from the database, never generated. That also
 *     means the bot cannot invent a product the pharmacy does not stock.
 *  3. LLM OPTIONAL. With ANTHROPIC_API_KEY set, the model phrases the reply
 *     using the retrieved context and a hard-constrained system prompt. Without
 *     a key, deterministic intent handlers answer instead — the assistant
 *     degrades in fluency, never in correctness.
 */

export type ChatIntent =
  | 'greeting'
  | 'product_search'
  | 'category_help'
  | 'order_how_to'
  | 'order_status'
  | 'delivery_info'
  | 'payment_info'
  | 'prescription_info'
  | 'pharmacy_info'
  | 'faq'
  | 'pharmacist_escalation'
  | 'medical_advice_blocked'
  | 'emergency'
  | 'unknown'

export interface ChatProductCard {
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

export interface ChatAttachments {
  products?: ChatProductCard[]
  actions?: { type: 'link' | 'pharmacist' | 'upload_prescription'; label: string; href?: string }[]
  suggestions?: string[]
}

export interface ChatReply {
  content: string
  intent: ChatIntent
  attachments: ChatAttachments
  escalated: boolean
}

// ───────────────────────── safety screening ───────────────────────────────

/**
 * Patterns that must never receive a generated medical answer.
 * Deliberately broad — a false positive costs a redirect, a false negative
 * could cost a patient.
 */
const EMERGENCY_PATTERNS = [
  // mn
  /(хордсон|хордлого|амьсгал\s*давхарла|амьсгалахад хүнд|ухаан\s*алдсан|цус\s*алдаж|тэвдэлт|таталт|яаралтай|аюулгүй биш|цээж\s*өвдө|зүрх\s*хүчтэй|амиа хорлох)/i,
  // en
  /(overdose|poison|can'?t breathe|difficulty breathing|unconscious|seizure|chest pain|bleeding heavily|anaphyla|suicid|emergency)/i,
  // ru
  /(отравлен|передозиров|не могу дышать|потерял сознание|судорог|боль в груди|сильное кровотечен|анафилак|экстренн|самоубийств)/i,
]

const MEDICAL_ADVICE_PATTERNS = [
  // symptoms / diagnosis
  /(надад\s*ямар\s*эм|ямар\s*эм\s*(хэрэглэ|уу|зөвлө)|би\s*ямар\s*өвчин|өвчин\s*(мэ|тодорхойл)|намайг\s*(шинжил|үзэ)|тун(г|гийн)\s*(хэр|хэд|ямар)|хэдэн\s*шахмал|хэр\s*их\s*ууж|өвдөж\s*байна.*эм)/i,
  /(what (medicine|drug|should i take)|which medicine|do i have|diagnose|what'?s wrong with me|how (many|much) should i take|dosage for me|is it safe to take.*(with|and))/i,
  /(какое лекарство|что мне принять|какой диагноз|что со мной|сколько таблеток|какая дозировка для меня|можно ли принимать.*(с|вместе))/i,
  // interactions, pregnancy, paediatric
  /(харилцан\s*үйлчлэл|хамт\s*ууж\s*болох|хамт\s*хэрэглэж\s*болох|хөхүүл|хөхүүлж|дэлэн|дэлэнгээр|тэжээж|хүүхдэд\s*хэр|нөхөн\s*үрж)/i,
  /(жирэмс|jiremsen|pregnan|breastfeed|breast-feeding|беремен|кормлен|грудном)/i,
  /(drug interaction|take together with|combine with|for my (baby|child|infant).*(dose|mg))/i,
  /(взаимодейств|принимать вместе|совместим|для ребенка.*(доз|мг))/i,
  // allergy assessment
  /(харшил\s*байвал|харшилтай\s*бол|allergic to|аллерги(я|ческ).*можно)/i,
]

const PHARMACIST_PATTERNS = [
  /(фармацевт|эмчтэй|мэргэжилтэн|хүнтэй\s*холбо|оператор)/i,
  /(pharmacist|talk to (a|someone)|human|real person|specialist)/i,
  /(фармацевт|с человеком|специалист|оператор)/i,
]

export function screenSafety(message: string): 'emergency' | 'medical_advice' | null {
  if (EMERGENCY_PATTERNS.some((p) => p.test(message))) return 'emergency'
  if (MEDICAL_ADVICE_PATTERNS.some((p) => p.test(message))) return 'medical_advice'
  return null
}

// ─────────────────────── deterministic intents ────────────────────────────

const INTENT_PATTERNS: { intent: ChatIntent; patterns: RegExp[] }[] = [
  {
    intent: 'greeting',
    patterns: [/^(сайн байна уу|сайн уу|hi|hello|hey|привет|здравствуй|байна уу)\W*$/i],
  },
  {
    intent: 'delivery_info',
    patterns: [
      /(хүргэлт|хүргэж|хүргэдэг|хэзээ ирэх|хураамж)/i,
      /(deliver|shipping|courier|how long.*arrive)/i,
      /(доставк|курьер|когда привез)/i,
    ],
  },
  {
    intent: 'payment_info',
    patterns: [
      /(төлбөр|төлөх|карт|qpay|банк|бэлэн|шилжүүлэг)/i,
      /(payment|pay|card|bank transfer|cash)/i,
      /(оплат|плат|карт|наличн|перевод)/i,
    ],
  },
  {
    intent: 'order_status',
    patterns: [
      /(захиалг(а|ын).*(хаана|төлөв|хянах|яаж байна)|ILK-\d{8}-\d{4})/i,
      /(order.*(status|track|where))/i,
      /(заказ.*(статус|где|отслеж))/i,
    ],
  },
  {
    intent: 'order_how_to',
    patterns: [
      /(захиалга\s*(хэрхэн|яаж)|яаж захиал|хэрхэн захиал|сагс)/i,
      /(how.*(order|checkout|buy)|place an order)/i,
      /(как.*(заказ|оформить|купить)|корзин)/i,
    ],
  },
  {
    intent: 'prescription_info',
    patterns: [
      /(жор|жороор|рецепт|prescription|rx)/i,
    ],
  },
  {
    intent: 'category_help',
    patterns: [
      /(категори|төрөл|ямар бүтээгдэхүүн|бүлэг)/i,
      /(categor|what.*(do you sell|products))/i,
      /(категори|раздел|что.*(продаете|есть))/i,
    ],
  },
  {
    intent: 'pharmacy_info',
    patterns: [
      /(хаяг|хаана байрла|ажиллах цаг|цагийн хуваар|утасны дугаар|холбоо барих)/i,
      /(address|location|opening hours|working hours|phone number|contact)/i,
      /(адрес|где наход|часы работы|телефон|контакт)/i,
    ],
  },
]

function detectIntent(message: string): ChatIntent {
  if (PHARMACIST_PATTERNS.some((p) => p.test(message))) return 'pharmacist_escalation'
  for (const entry of INTENT_PATTERNS) {
    if (entry.patterns.some((p) => p.test(message))) return entry.intent
  }
  return 'product_search'
}

/** Strips filler words so "витамин C байна уу?" searches for "витамин C". */
const STOPWORDS = [
  'байна', 'уу', 'вэ', 'юу', 'бэ', 'та', 'надад', 'хэрэгтэй', 'хайж', 'олох', 'хүсч', 'болох',
  'do', 'you', 'have', 'any', 'is', 'there', 'the', 'a', 'an', 'i', 'need', 'want', 'looking', 'for',
  'есть', 'ли', 'у', 'вас', 'мне', 'нужно', 'нужен', 'хочу', 'ищу',
]

function extractSearchTerm(message: string): string {
  const cleaned = message
    .replace(/[?!.,;:()"'«»]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.includes(word.toLowerCase()))
    .join(' ')
    .trim()
  return cleaned || message.trim()
}

function toChatCard(product: ProductCard): ChatProductCard {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    discountPrice: product.discountPrice,
    imageUrl: product.imageUrl,
    prescriptionRequired: product.prescriptionRequired,
    inStock: product.stockStatus !== 'out_of_stock',
    stock: product.stock,
  }
}

// ───────────────────────────── responses ──────────────────────────────────

const T = {
  emergency: {
    mn: 'Тайлбарласан байдал яаралтай эмнэлгийн тусламж шаардаж байж магадгүй. **Одоо 103 дугаарт холбогдоно уу** эсвэл хамгийн ойрын эмнэлгийн яаралтай тасагт хандаарай. Би эмнэлгийн зөвлөгөө өгөх боломжгүй.',
    en: 'What you describe may need urgent medical care. **Please call 103 now** or go to the nearest emergency department. I am not able to give medical advice.',
    ru: 'Описанное может требовать срочной медицинской помощи. **Позвоните 103 немедленно** или обратитесь в ближайшее отделение неотложной помощи. Я не могу давать медицинские советы.',
  },
  medical: {
    mn: 'Уучлаарай, би өвчин тодорхойлох, эм заах, тун тогтоох, эмийн харилцан үйлчлэлийг дүгнэх боломжгүй — эдгээрийг зөвхөн эмч, фармацевт хийх ёстой.\n\nМэргэжлийн фармацевт танд яг таны хувьд тохирох зөвлөгөө өгөх боломжтой. Доорх товчоор холбогдох хүсэлт үлдээгээрэй, эсвэл ажлын цагаар утсаар холбогдоорой.',
    en: 'I am not able to diagnose conditions, recommend or prescribe medicines, set dosages, or assess drug interactions — those must come from a doctor or pharmacist.\n\nOur pharmacist can advise you personally. Use the button below to request a call, or phone us during working hours.',
    ru: 'Я не могу ставить диагноз, назначать лекарства, определять дозировку или оценивать лекарственные взаимодействия — это делает только врач или фармацевт.\n\nНаш фармацевт может проконсультировать вас лично. Оставьте запрос на связь по кнопке ниже или позвоните в рабочее время.',
  },
  noProducts: {
    mn: 'Уучлаарай, «{term}» гэсэн хайлтад тохирох бүтээгдэхүүн олдсонгүй. Өөр нэр, брэнд эсвэл үйлчлэгч бодисын нэрээр хайж үзээрэй. Эсвэл фармацевтаас тодруулж асууж болно.',
    en: 'I could not find products matching “{term}”. Try another name, brand or active ingredient — or ask our pharmacist to check.',
    ru: 'Не нашёл товаров по запросу «{term}». Попробуйте другое название, бренд или действующее вещество — или спросите нашего фармацевта.',
  },
  foundProducts: {
    mn: '«{term}» хайлтаар {count} бүтээгдэхүүн олдлоо:',
    en: 'I found {count} product(s) for “{term}”:',
    ru: 'По запросу «{term}» найдено товаров: {count}.',
  },
  rxWarning: {
    mn: '\n\n⚠️ Жагсаалтад **жороор олгох** эм байна. Түүнийг эмчийн жор, фармацевтын баталгаажуулалтгүйгээр олгох боломжгүй. Захиалга хийсний дараа жороо хуулж илгээнэ үү.',
    en: '\n\n⚠️ Some of these are **prescription-only**. They cannot be dispensed without a doctor prescription and pharmacist verification. Upload your prescription after placing the order.',
    ru: '\n\n⚠️ Некоторые из них **отпускаются по рецепту**. Без рецепта врача и проверки фармацевтом отпуск невозможен. Загрузите рецепт после оформления заказа.',
  },
  escalation: {
    mn: 'Фармацевттай холбогдох хүсэлтийг бүртгэлээ. Ажлын цагаар ({hours}) бид {phone} дугаараас холбогдоно. Шуурхай хэрэгтэй бол та мөн {phone} дугаарт өөрөө холбогдож болно.',
    en: 'Your request to speak with a pharmacist is recorded. We will call you during working hours ({hours}) from {phone}. You can also call {phone} directly.',
    ru: 'Запрос на связь с фармацевтом зарегистрирован. Мы позвоним в рабочее время ({hours}) с номера {phone}. Вы также можете позвонить сами: {phone}.',
  },
  disclaimerLine: {
    mn: '\n\n_Иликон туслах нь эмнэлгийн зөвлөгөө өгөхгүй. Эм хэрэглэхээсээ өмнө зааврыг уншиж, фармацевт, эмчээс зөвлөгөө аваарай._',
    en: '\n\n_The Ilikon assistant does not give medical advice. Read the leaflet and consult a pharmacist or doctor before using any medicine._',
    ru: '\n\n_Помощник Иликон не даёт медицинских советов. Перед применением прочитайте инструкцию и обратитесь к фармацевту или врачу._',
  },
}

function pick(entry: Record<string, string>, locale: Locale): string {
  return entry[locale] ?? entry.mn
}

// ──────────────────────────── conversation ────────────────────────────────

export async function getOrCreateConversation(input: {
  sessionId: string
  userId: string | null
  locale: Locale
}) {
  const existing = await prisma.chatbotConversation.findUnique({
    where: { sessionId: input.sessionId },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 60 } },
  })
  if (existing) {
    if (input.userId && !existing.userId) {
      await prisma.chatbotConversation.update({
        where: { id: existing.id },
        data: { userId: input.userId },
      })
    }
    return existing
  }

  const created = await prisma.chatbotConversation.create({
    data: { sessionId: input.sessionId, userId: input.userId, locale: input.locale },
    include: { messages: true },
  })

  // Seed the greeting so history is complete from the first turn.
  const settings = await getSettings()
  await prisma.chatbotMessage.create({
    data: {
      conversationId: created.id,
      role: 'ASSISTANT',
      content: localizedGreeting(settings, input.locale),
      intent: 'greeting',
    },
  })

  return prisma.chatbotConversation.findUnique({
    where: { id: created.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
}

export async function handleChatMessage(input: {
  sessionId: string
  userId: string | null
  locale: Locale
  message: string
  escalate?: boolean
}): Promise<ChatReply> {
  const settings = await getSettings()
  const conversation = await getOrCreateConversation({
    sessionId: input.sessionId,
    userId: input.userId,
    locale: input.locale,
  })
  if (!conversation) throw new Error('CONVERSATION_FAILED')

  await prisma.chatbotMessage.create({
    data: { conversationId: conversation.id, role: 'USER', content: input.message },
  })

  const reply = await composeReply({
    message: input.message,
    locale: input.locale,
    userId: input.userId,
    forceEscalate: input.escalate ?? false,
    history: conversation.messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  await prisma.chatbotMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: reply.content,
      intent: reply.intent,
      attachments: (reply.attachments ?? undefined) as never,
    },
  })

  if (reply.escalated) {
    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: { escalatedAt: new Date() },
    })
    const { notifyStaff } = await import('./notifications')
    await notifyStaff({
      type: 'SYSTEM',
      title: 'Фармацевттай холбогдох хүсэлт',
      body: `Чатбот дээр хэрэглэгч фармацевтын зөвлөгөө хүссэн: "${input.message.slice(0, 160)}"`,
      linkUrl: `/admin/chatbot/${conversation.id}`,
    })
  }

  await prisma.chatbotConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date(), title: conversation.title ?? input.message.slice(0, 80) },
  })

  void settings
  return reply
}

async function composeReply(input: {
  message: string
  locale: Locale
  userId: string | null
  forceEscalate: boolean
  history: { role: string; content: string }[]
}): Promise<ChatReply> {
  const { message, locale } = input
  const settings = await getSettings()

  // ── 1. safety screen, always first ──────────────────────────────────────
  const risk = screenSafety(message)
  if (risk === 'emergency') {
    return {
      content: pick(T.emergency, locale),
      intent: 'emergency',
      escalated: true,
      attachments: {
        actions: [
          { type: 'pharmacist', label: pharmacistLabel(locale) },
          { type: 'link', label: `${settings.phone}`, href: `tel:${settings.phone.replace(/\s/g, '')}` },
        ],
      },
    }
  }
  if (risk === 'medical_advice') {
    return {
      content: pick(T.medical, locale),
      intent: 'medical_advice_blocked',
      escalated: true,
      attachments: {
        actions: [
          { type: 'pharmacist', label: pharmacistLabel(locale) },
          { type: 'link', label: `${settings.phone}`, href: `tel:${settings.phone.replace(/\s/g, '')}` },
        ],
      },
    }
  }

  const intent = input.forceEscalate ? 'pharmacist_escalation' : detectIntent(message)

  // ── 2. grounded context retrieval ───────────────────────────────────────
  let products: ProductCard[] = []
  let searchTerm = ''
  if (intent === 'product_search' || intent === 'category_help') {
    searchTerm = extractSearchTerm(message)
    products = await quickSearch(searchTerm, locale, 4)
  }

  // ── 3. LLM phrasing when available, deterministic otherwise ─────────────
  const deterministic = await deterministicReply({
    intent,
    locale,
    message,
    searchTerm,
    products,
    userId: input.userId,
    settings,
  })

  if (!env().ANTHROPIC_API_KEY || intent === 'pharmacist_escalation') return deterministic

  const llm = await llmReply({
    message,
    locale,
    intent,
    history: input.history,
    grounding: await buildGrounding({ locale, products, settings, userId: input.userId, intent }),
  }).catch((error) => {
    console.error('[chatbot] LLM call failed, falling back', error)
    return null
  })

  if (!llm) return deterministic

  return {
    content: llm,
    intent,
    escalated: false,
    attachments: deterministic.attachments,
  }
}

function pharmacistLabel(locale: Locale): string {
  return locale === 'en'
    ? 'Contact a pharmacist'
    : locale === 'ru'
      ? 'Связаться с фармацевтом'
      : 'Фармацевттай холбогдох'
}

async function deterministicReply(input: {
  intent: ChatIntent
  locale: Locale
  message: string
  searchTerm: string
  products: ProductCard[]
  userId: string | null
  settings: Awaited<ReturnType<typeof getSettings>>
}): Promise<ChatReply> {
  const { intent, locale, settings } = input
  const actions: NonNullable<ChatAttachments['actions']> = []
  const pharmacistAction = { type: 'pharmacist' as const, label: pharmacistLabel(locale) }

  switch (intent) {
    case 'greeting':
      return {
        content: localizedGreeting(settings, locale),
        intent,
        escalated: false,
        attachments: { suggestions: suggestionSet(locale) },
      }

    case 'product_search':
    case 'category_help': {
      if (input.products.length === 0) {
        if (intent === 'category_help') {
          const tree = await getCategoryTree(locale)
          const list = tree
            .slice(0, 12)
            .map((c) => `• ${c.name} (${c.productCount})`)
            .join('\n')
          return {
            content:
              locale === 'en'
                ? `Here are our main categories:\n${list}\n\nTell me what you need and I will look it up.`
                : locale === 'ru'
                  ? `Наши основные категории:\n${list}\n\nСкажите, что вам нужно, и я найду.`
                  : `Бидний үндсэн категориуд:\n${list}\n\nХэрэгцээтэй зүйлээ хэлээрэй, би хайж олно.`,
            intent,
            escalated: false,
            attachments: {
              actions: [{ type: 'link', label: navLabel(locale, 'categories'), href: `/${locale}/categories` }],
            },
          }
        }
        return {
          content: pick(T.noProducts, locale).replace('{term}', input.searchTerm),
          intent,
          escalated: false,
          attachments: { actions: [pharmacistAction], suggestions: suggestionSet(locale) },
        }
      }

      const hasRx = input.products.some((p) => p.prescriptionRequired)
      let content = pick(T.foundProducts, locale)
        .replace('{term}', input.searchTerm)
        .replace('{count}', String(input.products.length))
      if (hasRx) content += pick(T.rxWarning, locale)
      content += pick(T.disclaimerLine, locale)

      if (hasRx) {
        actions.push({
          type: 'upload_prescription',
          label: navLabel(locale, 'uploadRx'),
          href: `/${locale}/prescriptions/upload`,
        })
      }
      actions.push(pharmacistAction)

      return {
        content,
        intent,
        escalated: false,
        attachments: { products: input.products.map(toChatCard), actions },
      }
    }

    case 'delivery_info':
      return {
        content:
          locale === 'en'
            ? `**Delivery**\n• City centre: ${settings.deliveryEtaCentre} hours\n• Outer districts: ${settings.deliveryEtaOuter} hours\n• Fee: ${formatMnt(settings.deliveryFee, locale)} — free over ${formatMnt(settings.freeDeliveryThreshold, locale)}\n• Pharmacy pickup is always free.\n\nOrders placed outside working hours (${settings.workingHoursWeekdays}) are prepared the next working day.`
            : locale === 'ru'
              ? `**Доставка**\n• Центр города: ${settings.deliveryEtaCentre} часа\n• Отдалённые районы: ${settings.deliveryEtaOuter} часа\n• Стоимость: ${formatMnt(settings.deliveryFee, locale)} — бесплатно от ${formatMnt(settings.freeDeliveryThreshold, locale)}\n• Самовывоз всегда бесплатный.\n\nЗаказы вне рабочего времени (${settings.workingHoursWeekdays}) собираются на следующий рабочий день.`
              : `**Хүргэлт**\n• Хотын төв: ${settings.deliveryEtaCentre} цаг\n• Гадна дүүрэг: ${settings.deliveryEtaOuter} цаг\n• Хураамж: ${formatMnt(settings.deliveryFee, locale)} — ${formatMnt(settings.freeDeliveryThreshold, locale)}-с дээш захиалгад үнэгүй\n• Эмийн сангаас авахад хураамж байхгүй.\n\nАжлын цагаас (${settings.workingHoursWeekdays}) гадуур хийсэн захиалгыг дараагийн ажлын өдөр бэлтгэнэ.`,
        intent,
        escalated: false,
        attachments: {
          actions: [{ type: 'link', label: navLabel(locale, 'about'), href: `/${locale}/about#delivery` }],
        },
      }

    case 'payment_info': {
      const methods = [
        settings.paymentCashEnabled && (locale === 'en' ? 'Cash on delivery' : locale === 'ru' ? 'Наличными при получении' : 'Хүргэлтээр бэлнээр'),
        settings.paymentBankEnabled && (locale === 'en' ? 'Bank transfer' : locale === 'ru' ? 'Банковский перевод' : 'Банкны шилжүүлэг'),
        settings.paymentCardEnabled && (locale === 'en' ? 'Debit / credit card' : locale === 'ru' ? 'Дебетовая / кредитная карта' : 'Дебит, кредит карт'),
        settings.paymentQpayEnabled && 'QPay',
      ].filter(Boolean) as string[]

      return {
        content:
          (locale === 'en'
            ? '**Payment methods**\n'
            : locale === 'ru'
              ? '**Способы оплаты**\n'
              : '**Төлбөрийн хэлбэрүүд**\n') + methods.map((m) => `• ${m}`).join('\n'),
        intent,
        escalated: false,
        attachments: {},
      }
    }

    case 'order_how_to':
      return {
        content:
          locale === 'en'
            ? '**Placing an order**\n1. Search for the product or browse a category.\n2. Add it to your cart (“Сагсанд нэмэх”).\n3. Press Checkout and complete three steps: customer details, delivery, payment.\n4. You receive an order number like ILK-20260820-0001 and we call you to confirm.\n\nIf the order contains prescription medicine, upload the prescription — a pharmacist verifies it before the order is prepared.'
            : locale === 'ru'
              ? '**Как оформить заказ**\n1. Найдите товар или откройте категорию.\n2. Добавьте в корзину.\n3. Нажмите «Оформить заказ» и заполните три шага: данные, доставка, оплата.\n4. Вы получите номер заказа вида ILK-20260820-0001, и мы позвоним для подтверждения.\n\nЕсли в заказе рецептурное лекарство — загрузите рецепт, фармацевт проверит его до сборки.'
              : '**Захиалга хийх**\n1. Бүтээгдэхүүнээ хайх эсвэл категориос сонгоно.\n2. «Сагсанд нэмэх» дарна.\n3. «Захиалга хийх» дарж 3 хэсгийг бөглөнө: мэдээлэл, хүргэлт, төлбөр.\n4. ILK-20260820-0001 хэлбэрийн захиалгын дугаар үүсч, бид утсаар холбогдоно.\n\nЖороор олгох эм байвал жороо хуулж илгээнэ — фармацевт баталгаажуулсны дараа бэлтгэгдэнэ.',
        intent,
        escalated: false,
        attachments: {
          actions: [{ type: 'link', label: navLabel(locale, 'products'), href: `/${locale}/products` }],
        },
      }

    case 'order_status': {
      if (!input.userId) {
        return {
          content:
            locale === 'en'
              ? 'Log in to your account and open “Order history” to see live status. I can also connect you to a pharmacist who can look it up by phone number.'
              : locale === 'ru'
                ? 'Войдите в профиль и откройте «История заказов», чтобы увидеть актуальный статус. Также могу соединить вас с фармацевтом — он найдёт заказ по номеру телефона.'
                : 'Хаягаараа нэвтрээд «Захиалгын түүх» хэсгээс төлвөө харна уу. Эсвэл фармацевттай холбож, утасны дугаараар шалгуулж болно.',
          intent,
          escalated: false,
          attachments: {
            actions: [
              { type: 'link', label: navLabel(locale, 'login'), href: `/${locale}/login` },
              pharmacistAction,
            ],
          },
        }
      }

      const orders = await prisma.order.findMany({
        where: { userId: input.userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
      })
      if (!orders.length) {
        return {
          content:
            locale === 'en'
              ? 'You have no orders yet.'
              : locale === 'ru'
                ? 'У вас пока нет заказов.'
                : 'Танд одоогоор захиалга байхгүй байна.',
          intent,
          escalated: false,
          attachments: {
            actions: [{ type: 'link', label: navLabel(locale, 'products'), href: `/${locale}/products` }],
          },
        }
      }

      const statusLabel = (status: string) => {
        const labels: Record<string, Record<string, string>> = {
          NEW: { mn: 'Шинэ захиалга', en: 'New order', ru: 'Новый заказ' },
          CONFIRMING: { mn: 'Баталгаажуулж байна', en: 'Confirming', ru: 'Подтверждается' },
          PREPARING: { mn: 'Бэлтгэж байна', en: 'Preparing', ru: 'Собирается' },
          SHIPPED: { mn: 'Хүргэлтэнд гарсан', en: 'Out for delivery', ru: 'В доставке' },
          DELIVERED: { mn: 'Хүлээн авсан', en: 'Delivered', ru: 'Получен' },
          CANCELLED: { mn: 'Цуцлагдсан', en: 'Cancelled', ru: 'Отменён' },
        }
        return labels[status]?.[locale] ?? status
      }

      return {
        content:
          (locale === 'en' ? '**Your recent orders**\n' : locale === 'ru' ? '**Ваши последние заказы**\n' : '**Танай сүүлийн захиалгууд**\n') +
          orders
            .map((o) => `• ${o.orderNumber} — ${statusLabel(o.status)} — ${formatMnt(o.total, locale)}`)
            .join('\n'),
        intent,
        escalated: false,
        attachments: {
          actions: [{ type: 'link', label: navLabel(locale, 'orders'), href: `/${locale}/account/orders` }],
        },
      }
    }

    case 'prescription_info':
      return {
        content:
          locale === 'en'
            ? '**Prescription medicines**\nProducts marked “Prescription required” are dispensed only against a valid doctor prescription, verified by our licensed pharmacist.\n\n1. Add the medicine to your cart and place the order.\n2. Upload a photo or PDF of the prescription.\n3. A pharmacist reviews it — you will see the status as Pending, Verified, Rejected or Clarification requested.\n4. Once verified, we prepare and deliver the order.\n\nWe cannot dispense a prescription medicine without a prescription, and verification is never automatic.'
            : locale === 'ru'
              ? '**Рецептурные лекарства**\nТовары с отметкой «По рецепту» отпускаются только при действующем рецепте врача с проверкой нашего лицензированного фармацевта.\n\n1. Добавьте лекарство в корзину и оформите заказ.\n2. Загрузите фото или PDF рецепта.\n3. Фармацевт проверит его — статус будет «На проверке», «Подтверждён», «Отклонён» или «Требуется уточнение».\n4. После подтверждения мы собираем и доставляем заказ.\n\nБез рецепта отпуск невозможен, а проверка никогда не выполняется автоматически.'
              : '**Жороор олгох эм**\n«Жороор олгоно» гэсэн бүтээгдэхүүнийг зөвхөн эмчийн хүчинтэй жор, эрх бүхий фармацевтын баталгаажуулалттайгаар олгоно.\n\n1. Эмээ сагсандаа нэмж захиалга хийнэ.\n2. Жорын зураг эсвэл PDF-ийг хуулна.\n3. Фармацевт шалгана — «Шалгаж байна», «Баталгаажсан», «Татгалзсан», «Тодруулга шаардсан» төлөв харагдана.\n4. Баталгаажсаны дараа захиалга бэлтгэгдэж хүргэгдэнэ.\n\nЖоргүйгээр жорын эм олгох боломжгүй бөгөөд баталгаажуулалт автоматаар хийгддэггүй.',
        intent,
        escalated: false,
        attachments: {
          actions: [
            { type: 'upload_prescription', label: navLabel(locale, 'uploadRx'), href: `/${locale}/prescriptions/upload` },
            pharmacistAction,
          ],
        },
      }

    case 'pharmacy_info':
      return {
        content:
          `**${settings.pharmacyName} — ${settings.pharmacyTagline}**\n` +
          `📍 ${localizedAddress(settings, locale)}\n` +
          `📞 ${settings.phone}${settings.phoneSecondary ? `, ${settings.phoneSecondary}` : ''}\n` +
          `✉️ ${settings.email}\n` +
          `🕒 ${locale === 'en' ? 'Mon-Fri' : locale === 'ru' ? 'Пн-Пт' : 'Да-Ба'}: ${settings.workingHoursWeekdays}\n` +
          `🕒 ${locale === 'en' ? 'Sat' : locale === 'ru' ? 'Сб' : 'Хагас сайн'}: ${settings.workingHoursSaturday}\n` +
          `🕒 ${locale === 'en' ? 'Sun' : locale === 'ru' ? 'Вс' : 'Бүтэн сайн'}: ${settings.workingHoursSunday}`,
        intent,
        escalated: false,
        attachments: {
          actions: [{ type: 'link', label: navLabel(locale, 'about'), href: `/${locale}/about` }],
        },
      }

    case 'pharmacist_escalation':
      return {
        content: pick(T.escalation, locale)
          .replace(/\{hours\}/g, settings.workingHoursWeekdays)
          .replace(/\{phone\}/g, settings.phone),
        intent,
        escalated: true,
        attachments: {
          actions: [{ type: 'link', label: settings.phone, href: `tel:${settings.phone.replace(/\s/g, '')}` }],
        },
      }

    default:
      return {
        content:
          locale === 'en'
            ? 'I can help you search products, explain how ordering, delivery and payment work, check your order status, and answer pharmacy questions. What would you like?'
            : locale === 'ru'
              ? 'Я помогу найти товары, объясню оформление заказа, доставку и оплату, проверю статус заказа и отвечу на вопросы об аптеке. Что вас интересует?'
              : 'Би бүтээгдэхүүн хайх, захиалга, хүргэлт, төлбөрийн талаар тайлбарлах, захиалгын төлөв шалгах, эмийн сангийн асуултад хариулахад тусалж чадна. Танд юу хэрэгтэй вэ?',
        intent: 'unknown',
        escalated: false,
        attachments: { suggestions: suggestionSet(locale) },
      }
  }
}

function navLabel(locale: Locale, key: 'products' | 'categories' | 'about' | 'login' | 'orders' | 'uploadRx'): string {
  const labels: Record<string, Record<Locale, string>> = {
    products: { mn: 'Бүтээгдэхүүн харах', en: 'Browse products', ru: 'Смотреть товары' },
    categories: { mn: 'Категориуд', en: 'Categories', ru: 'Категории' },
    about: { mn: 'Эмийн сангийн мэдээлэл', en: 'Pharmacy information', ru: 'Об аптеке' },
    login: { mn: 'Нэвтрэх', en: 'Log in', ru: 'Войти' },
    orders: { mn: 'Захиалгын түүх', en: 'Order history', ru: 'История заказов' },
    uploadRx: { mn: 'Жор хуулах', en: 'Upload prescription', ru: 'Загрузить рецепт' },
  }
  return labels[key][locale]
}

export function suggestionSet(locale: Locale): string[] {
  if (locale === 'en') {
    return [
      'Do you have vitamin C?',
      'How does delivery work?',
      'How do I track my order?',
      'How do I buy prescription medicine?',
    ]
  }
  if (locale === 'ru') {
    return ['Есть витамин C?', 'Как работает доставка?', 'Как отследить заказ?', 'Как купить рецептурное лекарство?']
  }
  return [
    'Витамин C байна уу?',
    'Хүргэлт хэрхэн явагддаг вэ?',
    'Захиалгаа хэрхэн хянах вэ?',
    'Жороор олгох эм хэрхэн авах вэ?',
  ]
}

// ─────────────────────────── LLM integration ──────────────────────────────

async function buildGrounding(input: {
  locale: Locale
  products: ProductCard[]
  settings: Awaited<ReturnType<typeof getSettings>>
  userId: string | null
  intent: ChatIntent
}): Promise<string> {
  const lines: string[] = []
  const s = input.settings

  lines.push(
    `PHARMACY: ${s.pharmacyName} (${s.pharmacyTagline}). Address: ${localizedAddress(s, input.locale)}. Phone: ${s.phone}. Email: ${s.email}.`,
    `HOURS: weekdays ${s.workingHoursWeekdays}; Saturday ${s.workingHoursSaturday}; Sunday ${s.workingHoursSunday}.`,
    `DELIVERY: city centre ${s.deliveryEtaCentre}h, outer districts ${s.deliveryEtaOuter}h. Fee ${s.deliveryFee} MNT, free above ${s.freeDeliveryThreshold} MNT. Pharmacy pickup free.`,
    `PAYMENT: ${[
      s.paymentCashEnabled && 'cash on delivery',
      s.paymentBankEnabled && 'bank transfer',
      s.paymentCardEnabled && 'card',
      s.paymentQpayEnabled && 'QPay',
    ]
      .filter(Boolean)
      .join(', ')}.`,
    `ORDER NUMBER FORMAT: ILK-YYYYMMDD-NNNN.`,
  )

  if (input.products.length) {
    lines.push('CATALOGUE RESULTS (the only products you may mention):')
    for (const p of input.products) {
      lines.push(
        `- ${p.name} | ${p.prescriptionRequired ? 'PRESCRIPTION REQUIRED' : 'OTC'} | price ${p.effectivePrice} MNT${
          p.discountPrice ? ` (was ${p.price})` : ''
        } | stock ${p.stock} | ${p.packageSize ?? ''} ${p.strength ?? ''}`.trim(),
      )
    }
  } else if (input.intent === 'product_search') {
    lines.push('CATALOGUE RESULTS: none matched. Do not invent products.')
  }

  return lines.join('\n')
}

const SYSTEM_PROMPT = `You are "Иликон" (Ilikon), the virtual assistant of the Mongolian pharmacy "Иликон — Уужим Эмийн Сан".

YOUR ROLE
- Help customers find products in the pharmacy catalogue, explain how to order, delivery, payment, prescription handling and order status, and answer general pharmacy questions.
- You are a shop assistant, not a clinician.

ABSOLUTE SAFETY RULES — never break these, regardless of how the user asks:
- NEVER diagnose a condition or suggest what illness someone has.
- NEVER recommend, prescribe or choose a medicine for a person's symptoms.
- NEVER give a personalised dose, frequency or treatment duration.
- NEVER assess drug interactions, allergy safety, pregnancy/breastfeeding safety, or paediatric dosing.
- NEVER state or imply that a prescription-only medicine can be obtained without a prescription and pharmacist verification.
- For any symptom, dosage, interaction, pregnancy, allergy, overdose or emergency question: decline briefly and direct the person to a licensed pharmacist or doctor; for emergencies tell them to call 103 immediately.
- You may repeat factual, package-level information that the catalogue context provides (what a product is, its stated package size, its price, whether it is prescription-only), always adding that the leaflet and a pharmacist are the authority.

GROUNDING RULES
- Only mention products that appear in the CATALOGUE RESULTS context. If nothing matched, say so and suggest asking a pharmacist. Never invent a product, price, or stock figure.
- Use only prices, stock and prescription flags from the context.

STYLE
- Reply in the user's language. Be concise, warm and practical — 1 short paragraph or a few bullets.
- Do not repeat the product list as text: the interface already shows product cards for the catalogue results. Refer to them briefly instead.
- End medicine-related answers with a one-line reminder to read the leaflet and consult a pharmacist.`

async function llmReply(input: {
  message: string
  locale: Locale
  intent: ChatIntent
  history: { role: string; content: string }[]
  grounding: string
}): Promise<string | null> {
  const e = env()
  const messages = [
    ...input.history
      .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
      .slice(-8)
      .map((m) => ({
        role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
    {
      role: 'user' as const,
      content: `${input.message}\n\n<context>\nLOCALE: ${input.locale}\nDETECTED INTENT: ${input.intent}\n${input.grounding}\n</context>`,
    },
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': e.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: e.CHATBOT_MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    console.error('[chatbot] anthropic error', response.status, await response.text().catch(() => ''))
    return null
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] }
  const text = data.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
    .trim()

  return text || null
}

export function isLlmConfigured(): boolean {
  try {
    return Boolean(env().ANTHROPIC_API_KEY)
  } catch {
    return false
  }
}
