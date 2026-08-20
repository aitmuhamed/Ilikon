import 'server-only'

import { prisma } from '../prisma'
import { t, tr, type InteractionStatusKey } from './types'
import type { ExposureProfile } from './ingredients'
import type { SafetyFinding } from './contraindications'

/**
 * `DrugInteractionAgent` (§17).
 *
 * Verdicts come only from the pharmacy's verified interaction table. The three
 * outcomes that matter:
 *
 *   SIGNIFICANT_RISK → the product is not recommended at all.
 *   CAUTION          → shown only with the pharmacist warning attached.
 *   UNKNOWN          → the customer is told that pharmacist verification is
 *                      required. This is the default whenever a medicine could
 *                      not be identified, and it is never silently upgraded to
 *                      SAFE (§8: "Do not make a confident interaction claim").
 *
 * SAFE means "a pharmacist has recorded this pair as safe", not "we found
 * nothing" — absence of a row for an identified pair is reported as SAFE only
 * because every ingredient the catalogue offers has a reviewed interaction
 * profile; an *unidentified* medicine always yields UNKNOWN.
 */

export const INTERACTION_RULES_VERSION = 'ix-2026.08.1'

const MESSAGES = {
  unknown: t(
    'Энэ хослолын аюулгүй байдлыг баталгаажуулахын тулд эм зүйчтэй зөвлөх шаардлагатай.',
    'A pharmacist needs to confirm whether this combination is safe.',
    'Необходимо, чтобы фармацевт подтвердил безопасность этой комбинации.',
  ),
  significant: t(
    'Таны хэрэглэж байгаа эмтэй хамт хэрэглэхэд эрсдэлтэй тул санал болгохгүй.',
    'Not offered: combining it with a medicine you already take carries a known risk.',
    'Не предлагается: сочетание с вашим лекарством несёт известный риск.',
  ),
} as const

export interface InteractionVerdict {
  status: InteractionStatusKey
  findings: SafetyFinding[]
}

interface RuleRow {
  id: string
  ingredientKeyA: string
  ingredientKeyB: string
  status: InteractionStatusKey
  adviceMn: string
  adviceEn: string
  adviceRu: string
  sourceId: string | null
}

function advice(rule: RuleRow, locale: string): string {
  if (locale === 'en') return rule.adviceEn
  if (locale === 'ru') return rule.adviceRu
  return rule.adviceMn
}

/** Pairs are stored with the keys sorted, so lookups must sort too. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::')
}

/**
 * Loads every verified rule connecting the candidate ingredients to the
 * ingredients the customer is already taking.
 */
async function loadRules(candidate: string[], current: string[]): Promise<Map<string, RuleRow>> {
  if (candidate.length === 0 || current.length === 0) return new Map()

  const all = [...new Set([...candidate, ...current])]
  const rows = await prisma.interactionRule.findMany({
    where: {
      isActive: true,
      ingredientKeyA: { in: all },
      ingredientKeyB: { in: all },
    },
    select: {
      id: true,
      ingredientKeyA: true,
      ingredientKeyB: true,
      status: true,
      adviceMn: true,
      adviceEn: true,
      adviceRu: true,
      sourceId: true,
    },
  })

  const map = new Map<string, RuleRow>()
  for (const row of rows) {
    map.set(pairKey(row.ingredientKeyA, row.ingredientKeyB), row as RuleRow)
  }
  return map
}

const RANK: Record<InteractionStatusKey, number> = {
  SIGNIFICANT_RISK: 0,
  UNKNOWN: 1,
  CAUTION: 2,
  SAFE: 3,
}

function worse(a: InteractionStatusKey, b: InteractionStatusKey): InteractionStatusKey {
  return RANK[a] <= RANK[b] ? a : b
}

/**
 * Checks one candidate product against everything the customer already takes.
 */
export async function checkInteractions(input: {
  candidateIngredientKeys: string[]
  exposure: ExposureProfile
  locale: string
}): Promise<InteractionVerdict> {
  const findings: SafetyFinding[] = []
  const currentKeys = [...input.exposure.ingredientKeys]

  // An unidentified medicine makes every verdict provisional, regardless of
  // what the rules say about the names we *could* resolve.
  if (input.exposure.unresolved.length > 0) {
    findings.push({
      type: 'INTERACTION',
      outcome: 'UNKNOWN',
      code: 'interaction.unresolved_medication',
      message: `${tr(MESSAGES.unknown, input.locale)} (${input.exposure.unresolved.join(', ')})`,
      ingredientKey: null,
      ruleId: null,
      sourceId: null,
      requiresPharmacist: true,
    })
  }

  if (currentKeys.length === 0) {
    // Nothing identified to interact with. Either the customer takes nothing —
    // in which case there is no interaction question to answer — or everything
    // they take is unresolved, which the finding above already reported.
    return {
      status: input.exposure.unresolved.length > 0 ? 'UNKNOWN' : 'SAFE',
      findings,
    }
  }

  const rules = await loadRules(input.candidateIngredientKeys, currentKeys)
  let status: InteractionStatusKey =
    input.exposure.unresolved.length > 0 ? 'UNKNOWN' : 'SAFE'

  for (const candidate of input.candidateIngredientKeys) {
    for (const current of currentKeys) {
      if (candidate === current) {
        // Same ingredient on both sides is a duplication problem, handled by
        // the duplicate check rather than as an interaction.
        continue
      }
      const rule = rules.get(pairKey(candidate, current))
      if (!rule) continue

      status = worse(status, rule.status)

      if (rule.status === 'SAFE') continue

      findings.push({
        type: 'INTERACTION',
        outcome:
          rule.status === 'SIGNIFICANT_RISK'
            ? 'BLOCK'
            : rule.status === 'UNKNOWN'
              ? 'UNKNOWN'
              : 'WARN',
        code:
          rule.status === 'SIGNIFICANT_RISK'
            ? 'interaction.significant_risk'
            : rule.status === 'UNKNOWN'
              ? 'interaction.unknown'
              : 'interaction.caution',
        message:
          rule.status === 'SIGNIFICANT_RISK'
            ? `${tr(MESSAGES.significant, input.locale)} ${advice(rule, input.locale)}`.trim()
            : advice(rule, input.locale) || tr(MESSAGES.unknown, input.locale),
        ingredientKey: candidate,
        ruleId: rule.id,
        sourceId: rule.sourceId,
        requiresPharmacist: rule.status !== 'CAUTION',
      })
    }
  }

  return { status, findings }
}

export function interactionUnknownText(locale: string): string {
  return tr(MESSAGES.unknown, locale)
}
