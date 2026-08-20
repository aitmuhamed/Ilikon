import 'server-only'

import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'

import { prisma } from '../prisma'
import { getSettings, localizedDisclaimer, type PharmacySettings } from '../settings'
import type { Locale } from '../locale-types'
import { logStage, RULES_VERSION } from './audit'
import { resolveIngredient } from './ingredients'
import {
  AnswerError,
  emptyState,
  nextQuestion,
  parseAnswer,
  questionByKey,
  toWireQuestion,
  type AnswerState,
  type QuestionDef,
  type RawAllergy,
  type RawMedication,
} from './questionnaire'
import { fromRuleCodes, mergeRedFlags, screenFreeText, type DetectedRedFlag } from './red-flags'
import { redFlagLabel, type AgeBandKey, type PregnancyKey, type SexKey, type WireState } from './types'

/**
 * Consultation session lifecycle (§2).
 *
 * The database row is the single source of truth for the questionnaire's state.
 * The browser holds nothing but a continuation key, so a customer cannot skip a
 * step, unset a red flag, or resume someone else's consultation by editing
 * client state.
 */

export const DISCLAIMER_VERSION = 'disc-2026.08.1'

const CONSULTATION_INCLUDE = {
  answers: { orderBy: { sortOrder: 'asc' as const } },
  conditions: true,
  allergies: true,
  medications: true,
  redFlags: true,
  recommendations: { orderBy: { rank: 'asc' as const } },
  safetyChecks: true,
  reviews: {
    orderBy: { createdAt: 'desc' as const },
    include: { pharmacist: { select: { id: true, fullName: true, jobTitle: true } } },
  },
} satisfies Prisma.ConsultationInclude

export type ConsultationRecord = Prisma.ConsultationGetPayload<{
  include: typeof CONSULTATION_INCLUDE
}>

// ─────────────────────────────── numbering ─────────────────────────────────

/** `AIC-YYYYMMDD-NNNN`, sequential per calendar day. */
async function nextConsultationCode(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const prefix = `AIC-${datePart}-`

  const last = await tx.consultation.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  const lastSeq = last ? Number.parseInt(last.code.slice(prefix.length), 10) : 0
  return `${prefix}${String((Number.isNaN(lastSeq) ? 0 : lastSeq) + 1).padStart(4, '0')}`
}

// ──────────────────────────────── creation ─────────────────────────────────

export async function createConsultation(input: {
  userId: string | null
  locale: Locale
  settings?: PharmacySettings
}): Promise<ConsultationRecord> {
  const settings = input.settings ?? (await getSettings())
  const sessionKey = `ac_${randomBytes(18).toString('base64url')}`
  const retentionDays = Math.max(1, settings.consultationRetentionDays)

  const consultation = await prisma.$transaction(async (tx) => {
    const code = await nextConsultationCode(tx)
    return tx.consultation.create({
      data: {
        code,
        sessionKey,
        userId: input.userId,
        locale: input.locale,
        status: 'DRAFT',
        currentStep: 'CONSENT',
        rulesVersion: RULES_VERSION,
        expiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
      },
      include: CONSULTATION_INCLUDE,
    })
  })

  await logStage({
    consultationId: consultation.id,
    stage: 'consultation_started',
    summary: `Consultation ${consultation.code} started in ${input.locale}`,
    payload: { locale: input.locale, authenticated: Boolean(input.userId) },
  })

  return consultation
}

export async function loadBySessionKey(sessionKey: string): Promise<ConsultationRecord | null> {
  return prisma.consultation.findUnique({
    where: { sessionKey },
    include: CONSULTATION_INCLUDE,
  })
}

export async function loadById(id: string): Promise<ConsultationRecord | null> {
  return prisma.consultation.findUnique({ where: { id }, include: CONSULTATION_INCLUDE })
}

export async function reload(id: string): Promise<ConsultationRecord> {
  const row = await loadById(id)
  if (!row) throw new Error(`Consultation ${id} disappeared`)
  return row
}

/**
 * Consent gate (§1). Nothing but the disclaimer can be shown until this is
 * recorded, and the version is stored so a later wording change is auditable.
 */
export async function acceptDisclaimer(consultation: ConsultationRecord): Promise<ConsultationRecord> {
  if (consultation.disclaimerAcceptedAt) return consultation

  const updated = await prisma.consultation.update({
    where: { id: consultation.id },
    data: {
      disclaimerAcceptedAt: new Date(),
      disclaimerVersion: DISCLAIMER_VERSION,
      status: 'IN_PROGRESS',
      currentStep: 'BASICS',
    },
    include: CONSULTATION_INCLUDE,
  })

  await logStage({
    consultationId: consultation.id,
    stage: 'consent_accepted',
    summary: `Disclaimer ${DISCLAIMER_VERSION} accepted`,
  })

  return updated
}

// ───────────────────────────── state projection ────────────────────────────

/** Projects the stored row back into the shape the questionnaire engine reads. */
export function toAnswerState(row: ConsultationRecord): AnswerState {
  const state = emptyState()

  state.ageBand = (row.ageBand as AgeBandKey | null) ?? null
  state.exactAgeYears = row.exactAgeYears
  state.exactAgeMonths = row.exactAgeMonths
  state.sex = (row.sex as SexKey | null) ?? null
  state.pregnancy = (row.pregnancy as PregnancyKey | null) ?? null
  state.primarySymptom = row.primarySymptom
  state.symptomFreeText = row.symptomFreeText
  state.secondarySymptoms = row.secondarySymptoms
  state.onsetCode = row.onsetCode
  state.severity = row.severity
  state.course = row.course
  state.worsening = row.worsening
  state.conditions = row.conditions.map((c) => c.conditionCode)
  state.allergies = row.allergies.map((a) => ({ medication: a.medication, reaction: a.reaction }))
  state.medications = row.medications.map((m) => ({
    name: m.name,
    dose: m.dose,
    frequency: m.frequency,
  }))
  state.redFlagCodes = row.redFlags.map((f) => f.code)

  for (const answer of row.answers) {
    state.answers[answer.questionKey] = answer.answerValue
  }

  const declared = state.answers.allergy_declared
  if (declared === 'yes' || declared === 'no' || declared === 'unknown') {
    state.allergyDeclared = declared
  }

  return state
}

// ─────────────────────────── recording an answer ───────────────────────────

/**
 * Maps an answer onto the denormalised columns the engines read. Keeping this
 * in one place means the assessment never has to interpret a raw answer blob.
 */
function derivedUpdate(question: QuestionDef, value: unknown): Prisma.ConsultationUpdateInput {
  switch (question.key) {
    case 'age_band':
      return { ageBand: value as never }
    case 'exact_age':
      return typeof value === 'number' ? { exactAgeYears: Math.floor(value) } : {}
    case 'sex':
      return { sex: value as never }
    case 'pregnancy':
      return { pregnancy: value as never }
    case 'primary_symptom':
      return { primarySymptom: String(value) }
    case 'symptom_free_text':
      return typeof value === 'string' ? { symptomFreeText: value } : {}
    case 'secondary_symptoms':
      return Array.isArray(value) ? { secondarySymptoms: value as string[] } : {}
    case 'onset':
      return { onsetCode: String(value) }
    case 'severity':
      return typeof value === 'number' ? { severity: Math.round(value) } : {}
    case 'course':
      return { course: value as never }
    case 'worsening':
      return { worsening: value === 'yes' }
    default:
      return {}
  }
}

export interface RecordAnswerResult {
  consultation: ConsultationRecord
  /** True when the questionnaire is finished and the assessment can run. */
  complete: boolean
  emergencyDetected: boolean
}

/**
 * Validates and stores one answer, then applies its side effects: derived
 * columns, child rows (conditions, allergies, medications) and any red flags
 * the answer raised, including a free-text screen of anything the customer
 * typed.
 */
export async function recordAnswer(input: {
  consultation: ConsultationRecord
  questionKey: string
  value: unknown
}): Promise<RecordAnswerResult> {
  const question = questionByKey(input.questionKey)
  if (!question) throw new AnswerError('UNKNOWN_QUESTION')

  const state = toAnswerState(input.consultation)
  const expected = nextQuestion(state)

  // Out-of-order answers are accepted only for questions that are currently
  // applicable — never for one the flow has not reached or has skipped.
  if (!expected) throw new AnswerError('QUESTIONNAIRE_COMPLETE')
  if (expected.key !== question.key) {
    const applicableNow = question.when ? question.when(state) : true
    if (!applicableNow || question.key in state.answers) {
      throw new AnswerError('QUESTION_NOT_ACTIVE')
    }
  }

  const locale = input.consultation.locale
  const parsed = parseAnswer(question, input.value, locale)

  const sortOrder = input.consultation.answers.length + 1
  const updates: Prisma.ConsultationUpdateInput = {
    ...derivedUpdate(question, parsed.value),
    currentStep: question.step as never,
    status: 'IN_PROGRESS',
  }

  await prisma.$transaction(async (tx) => {
    await tx.consultationAnswer.upsert({
      where: {
        consultationId_questionKey: {
          consultationId: input.consultation.id,
          questionKey: question.key,
        },
      },
      create: {
        consultationId: input.consultation.id,
        step: question.step as never,
        questionKey: question.key,
        questionText: toWireQuestion(question, state, locale).prompt,
        answerValue: (parsed.value ?? null) as never,
        answerLabel: parsed.label,
        isRedFlagProbe: Boolean(question.isRedFlagProbe),
        sortOrder,
      },
      update: {
        answerValue: (parsed.value ?? null) as never,
        answerLabel: parsed.label,
        answeredAt: new Date(),
      },
    })

    await tx.consultation.update({ where: { id: input.consultation.id }, data: updates })

    // ── child rows ────────────────────────────────────────────────────────
    if (question.key === 'conditions' && Array.isArray(parsed.value)) {
      await tx.consultationCondition.deleteMany({ where: { consultationId: input.consultation.id } })
      const codes = parsed.value as string[]
      if (codes.length > 0) {
        await tx.consultationCondition.createMany({
          data: codes.map((code) => ({ consultationId: input.consultation.id, conditionCode: code })),
          skipDuplicates: true,
        })
      }
    }

    if (question.key === 'condition_detail' && typeof parsed.value === 'string') {
      await tx.consultationCondition.updateMany({
        where: { consultationId: input.consultation.id, conditionCode: 'other_chronic' },
        data: { detail: parsed.value },
      })
    }
  })

  // Allergies and medications need ingredient resolution, which queries outside
  // the transaction; they are replaced wholesale so a re-answer is idempotent.
  if (question.key === 'allergy_list' && Array.isArray(parsed.value)) {
    await replaceAllergies(input.consultation.id, parsed.value as RawAllergy[])
  }
  if (question.key === 'current_medications' && Array.isArray(parsed.value)) {
    await replaceMedications(input.consultation.id, parsed.value as RawMedication[])
  }

  // ── red flags raised by this answer ───────────────────────────────────
  const detected: DetectedRedFlag[][] = [fromRuleCodes(parsed.redFlags, parsed.label)]
  if (typeof parsed.value === 'string' && parsed.value.length > 3) {
    detected.push(screenFreeText(parsed.value))
  }
  const flags = mergeRedFlags(...detected)
  if (flags.length > 0) {
    await persistRedFlags(input.consultation.id, flags, locale)
  }

  await logStage({
    consultationId: input.consultation.id,
    stage: 'answer_recorded',
    summary: `${question.key} = ${parsed.label}`.slice(0, 200),
    payload: {
      questionKey: question.key,
      step: question.step,
      redFlags: flags.map((f) => f.code),
    },
  })

  const consultation = await reload(input.consultation.id)
  const nextState = toAnswerState(consultation)
  const upcoming = nextQuestion(nextState)

  return {
    consultation,
    complete: upcoming === null,
    emergencyDetected: flags.some((f) => f.severity === 'EMERGENCY'),
  }
}

async function replaceAllergies(consultationId: string, entries: RawAllergy[]): Promise<void> {
  const resolved = await Promise.all(
    entries.map(async (entry) => ({
      entry,
      ingredient: await resolveIngredient(entry.medication),
    })),
  )

  await prisma.$transaction([
    prisma.consultationAllergy.deleteMany({ where: { consultationId } }),
    ...(resolved.length > 0
      ? [
          prisma.consultationAllergy.createMany({
            data: resolved.map(({ entry, ingredient }) => ({
              consultationId,
              medication: entry.medication,
              reaction: entry.reaction ?? null,
              ingredientKey: ingredient?.key ?? null,
            })),
          }),
        ]
      : []),
  ])
}

async function replaceMedications(consultationId: string, entries: RawMedication[]): Promise<void> {
  const resolved = await Promise.all(
    entries.map(async (entry) => ({
      entry,
      ingredient: await resolveIngredient(entry.name),
    })),
  )

  await prisma.$transaction([
    prisma.consultationMedication.deleteMany({ where: { consultationId } }),
    ...(resolved.length > 0
      ? [
          prisma.consultationMedication.createMany({
            data: resolved.map(({ entry, ingredient }) => ({
              consultationId,
              name: entry.name,
              dose: entry.dose ?? null,
              frequency: entry.frequency ?? null,
              source: (entry.source ?? 'MANUAL') as never,
              productId: entry.productId ?? null,
              barcode: entry.barcode ?? null,
              photoKey: entry.photoKey ?? null,
              ingredientKey: ingredient?.key ?? null,
              unresolved: !ingredient,
            })),
          }),
        ]
      : []),
  ])
}

/** Red flags are additive: an existing row is never downgraded or removed. */
export async function persistRedFlags(
  consultationId: string,
  flags: DetectedRedFlag[],
  locale: string,
): Promise<void> {
  for (const flag of flags) {
    await prisma.consultationRedFlag
      .upsert({
        where: { consultationId_code: { consultationId, code: flag.code } },
        create: {
          consultationId,
          code: flag.code,
          label: redFlagLabel(flag.code, locale),
          severity: flag.severity as never,
          source: flag.source as never,
          evidence: flag.evidence,
        },
        update: {
          // Only ever escalate.
          ...(flag.severity === 'EMERGENCY' ? { severity: 'EMERGENCY' as never } : {}),
        },
      })
      .catch((error) => console.error('[consultation] red flag upsert failed', flag.code, error))
  }
}

// ──────────────────────────── wire projection ──────────────────────────────

export function buildWireState(input: {
  consultation: ConsultationRecord
  settings: PharmacySettings
  result?: WireState['result']
}): WireState {
  const { consultation } = input
  const state = toAnswerState(consultation)
  const question = consultation.disclaimerAcceptedAt ? nextQuestion(state) : null
  const locale = consultation.locale

  return {
    consultationId: consultation.id,
    code: consultation.code,
    status: consultation.status,
    step: consultation.currentStep as WireState['step'],
    locale,
    consentAccepted: Boolean(consultation.disclaimerAcceptedAt),
    question: question ? toWireQuestion(question, state, locale) : null,
    answered: consultation.answers.map((answer) => ({
      key: answer.questionKey,
      label: answer.answerLabel,
      questionText: answer.questionText,
    })),
    result: input.result ?? null,
  }
}

export function disclaimerText(settings: PharmacySettings, locale: string): string {
  return localizedDisclaimer(settings, locale)
}

/** Marks a consultation abandoned so the dashboard's funnel stays honest. */
export async function markAbandoned(consultationId: string): Promise<void> {
  await prisma.consultation.updateMany({
    where: { id: consultationId, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
    data: { status: 'ABANDONED' },
  })
}

