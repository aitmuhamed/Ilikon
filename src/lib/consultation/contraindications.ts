import 'server-only'

import { prisma } from '../prisma'
import {
  ageBandMinYears,
  t,
  tr,
  type AgeBandKey,
  type PregnancyKey,
  type SafetyOutcomeKey,
  type SexKey,
} from './types'
import { type ExposureProfile } from './ingredients'

/**
 * `ContraindicationAgent` (§16) and the duplicate-active-ingredient check (§18).
 *
 * The contract is "no guess ever wins":
 *
 *  • A rule that matches produces BLOCK, WARN, or WARN + pharmacist review,
 *    according to the severity a pharmacist assigned to that rule.
 *  • Missing information produces UNKNOWN, which routes to a pharmacist. It
 *    never produces a PASS. Unknown pregnancy status, an allergy the system
 *    could not resolve to an ingredient, or an age we were not told are all
 *    treated as unresolved risk rather than absence of risk.
 */

export const CONTRAINDICATION_RULES_VERSION = 'ci-2026.08.1'

export type SafetyCheckKind =
  | 'AGE'
  | 'ALLERGY'
  | 'PREGNANCY'
  | 'BREASTFEEDING'
  | 'CONDITION'
  | 'INTERACTION'
  | 'DUPLICATE_INGREDIENT'
  | 'PRESCRIPTION_ONLY'
  | 'AVAILABILITY'
  | 'EXPIRY'
  | 'DOSAGE'
  | 'GUIDELINE_SCOPE'

export interface SafetyFinding {
  type: SafetyCheckKind
  outcome: SafetyOutcomeKey
  /** Machine-readable reason, e.g. `age.below_min`. */
  code: string
  /** Already localised — this is what the customer or pharmacist reads. */
  message: string
  ingredientKey: string | null
  ruleId: string | null
  sourceId: string | null
  /** True when only a pharmacist may clear this before the product is shown. */
  requiresPharmacist: boolean
}

export interface CustomerSafetyProfile {
  ageBand: AgeBandKey | null
  exactAgeYears: number | null
  sex: SexKey | null
  pregnancy: PregnancyKey | null
  conditions: string[]
  /** Ingredient keys the customer reported being allergic to. */
  allergyIngredientKeys: Set<string>
  /** Therapeutic classes of those allergies, for cross-reactivity. */
  allergyClassKeys: Set<string>
  /** Allergy entries whose medicine name could not be resolved. */
  unresolvedAllergies: string[]
  allergyDeclared: 'yes' | 'no' | 'unknown' | null
  exposure: ExposureProfile
}

type RuleRow = Awaited<ReturnType<typeof loadRules>>[number]

async function loadRules(ingredientKeys: string[]) {
  return prisma.contraindicationRule.findMany({
    where: { isActive: true, ingredientKey: { in: ingredientKeys } },
    select: {
      id: true,
      ingredientKey: true,
      scope: true,
      severity: true,
      conditionCode: true,
      minAgeYears: true,
      minAgeMonths: true,
      maxAgeYears: true,
      messageMn: true,
      messageEn: true,
      messageRu: true,
      sourceId: true,
    },
  })
}

function ruleMessage(rule: RuleRow, locale: string): string {
  if (locale === 'en') return rule.messageEn
  if (locale === 'ru') return rule.messageRu
  return rule.messageMn
}

function outcomeFor(severity: RuleRow['severity']): {
  outcome: SafetyOutcomeKey
  requiresPharmacist: boolean
} {
  switch (severity) {
    case 'BLOCK':
      return { outcome: 'BLOCK', requiresPharmacist: false }
    case 'PHARMACIST_REVIEW':
      return { outcome: 'WARN', requiresPharmacist: true }
    default:
      return { outcome: 'WARN', requiresPharmacist: false }
  }
}

/**
 * Whether pregnancy is a live question for this patient. Used to decide when a
 * missing pregnancy answer counts as unresolved risk rather than as a
 * non-question.
 */
export function pregnancyPossible(profile: CustomerSafetyProfile): boolean {
  if (profile.sex === 'MALE') return false
  const band = profile.ageBand
  if (band === 'UNDER_2' || band === 'AGE_2_5' || band === 'AGE_6_12') return false
  return true
}

/**
 * The lowest age the customer could be. An exact age wins; otherwise the floor
 * of the declared band, so "2–5 years" is checked as if the patient were 2.
 */
export function effectiveMinAge(profile: CustomerSafetyProfile): number | null {
  if (profile.exactAgeYears !== null && Number.isFinite(profile.exactAgeYears)) {
    return profile.exactAgeYears
  }
  return ageBandMinYears(profile.ageBand)
}

const MESSAGES = {
  ageUnknown: t(
    'Нас тодорхойгүй байгаа тул эмийн аюулгүй байдлыг эм зүйч хянах шаардлагатай.',
    'Age was not provided, so a pharmacist must confirm the choice is safe.',
    'Возраст не указан, безопасность должен подтвердить фармацевт.',
  ),
  allergyDirect: t(
    'Та харшилтай гэж бүртгүүлсэн үйлчлэгч бодис агуулагдаж байна. Энэ бүтээгдэхүүнийг санал болгохгүй.',
    'This contains an active ingredient you reported being allergic to, so it is not offered.',
    'Содержит действующее вещество, на которое вы заявили аллергию — не предлагается.',
  ),
  allergyClass: t(
    'Та харшилтай эмтэй ижил төрлийн бодис агуулагдаж байгаа тул эм зүйчийн хяналт шаардлагатай.',
    'This belongs to the same drug family as a medicine you are allergic to, so a pharmacist must review it.',
    'Относится к той же группе, что и лекарство с вашей аллергией — нужна проверка фармацевта.',
  ),
  allergyUnresolved: t(
    'Бүртгэсэн харшлын эмийг системд тодорхойлж чадсангүй. Аюулгүй байдлыг эм зүйч баталгаажуулах шаардлагатай.',
    'The medicine you are allergic to could not be identified, so a pharmacist must confirm safety.',
    'Лекарство с вашей аллергией не удалось определить — безопасность подтвердит фармацевт.',
  ),
  allergyUnknown: t(
    'Эмийн харшлын талаар тодорхойгүй байгаа тул эм зүйчээс тодруулна уу.',
    'Your allergy status is unclear, so please confirm with a pharmacist.',
    'Статус аллергии неясен — уточните у фармацевта.',
  ),
  pregnancyUnknown: t(
    'Жирэмсэн эсэх нь тодорхойгүй байгаа тул эмийн сонголтыг эм зүйч баталгаажуулна.',
    'Pregnancy status is unknown, so a pharmacist confirms the choice.',
    'Статус беременности неизвестен — выбор подтверждает фармацевт.',
  ),
  duplicateIngredient: t(
    'Эдгээр бүтээгдэхүүнд ижил идэвхтэй найрлага агуулагдаж болзошгүй тул давхар хэрэглэхээс өмнө эм зүйчтэй зөвлөнө үү.',
    'These products may contain the same active ingredient — please consult a pharmacist before using them together.',
    'Эти продукты могут содержать одно и то же действующее вещество — проконсультируйтесь с фармацевтом перед совместным применением.',
  ),
  prescriptionOnly: t(
    'Жороор олгох эм тул энэ зөвлөгөөнд оруулаагүй.',
    'This is a prescription-only medicine and is therefore not included here.',
    'Это рецептурное лекарство, поэтому здесь не предлагается.',
  ),
  outOfStock: t(
    'Нөөцөд байхгүй тул санал болгоогүй.',
    'Not currently in stock, so it is not offered.',
    'Нет в наличии, поэтому не предлагается.',
  ),
  expired: t(
    'Хүчинтэй хугацаа хангалтгүй тул санал болгоогүй.',
    'Shelf life is not adequate, so it is not offered.',
    'Срок годности недостаточен, поэтому не предлагается.',
  ),
} as const

/**
 * Runs every contraindication rule for one candidate product's ingredients.
 * Returns the findings; an empty list means nothing matched and nothing was
 * missing.
 */
export async function checkContraindications(input: {
  ingredientKeys: string[]
  profile: CustomerSafetyProfile
  locale: string
  /** From the symptom guideline — pregnancy always needs a pharmacist here. */
  pregnancyNeedsPharmacist: boolean
}): Promise<SafetyFinding[]> {
  const { profile, locale } = input
  const findings: SafetyFinding[] = []

  if (input.ingredientKeys.length === 0) {
    // A product with no recorded ingredients cannot be safety-checked, so it is
    // never presented as verified.
    return [
      {
        type: 'GUIDELINE_SCOPE',
        outcome: 'UNKNOWN',
        code: 'ingredients.unknown',
        message: tr(MESSAGES.ageUnknown, locale),
        ingredientKey: null,
        ruleId: null,
        sourceId: null,
        requiresPharmacist: true,
      },
    ]
  }

  // ── direct and cross-reactive allergy (never rule-dependent) ───────────
  for (const key of input.ingredientKeys) {
    if (profile.allergyIngredientKeys.has(key)) {
      findings.push({
        type: 'ALLERGY',
        outcome: 'BLOCK',
        code: 'allergy.direct_match',
        message: tr(MESSAGES.allergyDirect, locale),
        ingredientKey: key,
        ruleId: null,
        sourceId: null,
        requiresPharmacist: false,
      })
    }
  }

  if (profile.unresolvedAllergies.length > 0) {
    findings.push({
      type: 'ALLERGY',
      outcome: 'UNKNOWN',
      code: 'allergy.unresolved_name',
      message: `${tr(MESSAGES.allergyUnresolved, locale)} (${profile.unresolvedAllergies.join(', ')})`,
      ingredientKey: null,
      ruleId: null,
      sourceId: null,
      requiresPharmacist: true,
    })
  }

  if (profile.allergyDeclared === 'unknown') {
    findings.push({
      type: 'ALLERGY',
      outcome: 'UNKNOWN',
      code: 'allergy.status_unknown',
      message: tr(MESSAGES.allergyUnknown, locale),
      ingredientKey: null,
      ruleId: null,
      sourceId: null,
      requiresPharmacist: true,
    })
  }

  // ── unknown pregnancy status where the guideline demands certainty ──────
  // Only asked where pregnancy is actually possible. A male patient's null
  // status is *known* to be irrelevant, not unknown — treating it as unknown
  // would push every such consultation to a pharmacist for no clinical reason.
  // An undisclosed sex within childbearing age stays unknown, deliberately.
  if (
    input.pregnancyNeedsPharmacist &&
    pregnancyPossible(profile) &&
    (profile.pregnancy === 'UNDISCLOSED' || profile.pregnancy === null)
  ) {
    findings.push({
      type: 'PREGNANCY',
      outcome: 'UNKNOWN',
      code: 'pregnancy.status_unknown',
      message: tr(MESSAGES.pregnancyUnknown, locale),
      ingredientKey: null,
      ruleId: null,
      sourceId: null,
      requiresPharmacist: true,
    })
  }

  // ── unknown age ────────────────────────────────────────────────────────
  const minAge = effectiveMinAge(profile)
  if (minAge === null) {
    findings.push({
      type: 'AGE',
      outcome: 'UNKNOWN',
      code: 'age.unknown',
      message: tr(MESSAGES.ageUnknown, locale),
      ingredientKey: null,
      ruleId: null,
      sourceId: null,
      requiresPharmacist: true,
    })
  }

  // ── the pharmacist-authored rule table ─────────────────────────────────
  const rules = await loadRules(input.ingredientKeys)

  for (const rule of rules) {
    const { outcome, requiresPharmacist } = outcomeFor(rule.severity)
    const push = (code: string) =>
      findings.push({
        type:
          rule.scope === 'AGE'
            ? 'AGE'
            : rule.scope === 'PREGNANCY'
              ? 'PREGNANCY'
              : rule.scope === 'BREASTFEEDING'
                ? 'BREASTFEEDING'
                : rule.scope === 'CONDITION'
                  ? 'CONDITION'
                  : 'ALLERGY',
        outcome,
        code,
        message: ruleMessage(rule, locale),
        ingredientKey: rule.ingredientKey,
        ruleId: rule.id,
        sourceId: rule.sourceId,
        requiresPharmacist,
      })

    switch (rule.scope) {
      case 'AGE': {
        if (minAge === null) break
        if (rule.minAgeYears !== null && minAge < rule.minAgeYears) push('age.below_min')
        else if (rule.maxAgeYears !== null && minAge > rule.maxAgeYears) push('age.above_max')
        break
      }
      case 'PREGNANCY': {
        if (profile.pregnancy === 'PREGNANT' || profile.pregnancy === 'POSSIBLY_PREGNANT') {
          push('pregnancy.contraindicated')
        }
        break
      }
      case 'BREASTFEEDING': {
        if (profile.pregnancy === 'BREASTFEEDING') push('breastfeeding.contraindicated')
        break
      }
      case 'CONDITION': {
        if (rule.conditionCode && profile.conditions.includes(rule.conditionCode)) {
          push('condition.contraindicated')
        }
        break
      }
      case 'ALLERGY': {
        if (rule.conditionCode && profile.allergyClassKeys.has(rule.conditionCode)) {
          findings.push({
            type: 'ALLERGY',
            outcome,
            code: 'allergy.cross_reactive',
            message: ruleMessage(rule, locale) || tr(MESSAGES.allergyClass, locale),
            ingredientKey: rule.ingredientKey,
            ruleId: rule.id,
            sourceId: rule.sourceId,
            requiresPharmacist: true,
          })
        }
        break
      }
    }
  }

  return findings
}

/**
 * Duplicate active ingredient against what the customer already takes (§18).
 * Taking two products that both contain the same ingredient is the classic
 * accidental overdose, so this is always at least a pharmacist warning.
 */
export function checkDuplicateWithCurrentMedication(input: {
  ingredientKeys: string[]
  exposure: ExposureProfile
  locale: string
}): SafetyFinding[] {
  const overlap = input.ingredientKeys.filter((key) => input.exposure.ingredientKeys.has(key))
  if (overlap.length === 0) return []

  return overlap.map((key) => ({
    type: 'DUPLICATE_INGREDIENT' as const,
    outcome: 'WARN' as const,
    code: 'duplicate.current_medication',
    message: tr(MESSAGES.duplicateIngredient, input.locale),
    ingredientKey: key,
    ruleId: null,
    sourceId: null,
    requiresPharmacist: true,
  }))
}

/**
 * Duplicate active ingredients *within* the recommended set — the "cold
 * medicine plus painkiller" case from §18. Returns the shared ingredient keys.
 */
export function detectDuplicatesWithinSet(
  items: { productId: string | null; ingredientKeys: string[] }[],
): { ingredientKey: string; productIds: string[] }[] {
  const byIngredient = new Map<string, string[]>()
  for (const item of items) {
    for (const key of item.ingredientKeys) {
      const list = byIngredient.get(key) ?? []
      if (item.productId) list.push(item.productId)
      byIngredient.set(key, list)
    }
  }
  return [...byIngredient.entries()]
    .filter(([, productIds]) => productIds.length > 1)
    .map(([ingredientKey, productIds]) => ({ ingredientKey, productIds }))
}

export function duplicateWarningText(locale: string): string {
  return tr(MESSAGES.duplicateIngredient, locale)
}

export function prescriptionOnlyText(locale: string): string {
  return tr(MESSAGES.prescriptionOnly, locale)
}

export function outOfStockText(locale: string): string {
  return tr(MESSAGES.outOfStock, locale)
}

export function expiredText(locale: string): string {
  return tr(MESSAGES.expired, locale)
}

/** Highest-severity outcome across a set of findings. */
export function worstOutcome(findings: SafetyFinding[]): SafetyOutcomeKey {
  if (findings.some((f) => f.outcome === 'BLOCK')) return 'BLOCK'
  if (findings.some((f) => f.outcome === 'UNKNOWN')) return 'UNKNOWN'
  if (findings.some((f) => f.outcome === 'WARN')) return 'WARN'
  return 'PASS'
}
