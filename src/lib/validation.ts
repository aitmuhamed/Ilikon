import { z } from 'zod'

import { LOCALES } from './locale-types'
import { normalizePhone } from './utils'

/**
 * All request validation in one place so the API and the forms agree on the
 * rules. Every string is trimmed and length-capped — an unbounded text field is
 * a denial-of-service vector as much as a data-quality problem.
 */

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((v) => /^\d{8}$/.test(v), 'INVALID_PHONE')

export const emailSchema = z.string().trim().toLowerCase().email('INVALID_EMAIL').max(190)

export const passwordSchema = z
  .string()
  .min(8, 'PASSWORD_TOO_SHORT')
  .max(128)
  .refine((v) => /[a-zа-яё]/i.test(v) && /\d/.test(v), 'PASSWORD_WEAK')

export const localeSchema = z.enum(LOCALES)
const shortText = (max = 190) => z.string().trim().min(1).max(max)
const optionalText = (max = 2000) =>
  z.string().trim().max(max).optional().or(z.literal('')).transform((v) => (v ? v : undefined))
const mnt = z.coerce.number().int().min(0).max(1_000_000_000)
const optionalMnt = z.coerce.number().int().min(0).max(1_000_000_000).optional().nullable()
const cuid = z.string().min(1).max(40)

// ─────────────────────────────── auth ─────────────────────────────────────

export const registerSchema = z
  .object({
    fullName: shortText(120),
    phone: phoneSchema,
    email: emailSchema.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
    password: passwordSchema,
    confirmPassword: z.string(),
    locale: localeSchema.optional(),
    marketingOptIn: z.coerce.boolean().optional().default(false),
    agreeTerms: z.literal(true, { errorMap: () => ({ message: 'AGREE_REQUIRED' }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'PASSWORD_MISMATCH',
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(190),
  password: z.string().min(1).max(128),
})

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1).max(190),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'PASSWORD_MISMATCH',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'PASSWORD_MISMATCH',
    path: ['confirmPassword'],
  })

export const updateProfileSchema = z.object({
  fullName: shortText(120),
  email: emailSchema.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  phone: phoneSchema,
  locale: localeSchema.optional(),
  marketingOptIn: z.coerce.boolean().optional(),
})

// ───────────────────────────── addresses ──────────────────────────────────

export const addressSchema = z.object({
  label: optionalText(60),
  recipient: shortText(120),
  phone: phoneSchema,
  city: z.string().trim().max(80).default('Улаанбаатар'),
  district: shortText(80),
  khoroo: shortText(40),
  addressLine: shortText(300),
  instructions: optionalText(500),
  isDefault: z.coerce.boolean().optional().default(false),
})

// ─────────────────────────────── cart ─────────────────────────────────────

export const cartAddSchema = z.object({
  productId: cuid,
  quantity: z.coerce.number().int().min(1).max(99).default(1),
})

export const cartUpdateSchema = z.object({
  productId: cuid,
  quantity: z.coerce.number().int().min(0).max(99),
})

export const couponApplySchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(40),
})

// ───────────────────────────── checkout ───────────────────────────────────

export const checkoutSchema = z
  .object({
    customerName: shortText(120),
    customerPhone: phoneSchema,
    customerEmail: emailSchema.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
    deliveryMethod: z.enum(['PHARMACY_PICKUP', 'HOME_DELIVERY']),
    district: optionalText(80),
    khoroo: optionalText(40),
    addressLine: optionalText(300),
    instructions: optionalText(500),
    saveAddress: z.coerce.boolean().optional().default(false),
    paymentMethod: z.enum(['CASH_ON_DELIVERY', 'BANK_TRANSFER', 'CARD', 'QPAY']),
    customerNote: optionalText(500),
    couponCode: z.string().trim().toUpperCase().max(40).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
    agreeTerms: z.literal(true, { errorMap: () => ({ message: 'AGREE_REQUIRED' }) }),
  })
  .refine(
    (d) =>
      d.deliveryMethod === 'PHARMACY_PICKUP' ||
      Boolean(d.district && d.khoroo && d.addressLine),
    { message: 'DELIVERY_ADDRESS_REQUIRED', path: ['addressLine'] },
  )

// ────────────────────────── prescriptions ─────────────────────────────────

export const prescriptionMetaSchema = z.object({
  orderId: cuid.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  patientName: optionalText(120),
  doctorName: optionalText(120),
  clinic: optionalText(160),
  issuedAt: z.string().trim().optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  expiresAt: z.string().trim().optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  customerNote: optionalText(600),
})

export const prescriptionVerifySchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'REQUEST_CLARIFICATION', 'NOTE']),
    reason: optionalText(600),
    pharmacistNote: optionalText(1000),
  })
  .refine((d) => d.action !== 'REJECT' || Boolean(d.reason), {
    message: 'REASON_REQUIRED',
    path: ['reason'],
  })
  .refine((d) => d.action !== 'REQUEST_CLARIFICATION' || Boolean(d.reason), {
    message: 'REASON_REQUIRED',
    path: ['reason'],
  })

// ─────────────────────────────── orders ───────────────────────────────────

export const orderStatusSchema = z.object({
  status: z.enum(['NEW', 'CONFIRMING', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  message: optionalText(500),
})

export const orderCancelSchema = z.object({
  reason: shortText(500),
})

export const orderNoteSchema = z.object({
  body: shortText(1000),
})

export const paymentStatusSchema = z.object({
  status: z.enum(['PENDING', 'AWAITING_CONFIRMATION', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED']),
  providerRef: optionalText(120),
  failureReason: optionalText(300),
})

export const deliveryUpdateSchema = z.object({
  status: z.enum(['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED']).optional(),
  courierId: cuid.optional().nullable(),
  trackingNote: optionalText(500),
  scheduledFor: z.string().optional().nullable(),
})

// ────────────────────────────── products ──────────────────────────────────

const translationSchema = z.object({
  name: z.string().trim().max(200).optional(),
  shortDescription: z.string().trim().max(400).optional(),
  description: z.string().trim().max(6000).optional(),
  ingredients: z.string().trim().max(3000).optional(),
  activeIngredients: z.string().trim().max(1000).optional(),
  dosage: z.string().trim().max(3000).optional(),
  usage: z.string().trim().max(3000).optional(),
  warnings: z.string().trim().max(3000).optional(),
  sideEffects: z.string().trim().max(3000).optional(),
  storage: z.string().trim().max(1000).optional(),
})

export const productSchema = z
  .object({
    sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9\-_]+$/, 'INVALID_SKU'),
    barcode: z.string().trim().max(40).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
    slug: z.string().trim().max(100).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
    name: shortText(200),
    categoryId: cuid,
    brandId: cuid.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
    manufacturerId: cuid.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
    prescriptionRequired: z.coerce.boolean().default(false),
    isControlled: z.coerce.boolean().default(false),
    price: mnt,
    discountPrice: optionalMnt,
    costPrice: optionalMnt,
    taxRatePct: z.coerce.number().int().min(0).max(100).default(0),
    status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
    isFeatured: z.coerce.boolean().default(false),
    isNew: z.coerce.boolean().default(false),
    weightGrams: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
    packageSize: optionalText(80),
    dosageForm: optionalText(80),
    strength: optionalText(80),
    expiryDate: z.string().optional().nullable(),
    registrationNo: optionalText(80),
    metaTitle: optionalText(200),
    metaDescription: optionalText(400),
    stockQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
    lowStockThreshold: z.coerce.number().int().min(0).max(100_000).default(10),
    shelfLocation: optionalText(60),
    images: z
      .array(z.object({ fileKey: z.string().trim().min(1).max(500), alt: z.string().trim().max(200).optional() }))
      .max(8)
      .optional()
      .default([]),
    relatedProductIds: z.array(cuid).max(12).optional().default([]),
    translations: z.record(localeSchema, translationSchema).optional().default({}),
  })
  .refine((d) => !d.discountPrice || d.discountPrice < d.price, {
    message: 'DISCOUNT_MUST_BE_LOWER',
    path: ['discountPrice'],
  })

export const productUpdateSchema = productSchema

// ───────────────────────────── categories ─────────────────────────────────

export const categorySchema = z.object({
  name: shortText(120),
  slug: z.string().trim().max(100).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  parentId: cuid.optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
  imageKey: optionalText(500),
  icon: optionalText(40),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
  isFeatured: z.coerce.boolean().default(false),
  metaTitle: optionalText(200),
  metaDescription: optionalText(400),
  translations: z
    .record(localeSchema, z.object({ name: z.string().trim().max(120).optional(), description: z.string().trim().max(1000).optional() }))
    .optional()
    .default({}),
})

// ─────────────────────────────── brands ───────────────────────────────────

export const brandSchema = z.object({
  name: shortText(120),
  slug: z.string().trim().max(100).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  logoKey: optionalText(500),
  description: optionalText(1000),
  country: optionalText(80),
  website: z.string().trim().url().max(200).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  isActive: z.coerce.boolean().default(true),
})

export const manufacturerSchema = z.object({
  name: shortText(160),
  slug: z.string().trim().max(100).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  country: optionalText(80),
  address: optionalText(300),
  contact: optionalText(200),
  isActive: z.coerce.boolean().default(true),
})

// ───────────────────────────── inventory ──────────────────────────────────

export const inventoryAdjustSchema = z.object({
  productId: cuid,
  type: z.enum(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED', 'RETURN']),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  reason: optionalText(300),
  reference: optionalText(120),
})

export const inventoryThresholdSchema = z.object({
  productId: cuid,
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000),
  reorderLevel: z.coerce.number().int().min(0).max(100_000).optional(),
  shelfLocation: optionalText(60),
})

export const batchSchema = z.object({
  productId: cuid,
  lotNumber: shortText(60),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  expiryDate: z.string().min(4),
  supplier: optionalText(160),
  isBlocked: z.coerce.boolean().default(false),
})

// ────────────────────────────── coupons ───────────────────────────────────

export const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9\-_]+$/, 'INVALID_CODE'),
    description: optionalText(300),
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z.coerce.number().int().min(1).max(1_000_000),
    minOrderAmount: mnt.default(0),
    maxDiscountAmount: optionalMnt,
    startsAt: z.string().min(4),
    endsAt: z.string().min(4),
    usageLimit: z.coerce.number().int().min(1).max(1_000_000).optional().nullable(),
    perCustomerLimit: z.coerce.number().int().min(1).max(1000).default(1),
    isActive: z.coerce.boolean().default(true),
  })
  .refine((d) => d.discountType !== 'PERCENTAGE' || d.discountValue <= 100, {
    message: 'PERCENT_OUT_OF_RANGE',
    path: ['discountValue'],
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: 'END_BEFORE_START',
    path: ['endsAt'],
  })

// ───────────────────────────── promotions ─────────────────────────────────

export const promotionSchema = z.object({
  title: shortText(160),
  subtitle: optionalText(300),
  imageKey: optionalText(500),
  linkUrl: optionalText(300),
  placement: z.enum(['HOME_HERO', 'HOME_STRIP', 'CATEGORY_BANNER', 'SIDEBAR']).default('HOME_STRIP'),
  badgeText: optionalText(40),
  bgColor: optionalText(20),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.coerce.boolean().default(true),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  categoryId: cuid.optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
  productId: cuid.optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
  translations: z
    .record(localeSchema, z.object({ title: z.string().trim().max(160).optional(), subtitle: z.string().trim().max(300).optional() }))
    .optional()
    .default({}),
})

// ─────────────────────────────── reviews ──────────────────────────────────

export const reviewSchema = z.object({
  productId: cuid,
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalText(120),
  comment: optionalText(1500),
})

export const reviewModerateSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'HIDDEN']),
})

// ──────────────────────────── notifications ───────────────────────────────

export const notificationSendSchema = z.object({
  audience: z.enum(['CUSTOMER', 'STAFF']),
  type: z.enum(['PROMOTION', 'SYSTEM']),
  title: shortText(160),
  body: shortText(1000),
  linkUrl: optionalText(300),
  /** Promotional sends only reach customers who opted in. */
  respectMarketingConsent: z.coerce.boolean().default(true),
})

// ───────────────────────────── staff & roles ──────────────────────────────

export const staffSchema = z.object({
  fullName: shortText(120),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  password: passwordSchema.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  roleId: cuid,
  jobTitle: optionalText(120),
  licenseNumber: optionalText(80),
  status: z.enum(['ACTIVE', 'DISABLED', 'PENDING']).default('ACTIVE'),
  notes: optionalText(1000),
})

export const rolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string().min(1).max(80)).max(200),
})

export const customerStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
})

// ────────────────────────────── settings ──────────────────────────────────

export const settingsSchema = z.record(z.string().max(80), z.unknown())

// ─────────────────────────────── chatbot ──────────────────────────────────

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  sessionId: z.string().trim().min(8).max(80).optional(),
  locale: localeSchema.optional(),
  escalate: z.coerce.boolean().optional().default(false),
})

// ───────────────────────────── analytics ──────────────────────────────────

export const analyticsEventSchema = z.object({
  name: z.enum([
    'product_viewed',
    'add_to_cart',
    'checkout_started',
    'order_completed',
    'search_performed',
    'category_viewed',
    'chatbot_opened',
  ]),
  productId: cuid.optional(),
  value: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  metadata: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
})

// ───────────────────── product listing query params ───────────────────────

export const productQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z.string().optional(),
  prescription: z.enum(['all', 'rx', 'otc']).optional(),
  discount: z.string().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  sort: z
    .enum(['popular', 'newest', 'price_asc', 'price_desc', 'discount', 'name', 'rating'])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(60).optional(),
  featured: z.string().optional(),
})

export type ProductQuery = z.infer<typeof productQuerySchema>

// ───────────────────── AI health consultation (§1–§21) ────────────────────

export const consultationStartSchema = z.object({
  locale: localeSchema.optional(),
})

export const consultationConsentSchema = z.object({
  accepted: z.literal(true, { errorMap: () => ({ message: 'CONSENT_REQUIRED' }) }),
})

/**
 * The answer payload is intentionally untyped here: the shape a question
 * accepts is defined by the question itself, and `parseAnswer` in
 * `consultation/questionnaire.ts` validates it against the question that was
 * actually asked. Accepting `unknown` at the edge and validating against the
 * catalogue is what stops a client from submitting an option that no question
 * ever offered.
 */
export const consultationAnswerSchema = z.object({
  questionKey: z.string().trim().min(1).max(80),
  value: z.unknown(),
})

export const consultationHandoffSchema = z.object({
  note: optionalText(1000),
  phone: z.string().trim().max(40).optional(),
})

export const consultationReviewSchema = z.object({
  action: z.enum(['ACCEPT', 'MODIFY', 'REJECT', 'NOTE', 'REQUEST_INFO', 'RECOMMEND_PRODUCT']),
  pharmacistRecommendation: optionalText(2000),
  reasonForChange: optionalText(1000),
  note: optionalText(2000),
  triageOverride: z
    .enum(['EMERGENCY', 'URGENT_MEDICAL_REVIEW', 'PHARMACIST_CONSULTATION', 'SELF_CARE'])
    .optional(),
  /** Required for RECOMMEND_PRODUCT: the product the pharmacist adds. */
  productId: cuid.optional(),
  /** Recommendation rows the pharmacist withdraws from the customer's result. */
  removeRecommendationIds: z.array(cuid).max(10).optional(),
})

export const consultationListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  triage: z
    .enum(['EMERGENCY', 'URGENT_MEDICAL_REVIEW', 'PHARMACIST_CONSULTATION', 'SELF_CARE'])
    .optional(),
  status: z
    .enum(['DRAFT', 'IN_PROGRESS', 'ASSESSED', 'PHARMACIST_REVIEW', 'REVIEWED', 'ABANDONED'])
    .optional(),
  symptom: z.string().trim().max(60).optional(),
  scope: z.enum(['mine', 'all']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(60).optional(),
})

export type ConsultationListQuery = z.infer<typeof consultationListQuerySchema>

export const medicineLookupSchema = z.object({
  q: z.string().trim().max(120).optional(),
  barcode: z.string().trim().max(60).optional(),
  locale: localeSchema.optional(),
})
