/**
 * Triage engine (§10) and symptom-duration logic (§11).
 *
 * The engine is monotonic: every rule may only escalate the level, never relax
 * it. `mostUrgent` enforces that, so rule order does not affect the outcome and
 * adding a rule can never make an existing consultation less cautious.
 *
 * Level 4 (self-care) is therefore the *absence* of every escalation reason,
 * not something a rule grants.
 */

import {
  HIGH_RISK_CONDITIONS,
  TRIAGE_RANK,
  isVulnerableAge,
  mostUrgent,
  t,
  tr,
  type AgeBandKey,
  type CourseKey,
  type LocalizedText,
  type PregnancyKey,
  type RecommendationTypeKey,
  type TriageLevelKey,
} from './types'
import type { DetectedRedFlag } from './red-flags'

export const TRIAGE_RULES_VERSION = 'tri-2026.08.1'

export interface TriageReason {
  code: string
  level: TriageLevelKey
  text: LocalizedText
}

const REASONS: Record<string, LocalizedText> = {
  'red_flag.emergency': t(
    'Яаралтай эмнэлгийн үнэлгээ шаардаж болох шинж тэмдэг сонгогдсон.',
    'A symptom that may require emergency assessment was reported.',
    'Указан симптом, который может требовать экстренной оценки.',
  ),
  'red_flag.urgent': t(
    'Эмчийн хурдан үзлэг шаардаж болох шинж тэмдэг байна.',
    'A symptom that may need prompt medical review was reported.',
    'Указан симптом, требующий скорого осмотра врача.',
  ),
  'severity.high': t(
    'Зовиурын хүндрэлийг өндөр (8-аас дээш) гэж үнэлсэн.',
    'The severity was rated 8 or higher.',
    'Тяжесть оценена в 8 баллов или выше.',
  ),
  'duration.exceeds_self_care': t(
    'Зовиур өөрөө эмчлэх хугацаанаас хэтэрсэн байна.',
    'The complaint has lasted longer than the self-care window.',
    'Жалоба длится дольше срока самопомощи.',
  ),
  'duration.worsening': t(
    'Байдал сайжрахын оронд дордож байна.',
    'The condition is worsening rather than improving.',
    'Состояние ухудшается, а не улучшается.',
  ),
  'course.chronic': t(
    'Архаг, урт хугацааны зовиурыг эмийн сангийн бүтээгдэхүүнээр давтан эмчлэх нь тохиромжгүй.',
    'A long-standing complaint should not be repeatedly self-treated.',
    'Длительную жалобу не следует лечить самостоятельно повторно.',
  ),
  'course.recurrent': t(
    'Зовиур дахин дахин давтагдаж байгаа тул мэргэжлийн үнэлгээ шаардлагатай.',
    'The complaint keeps recurring, so a professional assessment is needed.',
    'Жалоба повторяется, требуется профессиональная оценка.',
  ),
  'age.child': t(
    'Хүүхдийн нас — эмийн тун, сонголтыг эм зүйч тодорхойлох шаардлагатай.',
    'Paediatric age — a pharmacist must confirm the choice and the dose.',
    'Детский возраст — выбор и дозу должен подтвердить фармацевт.',
  ),
  'age.infant': t(
    'Хоёр нас хүрээгүй хүүхдэд эмийн сангийн бүтээгдэхүүнийг эм зүйч, эмчийн зөвлөгөөгүйгээр хэрэглэж болохгүй.',
    'Under the age of two, nothing should be given without a pharmacist or doctor.',
    'Детям до двух лет ничего не давать без фармацевта или врача.',
  ),
  'age.elderly': t(
    '65-аас дээш нас — эмийн харилцан үйлчлэл, бөөрний ажиллагааг эм зүйч шалгах шаардлагатай.',
    'Age 65+ — a pharmacist should check interactions and kidney function.',
    'Возраст 65+ — фармацевт должен проверить взаимодействия и функцию почек.',
  ),
  'pregnancy.present': t(
    'Жирэмсэн, жирэмсэн байж магадгүй эсвэл хөхүүл байдал — эм зүйчийн үнэлгээ шаардлагатай.',
    'Pregnancy, possible pregnancy or breastfeeding requires a pharmacist assessment.',
    'Беременность, возможная беременность или кормление требуют оценки фармацевта.',
  ),
  'pregnancy.unknown': t(
    'Жирэмсэн эсэх тодорхойгүй тул аюулгүй байдлыг эм зүйч хянана.',
    'Pregnancy status is unknown, so a pharmacist will confirm safety.',
    'Статус беременности неизвестен, безопасность подтвердит фармацевт.',
  ),
  'condition.high_risk': t(
    'Архаг өвчний улмаас эмийн сонголтыг эм зүйч хянах шаардлагатай.',
    'A chronic condition means a pharmacist must review the choice.',
    'Из-за хронического заболевания выбор должен проверить фармацевт.',
  ),
  'medications.polypharmacy': t(
    'Хэрэглэж байгаа эмийн тоо олон тул харилцан үйлчлэлийг эм зүйч шалгана.',
    'Several concurrent medicines — a pharmacist will check interactions.',
    'Несколько одновременных лекарств — фармацевт проверит взаимодействия.',
  ),
  'allergy.declared': t(
    'Эмийн харшил бүртгэгдсэн тул сонголтыг эм зүйч баталгаажуулна.',
    'A medicine allergy was reported, so a pharmacist confirms the choice.',
    'Заявлена аллергия на лекарство, выбор подтверждает фармацевт.',
  ),
  'allergy.unknown': t(
    'Эмийн харшлын талаар тодорхойгүй байгаа тул эм зүйчтэй зөвлөх шаардлагатай.',
    'Allergy status is unclear, so a pharmacist should be consulted.',
    'Статус аллергии неясен, нужна консультация фармацевта.',
  ),
  'symptom.unclear': t(
    'Зовиур тодорхойгүй байгаа тул мэргэжилтэн тодруулах шаардлагатай.',
    'The complaint is not clear enough, so a professional should clarify it.',
    'Жалоба недостаточно ясна, требуется уточнение специалистом.',
  ),
  'symptom.no_guideline': t(
    'Энэ зовиурт эмийн сангийн батлагдсан өөрөө эмчлэх заавар байхгүй.',
    'There is no approved self-care guideline for this complaint.',
    'Для этой жалобы нет утверждённого руководства по самопомощи.',
  ),
  'interaction.uncertain': t(
    'Эмийн хослолын аюулгүй байдлыг баталгаажуулах шаардлагатай.',
    'The safety of the medicine combination needs to be confirmed.',
    'Необходимо подтвердить безопасность комбинации лекарств.',
  ),
  'contraindication.present': t(
    'Аюулгүй байдлын хязгаарлалт тогтоогдсон тул эм зүйч хянана.',
    'A safety restriction applies, so a pharmacist reviews it.',
    'Действует ограничение по безопасности, проверяет фармацевт.',
  ),
}

function reason(code: string, level: TriageLevelKey): TriageReason {
  return { code, level, text: REASONS[code] ?? t(code, code, code) }
}

// ─────────────────────────── duration handling ─────────────────────────────

export interface DurationAssessment {
  hours: number | null
  days: number | null
  course: CourseKey | null
  /** True when the complaint has outlasted the guideline's self-care window. */
  exceedsSelfCare: boolean
}

/**
 * Duration and course together decide whether self-care is still reasonable.
 * `maxSelfCareDays` comes from the pharmacist-approved guideline for the
 * symptom, so "how long is too long" is a clinical setting, not a constant.
 */
export function assessDuration(input: {
  onsetHours: number | null
  course: CourseKey | null
  maxSelfCareDays: number
}): DurationAssessment {
  const hours = input.onsetHours
  const days = hours === null ? null : Math.round((hours / 24) * 10) / 10
  const exceedsByClock = days !== null && days > input.maxSelfCareDays
  const exceedsByCourse = input.course === 'CHRONIC' || input.course === 'PERSISTENT'

  return {
    hours,
    days,
    course: input.course,
    // A "persistent" answer only counts as over the line once the complaint has
    // actually run past a couple of days — otherwise every day-two cold would
    // be pushed to a doctor.
    exceedsSelfCare: exceedsByClock || (exceedsByCourse && (days ?? 0) >= 3),
  }
}

// ──────────────────────────── triage decision ──────────────────────────────

export interface TriageInput {
  redFlags: DetectedRedFlag[]
  ageBand: AgeBandKey | null
  exactAgeYears: number | null
  pregnancy: PregnancyKey | null
  conditions: string[]
  medicationCount: number
  unresolvedMedication: boolean
  allergyDeclared: 'yes' | 'no' | 'unknown' | null
  severity: number | null
  worsening: boolean | null
  duration: DurationAssessment
  primarySymptom: string | null
  hasGuideline: boolean
  /** Free text only, with no symptom category picked. */
  symptomUnclear: boolean
}

export interface TriageOutcome {
  level: TriageLevelKey
  recommendationType: RecommendationTypeKey
  reasons: TriageReason[]
  selfCareEligible: boolean
  pharmacistReviewRequired: boolean
}

const TYPE_FOR_LEVEL: Record<TriageLevelKey, RecommendationTypeKey> = {
  EMERGENCY: 'EMERGENCY_CARE',
  URGENT_MEDICAL_REVIEW: 'DOCTOR_REVIEW',
  PHARMACIST_CONSULTATION: 'PHARMACIST_CONSULT',
  SELF_CARE: 'OTC_GUIDANCE',
}

export function assessTriage(input: TriageInput): TriageOutcome {
  let level: TriageLevelKey = 'SELF_CARE'
  const reasons: TriageReason[] = []

  const escalate = (code: string, to: TriageLevelKey) => {
    reasons.push(reason(code, to))
    level = mostUrgent(level, to)
  }

  // ── level 1 ────────────────────────────────────────────────────────────
  if (input.redFlags.some((f) => f.severity === 'EMERGENCY')) {
    escalate('red_flag.emergency', 'EMERGENCY')
    // Nothing below can lower this, and no other reason is worth showing.
    return {
      level: 'EMERGENCY',
      recommendationType: 'EMERGENCY_CARE',
      reasons,
      selfCareEligible: false,
      pharmacistReviewRequired: false,
    }
  }

  // ── level 2 ────────────────────────────────────────────────────────────
  if (input.redFlags.some((f) => f.severity === 'URGENT')) {
    escalate('red_flag.urgent', 'URGENT_MEDICAL_REVIEW')
  }
  if ((input.severity ?? 0) >= 8) {
    escalate('severity.high', 'URGENT_MEDICAL_REVIEW')
  }
  if (input.duration.exceedsSelfCare) {
    escalate('duration.exceeds_self_care', 'URGENT_MEDICAL_REVIEW')
  }
  if (input.worsening === true && (input.duration.days ?? 0) >= 3) {
    escalate('duration.worsening', 'URGENT_MEDICAL_REVIEW')
  }
  if (input.duration.course === 'CHRONIC') {
    escalate('course.chronic', 'URGENT_MEDICAL_REVIEW')
  }

  // ── level 3 ────────────────────────────────────────────────────────────
  if (input.ageBand === 'UNDER_2') {
    escalate('age.infant', 'PHARMACIST_CONSULTATION')
  } else if (input.ageBand === 'AGE_2_5' || input.ageBand === 'AGE_6_12') {
    escalate('age.child', 'PHARMACIST_CONSULTATION')
  } else if (input.ageBand === 'AGE_65_PLUS') {
    escalate('age.elderly', 'PHARMACIST_CONSULTATION')
  }

  if (
    input.pregnancy === 'PREGNANT' ||
    input.pregnancy === 'POSSIBLY_PREGNANT' ||
    input.pregnancy === 'BREASTFEEDING'
  ) {
    escalate('pregnancy.present', 'PHARMACIST_CONSULTATION')
  }

  if (input.conditions.some((code) => HIGH_RISK_CONDITIONS.has(code))) {
    escalate('condition.high_risk', 'PHARMACIST_CONSULTATION')
  }
  if (input.medicationCount >= 2) {
    escalate('medications.polypharmacy', 'PHARMACIST_CONSULTATION')
  }
  if (input.unresolvedMedication) {
    escalate('interaction.uncertain', 'PHARMACIST_CONSULTATION')
  }
  if (input.allergyDeclared === 'yes') {
    escalate('allergy.declared', 'PHARMACIST_CONSULTATION')
  } else if (input.allergyDeclared === 'unknown') {
    escalate('allergy.unknown', 'PHARMACIST_CONSULTATION')
  }
  if (input.duration.course === 'RECURRENT') {
    escalate('course.recurrent', 'PHARMACIST_CONSULTATION')
  }
  if (input.symptomUnclear || input.primarySymptom === 'other') {
    escalate('symptom.unclear', 'PHARMACIST_CONSULTATION')
  }
  if (!input.hasGuideline) {
    escalate('symptom.no_guideline', 'PHARMACIST_CONSULTATION')
  }

  return {
    level,
    recommendationType: TYPE_FOR_LEVEL[level],
    reasons,
    selfCareEligible: level === 'SELF_CARE',
    // Anything short of clean self-care means a human should look at it before
    // the customer acts on a product suggestion.
    pharmacistReviewRequired: TRIAGE_RANK[level] <= TRIAGE_RANK.PHARMACIST_CONSULTATION,
  }
}

/**
 * Escalates an existing outcome after later pipeline stages learn something
 * triage could not know up front.
 *
 * The contraindication and interaction engines only run once candidate products
 * exist, which is after triage. When they find that the customer's own
 * medicines make a product uncertain, that is a level-3 reason under §10
 * ("Medication interactions", "Allergy") and has to feed back into the level —
 * otherwise a customer on warfarin gets a clean self-care verdict simply
 * because the risky product was quietly filtered out.
 *
 * Only escalation is possible; the level can never be relaxed here either.
 */
export function escalateOutcome(
  outcome: TriageOutcome,
  code: string,
  to: TriageLevelKey,
): TriageOutcome {
  const level = mostUrgent(outcome.level, to)
  if (level === outcome.level && outcome.reasons.some((r) => r.code === code)) return outcome

  const reasons = outcome.reasons.some((r) => r.code === code)
    ? outcome.reasons
    : [...outcome.reasons, reason(code, to)]

  return {
    level,
    recommendationType: TYPE_FOR_LEVEL[level],
    reasons,
    selfCareEligible: level === 'SELF_CARE',
    pharmacistReviewRequired: TRIAGE_RANK[level] <= TRIAGE_RANK.PHARMACIST_CONSULTATION,
  }
}

/** Joins the reason list into one sentence for storage and display. */
export function reasonsToText(reasons: TriageReason[], locale: string): string {
  return reasons.map((r) => tr(r.text, locale)).join(' ')
}
