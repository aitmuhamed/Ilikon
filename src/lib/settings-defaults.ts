/**
 * Pharmacy settings shape and defaults.
 *
 * Dependency-free on purpose: the Prisma-backed loader in `settings.ts` is
 * server-only, but the seed script and any tooling need the schema and defaults
 * without pulling in a database client.
 *
 * Secrets never live here — payment and API credentials stay in environment
 * variables (see `env.ts`).
 */
export interface PharmacySettings {
  pharmacyName: string
  pharmacyTagline: string
  logoUrl: string
  phone: string
  phoneSecondary: string
  email: string
  addressMn: string
  addressEn: string
  addressRu: string
  mapEmbedUrl: string
  mapLink: string
  licenseNumber: string
  workingHoursWeekdays: string
  workingHoursSaturday: string
  workingHoursSunday: string
  deliveryFee: number
  freeDeliveryThreshold: number
  deliveryEtaCentre: string
  deliveryEtaOuter: string
  currency: string
  enabledLocales: string[]
  taxRatePct: number
  taxIncludedInPrice: boolean
  paymentCashEnabled: boolean
  paymentBankEnabled: boolean
  paymentCardEnabled: boolean
  paymentQpayEnabled: boolean
  notifyOnNewOrder: boolean
  notifyOnLowStock: boolean
  notifyOnExpiring: boolean
  notifyOnNewPrescription: boolean
  chatbotEnabled: boolean
  chatbotGreetingMn: string
  chatbotGreetingEn: string
  chatbotGreetingRu: string
  socialFacebook: string
  socialInstagram: string
  socialTwitter: string
  socialYoutube: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  lowStockThreshold: number
  expiryWarningDays: number

  // ── AI health consultation (§23) ───────────────────────────────────────
  /** Master switch for the whole consultation feature. */
  consultationEnabled: boolean
  /** Locales the consultation is offered in. */
  consultationLocales: string[]
  consultationDisclaimerMn: string
  consultationDisclaimerEn: string
  consultationDisclaimerRu: string
  /** Never overwhelm the customer — hard cap on suggested products (§19). */
  consultationMaxProducts: number
  /**
   * Triage level at or above which a pharmacist is notified automatically.
   * PHARMACIST_CONSULTATION means levels 1–3 all raise a staff alert.
   */
  consultationEscalationLevel: string
  /** Category allow-list. Empty means every category the guidelines permit. */
  consultationAllowedCategorySlugs: string[]
  /** Product ids that must never be recommended, whatever the guideline says. */
  consultationBlockedProductIds: string[]
  /** Minimum remaining shelf life, in days, for a product to be suggested. */
  consultationMinExpiryDays: number
  /** Use the LLM to phrase replies. Off = deterministic templates only. */
  consultationLlmEnabled: boolean
  /** Appended to the built-in system prompt; cannot replace the safety rules. */
  consultationSystemPromptExtra: string
  /** Days a consultation's health answers are retained before purging (§28). */
  consultationRetentionDays: number
  /** Emergency number quoted by the emergency response (§27). */
  emergencyNumber: string
  emergencyNote: string
}

export const DEFAULT_SETTINGS: PharmacySettings = {
  pharmacyName: 'Иликон',
  pharmacyTagline: 'Уужим Эмийн Сан',
  logoUrl: '',
  phone: '7700-1234',
  phoneSecondary: '9911-2233',
  email: 'info@ilikon.mn',
  addressMn: 'Улаанбаатар, Сүхбаатар дүүрэг, 1-р хороо, Энхтайваны өргөн чөлөө 25, Иликон төв',
  addressEn: 'Ilikon Centre, 25 Peace Avenue, Khoroo 1, Sukhbaatar District, Ulaanbaatar',
  addressRu: 'Улан-Батор, Сухэ-Баторский район, 1-й хороо, проспект Мира 25, центр Иликон',
  // Coordinates of the real branch, resolved from the pharmacy's Google Maps
  // listing ("Иликон ( уужим эмийн сан)"). A maps.app.goo.gl short link cannot
  // be put in an iframe, so the embed uses the coordinates and the outbound
  // link uses the short link, which opens the actual place card.
  mapEmbedUrl: 'https://www.google.com/maps?q=47.9218481,106.956691&z=17&hl=mn&output=embed',
  mapLink: 'https://maps.app.goo.gl/AEZh3xfh5b1p4aAG8',
  licenseNumber: 'ЭМГ-2019/0457',
  workingHoursWeekdays: '09:00 - 21:00',
  workingHoursSaturday: '10:00 - 19:00',
  workingHoursSunday: '10:00 - 17:00',
  deliveryFee: 5000,
  freeDeliveryThreshold: 80000,
  deliveryEtaCentre: '1-2',
  deliveryEtaOuter: '2-4',
  currency: 'MNT',
  enabledLocales: ['mn', 'en', 'ru'],
  taxRatePct: 0,
  taxIncludedInPrice: true,
  paymentCashEnabled: true,
  paymentBankEnabled: true,
  paymentCardEnabled: true,
  paymentQpayEnabled: true,
  notifyOnNewOrder: true,
  notifyOnLowStock: true,
  notifyOnExpiring: true,
  notifyOnNewPrescription: true,
  chatbotEnabled: true,
  chatbotGreetingMn:
    'Сайн байна уу! Би Иликон, Уужим Эмийн Сангийн виртуал туслах. Танд эм, бүтээгдэхүүн хайх эсвэл захиалга хийхэд тусалъя.',
  chatbotGreetingEn:
    'Hello! I am Ilikon, the virtual assistant of Uujim Pharmacy. I can help you find medicines and products or place an order.',
  chatbotGreetingRu:
    'Здравствуйте! Я Иликон, виртуальный помощник аптеки Уужим. Помогу найти лекарства и товары или оформить заказ.',
  socialFacebook: 'https://facebook.com/ilikon.mn',
  socialInstagram: 'https://instagram.com/ilikon.mn',
  socialTwitter: '',
  socialYoutube: '',
  seoTitle: 'Иликон — Уужим Эмийн Сан | Онлайн эмийн сан',
  seoDescription:
    'Иликон Уужим Эмийн Сан — эм, витамин, эрүүл мэндийн хэрэгсэл онлайнаар захиалж, Улаанбаатар хотод хүргүүлээрэй.',
  seoKeywords: 'эмийн сан, онлайн эмийн сан, эм, витамин, Улаанбаатар, Иликон, Уужим',
  lowStockThreshold: 10,
  expiryWarningDays: 90,

  consultationEnabled: true,
  consultationLocales: ['mn', 'en', 'ru'],
  consultationDisclaimerMn:
    'Энэ зөвлөгөө нь эмчийн онош, үзлэгийг орлохгүй. Яаралтай шинж тэмдэг илэрвэл яаралтай эмнэлгийн тусламж авна уу.',
  consultationDisclaimerEn:
    'This guidance does not replace a doctor’s diagnosis or examination. If you have urgent symptoms, seek emergency medical care.',
  consultationDisclaimerRu:
    'Эта консультация не заменяет диагноз и осмотр врача. При срочных симптомах обратитесь за экстренной медицинской помощью.',
  consultationMaxProducts: 3,
  consultationEscalationLevel: 'PHARMACIST_CONSULTATION',
  consultationAllowedCategorySlugs: [],
  consultationBlockedProductIds: [],
  consultationMinExpiryDays: 60,
  consultationLlmEnabled: true,
  consultationSystemPromptExtra: '',
  consultationRetentionDays: 365,
  emergencyNumber: '103',
  emergencyNote:
    'Улаанбаатар хотод яаралтай тусламжийн дугаар 103. Хамгийн ойрын эмнэлгийн яаралтай тасагт хандаж болно.',
}

/** Which admin settings tab each key belongs to. */
export const SETTING_GROUPS: Record<keyof PharmacySettings, string> = {
  pharmacyName: 'general', pharmacyTagline: 'general', logoUrl: 'general',
  phone: 'general', phoneSecondary: 'general', email: 'general',
  addressMn: 'general', addressEn: 'general', addressRu: 'general',
  mapEmbedUrl: 'general', mapLink: 'general', licenseNumber: 'general',
  workingHoursWeekdays: 'general', workingHoursSaturday: 'general', workingHoursSunday: 'general',
  deliveryFee: 'delivery', freeDeliveryThreshold: 'delivery',
  deliveryEtaCentre: 'delivery', deliveryEtaOuter: 'delivery',
  currency: 'general', enabledLocales: 'general',
  taxRatePct: 'tax', taxIncludedInPrice: 'tax',
  paymentCashEnabled: 'payment', paymentBankEnabled: 'payment',
  paymentCardEnabled: 'payment', paymentQpayEnabled: 'payment',
  notifyOnNewOrder: 'notification', notifyOnLowStock: 'notification',
  notifyOnExpiring: 'notification', notifyOnNewPrescription: 'notification',
  chatbotEnabled: 'chatbot', chatbotGreetingMn: 'chatbot',
  chatbotGreetingEn: 'chatbot', chatbotGreetingRu: 'chatbot',
  socialFacebook: 'social', socialInstagram: 'social',
  socialTwitter: 'social', socialYoutube: 'social',
  seoTitle: 'seo', seoDescription: 'seo', seoKeywords: 'seo',
  lowStockThreshold: 'inventory', expiryWarningDays: 'inventory',
  consultationEnabled: 'consultation', consultationLocales: 'consultation',
  consultationDisclaimerMn: 'consultation', consultationDisclaimerEn: 'consultation',
  consultationDisclaimerRu: 'consultation', consultationMaxProducts: 'consultation',
  consultationEscalationLevel: 'consultation',
  consultationAllowedCategorySlugs: 'consultation',
  consultationBlockedProductIds: 'consultation',
  consultationMinExpiryDays: 'consultation',
  consultationLlmEnabled: 'consultation',
  consultationSystemPromptExtra: 'consultation',
  consultationRetentionDays: 'consultation',
  emergencyNumber: 'consultation', emergencyNote: 'consultation',
}

/**
 * Settings that change what the AI is allowed to do clinically. Editing these
 * requires the dedicated `consultations.safety` permission rather than plain
 * settings access (§23).
 */
export const SAFETY_CRITICAL_SETTINGS: (keyof PharmacySettings)[] = [
  'consultationAllowedCategorySlugs',
  'consultationBlockedProductIds',
  'consultationEscalationLevel',
  'consultationMinExpiryDays',
  'consultationSystemPromptExtra',
  'consultationDisclaimerMn',
  'consultationDisclaimerEn',
  'consultationDisclaimerRu',
  'emergencyNumber',
  'emergencyNote',
]

/** Consultation disclaimer in the requested locale, falling back to Mongolian. */
export function localizedDisclaimer(settings: PharmacySettings, locale: string): string {
  if (locale === 'en') return settings.consultationDisclaimerEn || settings.consultationDisclaimerMn
  if (locale === 'ru') return settings.consultationDisclaimerRu || settings.consultationDisclaimerMn
  return settings.consultationDisclaimerMn
}

/** Address in the requested locale, falling back to Mongolian. */
export function localizedAddress(settings: PharmacySettings, locale: string): string {
  if (locale === 'en') return settings.addressEn || settings.addressMn
  if (locale === 'ru') return settings.addressRu || settings.addressMn
  return settings.addressMn
}

export function localizedGreeting(settings: PharmacySettings, locale: string): string {
  if (locale === 'en') return settings.chatbotGreetingEn
  if (locale === 'ru') return settings.chatbotGreetingRu
  return settings.chatbotGreetingMn
}
