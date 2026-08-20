import 'server-only'

import type { CandidateProduct, GuidelineRecord } from './retrieval'
import type { SafetyFinding } from './contraindications'
import type { InteractionStatusKey, RecommendationStatusKey, TriageLevelKey } from './types'

/**
 * Product ranking (§14).
 *
 * The order of the criteria in the specification is the order of precedence
 * here, and it is enforced structurally rather than by weighting:
 *
 *   1. status      — BLOCKED never appears; SAFE_TO_SHOW outranks anything
 *                    still needing a pharmacist.
 *   2. safetyScore — how many warnings, unknowns and interaction cautions the
 *                    product carries. Eligibility (age, allergy, pregnancy,
 *                    conditions, current medicines) all land here.
 *   3. relevance   — how well the product matches the approved guideline for
 *                    this symptom, plus availability.
 *   4. name        — a stable tiebreak, so the same inputs always produce the
 *                    same order.
 *
 * Price, margin, discount and stock volume are deliberately absent from the
 * ranking. `costPrice` is never even read by this module — the ranking cannot
 * be influenced by profitability, by construction.
 */

export interface CandidateAssessment {
  candidate: CandidateProduct
  findings: SafetyFinding[]
  interactionStatus: InteractionStatusKey
}

export interface ScoredCandidate extends CandidateAssessment {
  status: RecommendationStatusKey
  blockedReason: string | null
  safetyScore: number
  relevanceScore: number
  rank: number
}

/** Penalty per finding class. Higher penalty = lower safety score. */
const PENALTY = {
  warn: 8,
  requiresPharmacist: 15,
  unknown: 20,
  interactionCaution: 20,
  interactionUnknown: 25,
} as const

export function scoreSafety(assessment: CandidateAssessment): number {
  let score = 100
  for (const finding of assessment.findings) {
    if (finding.outcome === 'BLOCK') return 0
    if (finding.outcome === 'UNKNOWN') score -= PENALTY.unknown
    else if (finding.outcome === 'WARN') score -= PENALTY.warn
    if (finding.requiresPharmacist) score -= PENALTY.requiresPharmacist
  }
  if (assessment.interactionStatus === 'SIGNIFICANT_RISK') return 0
  if (assessment.interactionStatus === 'CAUTION') score -= PENALTY.interactionCaution
  if (assessment.interactionStatus === 'UNKNOWN') score -= PENALTY.interactionUnknown

  return Math.max(0, Math.min(100, score))
}

export function scoreRelevance(
  candidate: CandidateProduct,
  guideline: GuidelineRecord,
): number {
  let score = 0

  // Symptom relevance: an ingredient the guideline names is the strongest
  // signal, a category inside the guideline scope the next.
  const ingredientMatches = candidate.ingredientKeys.filter((key) =>
    guideline.ingredientKeys.includes(key),
  ).length
  if (ingredientMatches > 0) score += 45
  if (guideline.categorySlugs.includes(candidate.categorySlug)) score += 20

  // A single-ingredient product is preferred over a combination: fewer active
  // substances means fewer ways to interact or to duplicate.
  if (candidate.ingredientKeys.length === 1) score += 12
  else if (candidate.ingredientKeys.length > 2) score -= 8

  // Availability (§14.10) — enough stock to actually fulfil the order.
  if (candidate.stock >= 10) score += 10
  else if (candidate.stock >= 3) score += 5

  // Verified label text present means we can show real usage guidance.
  if (candidate.usage) score += 5

  // Customer rating as a mild tiebreak only.
  score += Math.round(Math.min(5, candidate.ratingAvg))

  return Math.max(0, Math.min(100, score))
}

/**
 * Resolves a candidate's display status. `triageLevel` matters because nothing
 * is shown as ready-to-use unless the triage outcome was clean self-care (§10,
 * §15) — at level 3 the same product is offered only for pharmacist review.
 */
export function resolveStatus(input: {
  findings: SafetyFinding[]
  interactionStatus: InteractionStatusKey
  triageLevel: TriageLevelKey
}): { status: RecommendationStatusKey; blockedReason: string | null } {
  const blocking = input.findings.find((f) => f.outcome === 'BLOCK')
  if (blocking) return { status: 'BLOCKED', blockedReason: blocking.message }
  if (input.interactionStatus === 'SIGNIFICANT_RISK') {
    const interaction = input.findings.find((f) => f.code === 'interaction.significant_risk')
    return {
      status: 'BLOCKED',
      blockedReason: interaction?.message ?? 'Significant interaction risk',
    }
  }

  const needsHuman =
    input.findings.some((f) => f.requiresPharmacist || f.outcome === 'UNKNOWN') ||
    input.interactionStatus === 'UNKNOWN' ||
    input.triageLevel !== 'SELF_CARE'

  return { status: needsHuman ? 'PHARMACIST_REVIEW_REQUIRED' : 'SAFE_TO_SHOW', blockedReason: null }
}

const STATUS_ORDER: Record<RecommendationStatusKey, number> = {
  SAFE_TO_SHOW: 0,
  PHARMACIST_REVIEW_REQUIRED: 1,
  BLOCKED: 2,
}

export function rankCandidates(input: {
  assessments: CandidateAssessment[]
  guideline: GuidelineRecord
  triageLevel: TriageLevelKey
}): ScoredCandidate[] {
  const scored = input.assessments.map((assessment) => {
    const { status, blockedReason } = resolveStatus({
      findings: assessment.findings,
      interactionStatus: assessment.interactionStatus,
      triageLevel: input.triageLevel,
    })
    return {
      ...assessment,
      status,
      blockedReason,
      safetyScore: scoreSafety(assessment),
      relevanceScore: scoreRelevance(assessment.candidate, input.guideline),
      rank: 0,
    }
  })

  scored.sort((a, b) => {
    if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) {
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    }
    if (a.safetyScore !== b.safetyScore) return b.safetyScore - a.safetyScore
    if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore
    return a.candidate.name.localeCompare(b.candidate.name)
  })

  return scored.map((item, index) => ({ ...item, rank: index + 1 }))
}
