import 'server-only'

import { prisma } from '../prisma'
import { audit } from '../audit'
import { notifyCustomer, notifyStaff } from '../notifications'
import { getSettings } from '../settings'
import { pickTranslation } from '../products'
import type { SessionUser } from '../auth'
import { ApiError, notFound } from '../api'

import { logStage } from './audit'
import { productIngredientMap } from './ingredients'
import { reload, type ConsultationRecord } from './session'
import { symptomLabel, redFlagLabel, tr, t, type TriageLevelKey } from './types'

/**
 * Pharmacist handoff (§20) and the AI + pharmacist hierarchy (§21).
 *
 * The hierarchy is one-directional: a pharmacist may override the AI, and the
 * AI may never override a pharmacist. Concretely, a reviewed consultation is
 * never re-assessed by the engine, and `addedByPharmacist` rows survive every
 * re-run of the pipeline.
 *
 * Every review stores the AI's proposal alongside the pharmacist's, plus the
 * stated reason for the change, so a later reader can see both sides.
 */

// ────────────────────────────── handoff packet ─────────────────────────────

export interface HandoffPacket {
  consultationId: string
  code: string
  createdAt: string
  customer: {
    userId: string | null
    name: string | null
    phone: string | null
    authenticated: boolean
  }
  patient: {
    ageBand: string | null
    exactAgeYears: number | null
    sex: string | null
    pregnancy: string | null
  }
  complaint: {
    primarySymptom: string | null
    primarySymptomLabel: string
    secondarySymptoms: string[]
    freeText: string | null
    onset: string | null
    durationCourse: string | null
    severity: number | null
    worsening: boolean | null
  }
  medicalHistory: { code: string; detail: string | null }[]
  allergies: { medication: string; reaction: string | null; resolved: boolean }[]
  currentMedications: {
    name: string
    dose: string | null
    frequency: string | null
    source: string
    resolved: boolean
  }[]
  redFlags: { code: string; label: string; severity: string; source: string }[]
  aiTriage: {
    level: string | null
    recommendationType: string | null
    reason: string | null
    selfCareEligible: boolean
    pharmacistReviewRequired: boolean
    model: string | null
    promptVersion: string | null
    rulesVersion: string | null
  }
  aiRecommendations: {
    productName: string
    status: string
    interactionStatus: string
    rank: number
    reason: string | null
    safetyNotes: string | null
    blockedReason: string | null
  }[]
  customerNote: string | null
}

/**
 * The complete clinical picture a pharmacist needs, assembled in one object so
 * the notification, the admin screen and the audit record all show the same
 * thing.
 */
export async function buildHandoffPacket(
  consultation: ConsultationRecord,
  customerNote?: string | null,
): Promise<HandoffPacket> {
  const locale = consultation.locale
  const customer = consultation.userId
    ? await prisma.user.findUnique({
        where: { id: consultation.userId },
        select: { id: true, fullName: true, phone: true },
      })
    : null

  return {
    consultationId: consultation.id,
    code: consultation.code,
    createdAt: consultation.createdAt.toISOString(),
    customer: {
      userId: consultation.userId,
      name: customer?.fullName ?? null,
      phone: customer?.phone ?? null,
      authenticated: Boolean(consultation.userId),
    },
    patient: {
      ageBand: consultation.ageBand,
      exactAgeYears: consultation.exactAgeYears,
      sex: consultation.sex,
      pregnancy: consultation.pregnancy,
    },
    complaint: {
      primarySymptom: consultation.primarySymptom,
      primarySymptomLabel: symptomLabel(consultation.primarySymptom, locale),
      secondarySymptoms: consultation.secondarySymptoms.map((code) => symptomLabel(code, locale)),
      freeText: consultation.symptomFreeText,
      onset: consultation.onsetCode,
      durationCourse: consultation.course,
      severity: consultation.severity,
      worsening: consultation.worsening,
    },
    medicalHistory: consultation.conditions.map((row) => ({
      code: row.conditionCode,
      detail: row.detail,
    })),
    allergies: consultation.allergies.map((row) => ({
      medication: row.medication,
      reaction: row.reaction,
      resolved: Boolean(row.ingredientKey),
    })),
    currentMedications: consultation.medications.map((row) => ({
      name: row.name,
      dose: row.dose,
      frequency: row.frequency,
      source: row.source,
      resolved: !row.unresolved,
    })),
    redFlags: consultation.redFlags.map((row) => ({
      code: row.code,
      label: row.label || redFlagLabel(row.code, locale),
      severity: row.severity,
      source: row.source,
    })),
    aiTriage: {
      level: consultation.triageLevel,
      recommendationType: consultation.recommendationType,
      reason: consultation.triageReason,
      selfCareEligible: consultation.selfCareEligible,
      pharmacistReviewRequired: consultation.pharmacistReviewRequired,
      model: consultation.aiModel,
      promptVersion: consultation.promptVersion,
      rulesVersion: consultation.rulesVersion,
    },
    aiRecommendations: consultation.recommendations
      .filter((row) => !row.addedByPharmacist)
      .map((row) => ({
        productName: row.productName,
        status: row.status,
        interactionStatus: row.interactionStatus,
        rank: row.rank,
        reason: row.reason,
        safetyNotes: row.safetyNotes,
        blockedReason: row.blockedReason,
      })),
    customerNote: customerNote ?? null,
  }
}

const HANDOFF_CONFIRMATION = t(
  'Фармацевттай зөвлөх хүсэлт бүртгэгдлээ. Ажлын цагаар эм зүйч тантай холбогдож, зөвлөгөө өгнө.',
  'Your request to consult a pharmacist has been recorded. A pharmacist will contact you during working hours.',
  'Ваш запрос на консультацию фармацевта зарегистрирован. Фармацевт свяжется с вами в рабочее время.',
)

export interface HandoffResult {
  consultation: ConsultationRecord
  packet: HandoffPacket
  message: string
}

/** "Фармацевттай зөвлөх" — hands the consultation to a human. */
export async function handoffToPharmacist(input: {
  consultation: ConsultationRecord
  note?: string | null
  request?: Request | null
}): Promise<HandoffResult> {
  const consultation = input.consultation
  const packet = await buildHandoffPacket(consultation, input.note)

  await prisma.consultation.update({
    where: { id: consultation.id },
    data: {
      status: consultation.status === 'REVIEWED' ? 'REVIEWED' : 'PHARMACIST_REVIEW',
      handedOffAt: consultation.handedOffAt ?? new Date(),
      pharmacistReviewRequired: true,
    },
  })

  // The notification carries NO clinical detail (§28).
  //
  // `GET /api/notifications` is scoped by `isStaff`, not by a permission, so a
  // courier account can read staff notifications. Anything put here would be
  // readable by every staff member and would bypass `consultations.view`
  // entirely. Only the reference and the urgency level travel; the packet stays
  // behind the permission-gated, audit-logged admin page that `linkUrl` points
  // at.
  await notifyStaff({
    type: 'NEW_CONSULTATION',
    title: `Фармацевтын зөвлөгөө хүссэн — ${consultation.code}`,
    body: `Ангилал: ${consultation.triageLevel ?? 'үнэлгээгүй'}.${
      input.note ? ' Харилцагч тэмдэглэл үлдээсэн.' : ''
    } Дэлгэрэнгүйг зөвлөгөөний хуудсаас үзнэ үү.`,
    linkUrl: `/admin/consultations/${consultation.id}`,
    data: { consultationId: consultation.id },
  })

  await logStage({
    consultationId: consultation.id,
    stage: 'pharmacist_handoff',
    summary: `Handed off to pharmacist${input.note ? ' with a customer note' : ''}`,
    payload: { note: input.note ?? null, triageLevel: consultation.triageLevel },
  })

  await audit({
    action: 'consultation.handoff',
    entity: 'Consultation',
    entityId: consultation.id,
    summary: `Consultation ${consultation.code} handed to a pharmacist`,
    request: input.request,
  })

  return {
    consultation: await reload(consultation.id),
    packet,
    message: tr(HANDOFF_CONFIRMATION, consultation.locale),
  }
}

// ───────────────────────────── pharmacist review ───────────────────────────

export type ReviewAction =
  | 'ACCEPT'
  | 'MODIFY'
  | 'REJECT'
  | 'NOTE'
  | 'REQUEST_INFO'
  | 'RECOMMEND_PRODUCT'

export interface ReviewInput {
  consultation: ConsultationRecord
  pharmacist: SessionUser
  action: ReviewAction
  pharmacistRecommendation?: string
  reasonForChange?: string
  note?: string
  triageOverride?: TriageLevelKey
  productId?: string
  removeRecommendationIds?: string[]
  request?: Request | null
}

const CUSTOMER_MESSAGES: Record<ReviewAction, { mn: string; en: string; ru: string }> = {
  ACCEPT: t(
    'Эм зүйч таны зөвлөгөөг хянаж баталлаа.',
    'A pharmacist has reviewed and confirmed your consultation.',
    'Фармацевт проверил и подтвердил вашу консультацию.',
  ),
  MODIFY: t(
    'Эм зүйч таны зөвлөгөөг хянаж, зөвлөмжийг шинэчиллээ.',
    'A pharmacist has reviewed your consultation and updated the advice.',
    'Фармацевт проверил вашу консультацию и обновил рекомендацию.',
  ),
  REJECT: t(
    'Эм зүйч таны нөхцөлд жоргүй бүтээгдэхүүн тохиромжгүй гэж дүгнэлээ. Тайлбарыг уншина уу.',
    'A pharmacist concluded that an over-the-counter product is not suitable for you. Please read their note.',
    'Фармацевт заключил, что безрецептурное средство вам не подходит. Прочитайте примечание.',
  ),
  NOTE: t(
    'Эм зүйч таны зөвлөгөөнд тэмдэглэл нэмлээ.',
    'A pharmacist added a note to your consultation.',
    'Фармацевт добавил примечание к вашей консультации.',
  ),
  REQUEST_INFO: t(
    'Эм зүйч танаас нэмэлт мэдээлэл авахыг хүсэж байна.',
    'A pharmacist needs some more information from you.',
    'Фармацевту нужна дополнительная информация от вас.',
  ),
  RECOMMEND_PRODUCT: t(
    'Эм зүйч танд тохирох бүтээгдэхүүн санал болголоо.',
    'A pharmacist has recommended a product for you.',
    'Фармацевт порекомендовал вам средство.',
  ),
}

export async function recordReview(input: ReviewInput): Promise<ConsultationRecord> {
  const consultation = input.consultation

  if (input.action === 'RECOMMEND_PRODUCT' && !input.productId) {
    throw new ApiError(422, 'PRODUCT_REQUIRED', 'A product must be selected for this action')
  }

  // Snapshot of what the AI proposed, frozen at review time (§21).
  const aiRecommendation = {
    triageLevel: consultation.triageLevel,
    recommendationType: consultation.recommendationType,
    triageReason: consultation.triageReason,
    understood: consultation.aiUnderstood,
    safetyAssessment: consultation.aiSafetyAssessment,
    nextStep: consultation.aiNextStep,
    precautions: consultation.aiPrecautions,
    products: consultation.recommendations
      .filter((row) => !row.addedByPharmacist)
      .map((row) => ({
        productName: row.productName,
        status: row.status,
        rank: row.rank,
        reason: row.reason,
      })),
    model: consultation.aiModel,
    promptVersion: consultation.promptVersion,
    rulesVersion: consultation.rulesVersion,
  }

  await prisma.consultationReview.create({
    data: {
      consultationId: consultation.id,
      pharmacistId: input.pharmacist.id,
      action: input.action as never,
      aiRecommendation: aiRecommendation as never,
      pharmacistRecommendation: input.pharmacistRecommendation ?? null,
      reasonForChange: input.reasonForChange ?? null,
      note: input.note ?? null,
      triageOverride: (input.triageOverride ?? null) as never,
    },
  })

  // ── withdraw recommendations the pharmacist rejected ────────────────────
  if (input.action === 'REJECT') {
    await prisma.consultationRecommendation.updateMany({
      where: { consultationId: consultation.id, addedByPharmacist: false },
      data: {
        status: 'BLOCKED',
        blockedReason: input.reasonForChange ?? 'Withdrawn by pharmacist',
      },
    })
  } else if (input.removeRecommendationIds?.length) {
    await prisma.consultationRecommendation.updateMany({
      where: { id: { in: input.removeRecommendationIds }, consultationId: consultation.id },
      data: {
        status: 'BLOCKED',
        blockedReason: input.reasonForChange ?? 'Withdrawn by pharmacist',
      },
    })
  }

  // ── a product the pharmacist chose themselves ──────────────────────────
  if (input.action === 'RECOMMEND_PRODUCT' && input.productId) {
    await addPharmacistProduct({
      consultation,
      productId: input.productId,
      reason: input.pharmacistRecommendation ?? input.note ?? null,
    })
  }

  const status =
    input.action === 'REQUEST_INFO'
      ? 'PHARMACIST_REVIEW'
      : input.action === 'NOTE'
        ? consultation.status
        : 'REVIEWED'

  await prisma.consultation.update({
    where: { id: consultation.id },
    data: {
      status: status as never,
      reviewedAt: new Date(),
      ...(input.triageOverride
        ? {
            triageLevel: input.triageOverride as never,
            selfCareEligible: input.triageOverride === 'SELF_CARE',
          }
        : {}),
    },
  })

  if (consultation.userId) {
    const message = CUSTOMER_MESSAGES[input.action]
    await notifyCustomer({
      userId: consultation.userId,
      type: 'SYSTEM',
      title: `${consultation.code} — ${tr(message, consultation.locale)}`,
      body: input.pharmacistRecommendation ?? input.note ?? tr(message, consultation.locale),
      linkUrl: `/${consultation.locale}/account/consultations/${consultation.id}`,
      data: { consultationId: consultation.id, action: input.action },
    })
  }

  await logStage({
    consultationId: consultation.id,
    stage: 'pharmacist_review',
    summary: `${input.action} by ${input.pharmacist.fullName}`,
    payload: {
      action: input.action,
      triageOverride: input.triageOverride ?? null,
      reasonForChange: input.reasonForChange ?? null,
      withdrew: input.removeRecommendationIds ?? [],
    },
    actorId: input.pharmacist.id,
    actorLabel: `${input.pharmacist.fullName} (${input.pharmacist.roleName ?? 'pharmacist'})`,
  })

  await audit({
    actor: input.pharmacist,
    action: `consultation.review.${input.action.toLowerCase()}`,
    entity: 'Consultation',
    entityId: consultation.id,
    summary: `Pharmacist ${input.action} on consultation ${consultation.code}`,
    changes: {
      triageOverride: input.triageOverride ?? null,
      reasonForChange: input.reasonForChange ?? null,
    },
    request: input.request,
  })

  return reload(consultation.id)
}

/**
 * Adds a product a pharmacist chose. It is marked `addedByPharmacist` so the
 * engine never removes it, and `SAFE_TO_SHOW` because a licensed professional
 * has taken responsibility for it.
 */
async function addPharmacistProduct(input: {
  consultation: ConsultationRecord
  productId: string
  reason: string | null
}): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, deletedAt: null },
    select: {
      id: true,
      name: true,
      price: true,
      discountPrice: true,
      dosageForm: true,
      strength: true,
      packageSize: true,
      prescriptionRequired: true,
      activeIngredientsIndex: true,
      translations: true,
      category: { select: { name: true, translations: true } },
      images: { select: { fileKey: true, isPrimary: true }, orderBy: { sortOrder: 'asc' } },
      inventory: { select: { quantity: true, reserved: true } },
    },
  })
  if (!product) throw notFound('PRODUCT_NOT_FOUND')

  const locale = input.consultation.locale
  const ingredients = await productIngredientMap([product.id])
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0]

  await prisma.consultationRecommendation.create({
    data: {
      consultationId: input.consultation.id,
      productId: product.id,
      productName: pickTranslation(product.translations, locale)?.name?.trim() || product.name,
      categoryName:
        pickTranslation(product.category.translations, locale)?.name?.trim() || product.category.name,
      activeIngredients:
        ingredients.get(product.id)?.map((i) => i.name).join(', ') || product.activeIngredientsIndex,
      dosageForm: product.dosageForm,
      strength: product.strength,
      packageSize: product.packageSize,
      price: product.discountPrice ?? product.price,
      // A pharmacist may legitimately advise a prescription item — the flag is
      // preserved so the storefront still refuses to dispense without a script.
      prescriptionRequired: product.prescriptionRequired,
      stockQuantity: Math.max(0, (product.inventory?.quantity ?? 0) - (product.inventory?.reserved ?? 0)),
      imageKey: primaryImage?.fileKey ?? null,
      status: 'SAFE_TO_SHOW',
      rank: 0,
      safetyScore: 100,
      relevanceScore: 100,
      reason: input.reason,
      interactionStatus: 'UNKNOWN',
      addedByPharmacist: true,
    },
  })
}

/**
 * True when the engine must not re-run. Once a pharmacist has acted, their
 * verdict stands until they change it themselves (§21).
 */
export function isLockedByPharmacist(consultation: ConsultationRecord): boolean {
  return consultation.status === 'REVIEWED' || consultation.reviews.length > 0
}
