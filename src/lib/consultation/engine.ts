import 'server-only'

import { prisma } from '../prisma'
import { mediaUrl } from '../storage'
import { notifyStaff } from '../notifications'
import { getSettings, localizedDisclaimer, type PharmacySettings } from '../settings'
import { env } from '../env'

import { logStage, RULES_VERSION } from './audit'
import {
  checkContraindications,
  checkDuplicateWithCurrentMedication,
  detectDuplicatesWithinSet,
  duplicateWarningText,
  effectiveMinAge,
  type CustomerSafetyProfile,
} from './contraindications'
import { buildExposure, ingredientByKey } from './ingredients'
import { checkInteractions } from './interactions'
import {
  composeAssessment,
  isLlmConfigured,
  PROMPT_VERSION,
  screenRedFlagsWithLlm,
  validateComposition,
} from './llm'
import { rankCandidates, type CandidateAssessment, type ScoredCandidate } from './ranking'
import { mergeRedFlags, screenAge, screenFreeText, type DetectedRedFlag } from './red-flags'
import {
  deterministicSections,
  emergencyResponse,
  labelRuleText,
  productReason,
  symptomSummary,
  type ResponseSections,
  type SummaryInput,
} from './responses'
import {
  findCandidates,
  guidelinePrecaution,
  guidelineRationale,
  loadGuideline,
  type GuidelineRecord,
} from './retrieval'
import { persistRedFlags, reload, toAnswerState, type ConsultationRecord } from './session'
import {
  assessDuration,
  assessTriage,
  escalateOutcome,
  reasonsToText,
  type TriageOutcome,
} from './triage'
import {
  onsetHours,
  RED_FLAG_BY_CODE,
  redFlagLabel,
  TRIAGE_RANK,
  type CourseKey,
  type RedFlagSeverityKey,
  type TriageLevelKey,
  type WireRecommendation,
  type WireResult,
  type WireSafetyNotice,
} from './types'

/**
 * The consultation pipeline (§12).
 *
 *   Customer answers → symptom extraction → red flag assessment → triage
 *   → contraindication check → interaction check → pharmacy product search
 *   → ranking → safety validation → final response
 *
 * Two invariants hold throughout:
 *
 *  • The model never decides. Triage comes from `triage.ts`, verdicts from the
 *    rule tables, products from the catalogue. The model only phrases the
 *    result, and its text is re-validated before it is stored.
 *  • An emergency ends the pipeline. No retrieval runs, no product row is
 *    written, and the response carries nothing beneath the emergency message.
 */

export interface AssessmentResult {
  consultation: ConsultationRecord
  result: WireResult
}

export async function runAssessment(input: {
  consultation: ConsultationRecord
  settings?: PharmacySettings
}): Promise<AssessmentResult> {
  const settings = input.settings ?? (await getSettings())
  const consultation = input.consultation
  const locale = consultation.locale
  const state = toAnswerState(consultation)

  const summaryInput: SummaryInput = {
    locale,
    primarySymptom: consultation.primarySymptom,
    secondarySymptoms: consultation.secondarySymptoms,
    onsetCode: consultation.onsetCode,
    severity: consultation.severity,
    freeText: consultation.symptomFreeText,
  }

  // ── 1. red flag assessment ─────────────────────────────────────────────
  const redFlags = await assessRedFlags({ consultation, settings })

  // ── 2. guideline lookup ────────────────────────────────────────────────
  const guideline = await loadGuideline(consultation.primarySymptom)
  await logStage({
    consultationId: consultation.id,
    stage: 'guideline_lookup',
    summary: guideline
      ? `Guideline ${guideline.key} (max ${guideline.maxSelfCareDays}d self-care)`
      : `No approved guideline for ${consultation.primarySymptom ?? 'unknown symptom'}`,
    payload: guideline ? { guidelineId: guideline.id, sourceId: guideline.sourceId } : null,
  })

  // ── 3. triage ──────────────────────────────────────────────────────────
  const duration = assessDuration({
    onsetHours: onsetHours(consultation.onsetCode),
    course: (consultation.course as CourseKey | null) ?? null,
    maxSelfCareDays: guideline?.maxSelfCareDays ?? 3,
  })

  const unresolvedMedication = consultation.medications.some((m) => m.unresolved)

  const triage = assessTriage({
    redFlags,
    ageBand: consultation.ageBand as never,
    exactAgeYears: consultation.exactAgeYears,
    pregnancy: consultation.pregnancy as never,
    conditions: consultation.conditions.map((c) => c.conditionCode),
    medicationCount: consultation.medications.length,
    unresolvedMedication,
    allergyDeclared: state.allergyDeclared,
    severity: consultation.severity,
    worsening: consultation.worsening,
    duration,
    primarySymptom: consultation.primarySymptom,
    hasGuideline: Boolean(guideline),
    symptomUnclear: !consultation.primarySymptom || consultation.primarySymptom === 'other',
  })

  await logStage({
    consultationId: consultation.id,
    stage: 'triage',
    summary: `Triage ${triage.level} (${triage.reasons.length} reason(s))`,
    payload: {
      level: triage.level,
      reasons: triage.reasons.map((r) => r.code),
      durationDays: duration.days,
      exceedsSelfCare: duration.exceedsSelfCare,
    },
  })

  // ── 4. emergency short-circuit (§9, §27) ───────────────────────────────
  if (triage.level === 'EMERGENCY') {
    return finalise({
      consultation,
      settings,
      triage,
      redFlags,
      sections: emergencyResponse({
        locale,
        emergencyNumber: settings.emergencyNumber,
        emergencyNote: settings.emergencyNote,
        summary: summaryInput,
      }),
      scored: [],
      shown: [],
      notices: [],
      duplicateWarning: null,
      summaryInput,
      llmUsed: false,
      guideline,
    })
  }

  // ── 5. safety profile ──────────────────────────────────────────────────
  const profile = await buildSafetyProfile(consultation, state.allergyDeclared)

  // ── 6. retrieval, contraindications, interactions ──────────────────────
  const notices: WireSafetyNotice[] = []
  let assessments: CandidateAssessment[] = []

  const guidelineAgeBlocked =
    guideline?.minAgeYears != null &&
    (effectiveMinAge(profile) ?? -1) >= 0 &&
    (effectiveMinAge(profile) ?? 0) < guideline.minAgeYears

  if (guideline && !guidelineAgeBlocked) {
    const candidates = await findCandidates({
      guideline,
      locale,
      allowedCategorySlugs: settings.consultationAllowedCategorySlugs,
      blockedProductIds: settings.consultationBlockedProductIds,
      minExpiryDays: settings.consultationMinExpiryDays,
      take: 12,
    })

    await logStage({
      consultationId: consultation.id,
      stage: 'product_retrieval',
      summary: `${candidates.length} candidate product(s) inside guideline scope`,
      payload: { guidelineId: guideline.id, candidateIds: candidates.map((c) => c.id) },
    })

    assessments = await Promise.all(
      candidates.map(async (candidate): Promise<CandidateAssessment> => {
        const contraindications = await checkContraindications({
          ingredientKeys: candidate.ingredientKeys,
          profile,
          locale,
          pregnancyNeedsPharmacist: guideline.pregnancyNeedsPharmacist,
        })
        const duplicates = checkDuplicateWithCurrentMedication({
          ingredientKeys: candidate.ingredientKeys,
          exposure: profile.exposure,
          locale,
        })
        const interaction = await checkInteractions({
          candidateIngredientKeys: candidate.ingredientKeys,
          exposure: profile.exposure,
          locale,
        })

        return {
          candidate,
          findings: [...contraindications, ...duplicates, ...interaction.findings],
          interactionStatus: interaction.status,
        }
      }),
    )

    await logStage({
      consultationId: consultation.id,
      stage: 'contraindication_check',
      summary: `${assessments.reduce((n, a) => n + a.findings.length, 0)} finding(s) across ${assessments.length} product(s)`,
      payload: {
        blocked: assessments
          .filter((a) => a.findings.some((f) => f.outcome === 'BLOCK'))
          .map((a) => a.candidate.name),
      },
    })
    await logStage({
      consultationId: consultation.id,
      stage: 'interaction_check',
      summary: assessments
        .map((a) => `${a.candidate.name}:${a.interactionStatus}`)
        .join(', ')
        .slice(0, 400),
      payload: { unresolvedMedications: profile.exposure.unresolved },
    })
  } else if (guidelineAgeBlocked && guideline) {
    notices.push({
      type: 'GUIDELINE_SCOPE',
      outcome: 'BLOCK',
      code: 'guideline.below_min_age',
      message: guidelineRationale(guideline, locale),
      productName: null,
    })
  }

  // ── 7. feed the safety verdicts back into triage ───────────────────────
  // The contraindication and interaction engines only run once candidates
  // exist, so anything they discovered has to be able to raise the level
  // before the products are ranked and labelled (§10).
  let effectiveTriage = triage

  const interactionUncertain = assessments.some(
    (item) => item.interactionStatus !== 'SAFE',
  )
  const needsHumanJudgement = assessments.some((item) =>
    item.findings.some((finding) => finding.requiresPharmacist || finding.outcome === 'UNKNOWN'),
  )
  const blockedForThisCustomer = assessments.some((item) =>
    item.findings.some((finding) => finding.outcome === 'BLOCK'),
  )

  if (interactionUncertain) {
    effectiveTriage = escalateOutcome(effectiveTriage, 'interaction.uncertain', 'PHARMACIST_CONSULTATION')
  }
  if (needsHumanJudgement || blockedForThisCustomer) {
    effectiveTriage = escalateOutcome(
      effectiveTriage,
      'contraindication.present',
      'PHARMACIST_CONSULTATION',
    )
  }

  if (effectiveTriage.level !== triage.level) {
    await logStage({
      consultationId: consultation.id,
      stage: 'triage',
      summary: `Triage escalated ${triage.level} → ${effectiveTriage.level} by safety findings`,
      payload: {
        interactionUncertain,
        needsHumanJudgement,
        blockedForThisCustomer,
      },
    })
  }

  // ── 8. ranking ─────────────────────────────────────────────────────────
  const scored = guideline
    ? rankCandidates({ assessments, guideline, triageLevel: effectiveTriage.level })
    : []

  const showable = scored.filter((item) => item.status !== 'BLOCKED')
  const shown = showable.slice(0, Math.max(1, settings.consultationMaxProducts))

  await logStage({
    consultationId: consultation.id,
    stage: 'ranking',
    summary: `${shown.length} of ${scored.length} product(s) selected for display`,
    payload: {
      considered: scored.map((s) => ({
        name: s.candidate.name,
        status: s.status,
        safety: s.safetyScore,
        relevance: s.relevanceScore,
      })),
    },
  })

  // ── 9. multi-product safety (§18) ──────────────────────────────────────
  const duplicatesInSet = detectDuplicatesWithinSet(
    shown.map((item) => ({ productId: item.candidate.id, ingredientKeys: item.candidate.ingredientKeys })),
  )
  const duplicateWarning = duplicatesInSet.length > 0 ? duplicateWarningText(locale) : null

  if (duplicatesInSet.length > 0) {
    await logStage({
      consultationId: consultation.id,
      stage: 'duplicate_check',
      summary: `Shared active ingredient across suggestions: ${duplicatesInSet
        .map((d) => d.ingredientKey)
        .join(', ')}`,
      payload: { duplicates: duplicatesInSet },
    })
  }

  for (const item of shown) {
    for (const finding of item.findings) {
      if (finding.outcome === 'PASS') continue
      notices.push({
        type: finding.type,
        outcome: finding.outcome,
        code: finding.code,
        message: finding.message,
        productName: item.candidate.name,
      })
    }
  }

  // ── 10. response composition + safety validation ───────────────────────
  const guidelineText = guideline ? guidelinePrecaution(guideline, locale) : null
  const safetyNotes = uniqueStrings(
    shown.flatMap((item) => item.findings.filter((f) => f.outcome !== 'PASS').map((f) => f.message)),
  )

  const fallback = deterministicSections({
    ...summaryInput,
    triageLevel: effectiveTriage.level,
    triageReason: reasonsToText(effectiveTriage.reasons, locale),
    guidelinePrecaution: guidelineText,
    safetyNotes,
    hasProducts: shown.length > 0,
    emergencyNumber: settings.emergencyNumber,
  })

  const { sections, llmUsed } = await composeWithGuardrails({
    consultation,
    settings,
    triage: effectiveTriage,
    redFlags,
    guideline,
    shown,
    duplicateWarning,
    safetyNotes,
    fallback,
    summaryInput,
  })

  return finalise({
    consultation,
    settings,
    triage: effectiveTriage,
    redFlags,
    sections,
    scored,
    shown,
    notices,
    duplicateWarning,
    summaryInput,
    llmUsed,
    guideline,
  })
}

// ─────────────────────────── red flag assessment ───────────────────────────

async function assessRedFlags(input: {
  consultation: ConsultationRecord
  settings: PharmacySettings
}): Promise<DetectedRedFlag[]> {
  const { consultation, settings } = input

  const stored: DetectedRedFlag[] = consultation.redFlags.map((row) => ({
    code: row.code,
    severity: row.severity as RedFlagSeverityKey,
    source: row.source as DetectedRedFlag['source'],
    evidence: row.evidence,
  }))

  // Free text from every answer, not just the dedicated description field: a
  // customer may describe an emergency inside "what have you already taken".
  const freeTextBlobs = [
    consultation.symptomFreeText,
    ...consultation.answers
      .map((answer) => answer.answerValue)
      .filter((value): value is string => typeof value === 'string'),
  ].filter((value): value is string => Boolean(value))

  const textFlags = freeTextBlobs.flatMap((text) => screenFreeText(text))

  const ageFlags = screenAge({
    ageBand: consultation.ageBand,
    exactAgeYears: consultation.exactAgeYears,
    primarySymptom: consultation.primarySymptom,
    secondarySymptoms: consultation.secondarySymptoms,
    severity: consultation.severity,
  })

  let llmFlags: DetectedRedFlag[] = []
  if (settings.consultationLlmEnabled && isLlmConfigured()) {
    const digest = answerDigest(consultation)
    const startedAt = Date.now()
    const screen = await screenRedFlagsWithLlm({ locale: consultation.locale, answerDigest: digest })
    if (screen) {
      llmFlags = screen.redFlagCodes.map((code) => ({
        code,
        severity: 'URGENT' as RedFlagSeverityKey,
        source: 'LLM' as const,
        evidence: screen.reasoning.slice(0, 160),
      }))
      // Codes the catalogue marks EMERGENCY stay EMERGENCY — `mergeRedFlags`
      // resolves that from the catalogue, not from the model's opinion.
      await logStage({
        consultationId: consultation.id,
        stage: 'red_flag_screening',
        summary: `LLM screen added ${screen.redFlagCodes.length} candidate flag(s)`,
        payload: { codes: screen.redFlagCodes, reasoning: screen.reasoning },
        aiModel: env().CONSULTATION_MODEL,
        latencyMs: Date.now() - startedAt,
      })
    }
  }

  const catalogueSeverity = (flag: DetectedRedFlag): DetectedRedFlag => ({
    ...flag,
    severity: severityFromCatalogue(flag.code) ?? flag.severity,
  })

  const merged = mergeRedFlags(
    stored.map(catalogueSeverity),
    textFlags.map(catalogueSeverity),
    ageFlags.map(catalogueSeverity),
    llmFlags.map(catalogueSeverity),
  )

  const newFlags = merged.filter(
    (flag) => !consultation.redFlags.some((row) => row.code === flag.code),
  )
  if (newFlags.length > 0) {
    await persistRedFlags(consultation.id, newFlags, consultation.locale)
  }

  await logStage({
    consultationId: consultation.id,
    stage: 'red_flag_screening',
    summary: merged.length === 0 ? 'No red flags detected' : `Red flags: ${merged.map((f) => f.code).join(', ')}`,
    payload: {
      flags: merged.map((f) => ({ code: f.code, severity: f.severity, source: f.source })),
    },
  })

  return merged
}

/**
 * The catalogue, not the detector, owns severity. A model that reports
 * `chest_pain` as merely "urgent" cannot downgrade an EMERGENCY code, and an
 * unrecognised code keeps whatever the detector claimed so it is still visible
 * to the pharmacist rather than being silently dropped.
 */
function severityFromCatalogue(code: string): RedFlagSeverityKey | null {
  return RED_FLAG_BY_CODE.get(code)?.severity ?? null
}

// ──────────────────────────── safety profile ───────────────────────────────

async function buildSafetyProfile(
  consultation: ConsultationRecord,
  allergyDeclared: 'yes' | 'no' | 'unknown' | null,
): Promise<CustomerSafetyProfile> {
  const allergyIngredientKeys = new Set<string>()
  const allergyClassKeys = new Set<string>()
  const unresolvedAllergies: string[] = []

  for (const allergy of consultation.allergies) {
    if (!allergy.ingredientKey) {
      unresolvedAllergies.push(allergy.medication)
      continue
    }
    allergyIngredientKeys.add(allergy.ingredientKey)
    const ingredient = await ingredientByKey(allergy.ingredientKey)
    if (ingredient?.classKey) allergyClassKeys.add(ingredient.classKey)
  }

  const exposure = await buildExposure(
    consultation.medications.map((m) => ({ name: m.name, ingredientKey: m.ingredientKey })),
  )

  return {
    ageBand: consultation.ageBand as never,
    exactAgeYears: consultation.exactAgeYears,
    sex: consultation.sex as never,
    pregnancy: consultation.pregnancy as never,
    conditions: consultation.conditions.map((c) => c.conditionCode),
    allergyIngredientKeys,
    allergyClassKeys,
    unresolvedAllergies,
    allergyDeclared,
    exposure,
  }
}

// ──────────────────────── composition with guardrails ──────────────────────

async function composeWithGuardrails(input: {
  consultation: ConsultationRecord
  settings: PharmacySettings
  triage: TriageOutcome
  redFlags: DetectedRedFlag[]
  guideline: GuidelineRecord | null
  shown: ScoredCandidate[]
  duplicateWarning: string | null
  safetyNotes: string[]
  fallback: ResponseSections
  summaryInput: SummaryInput
}): Promise<{ sections: ResponseSections; llmUsed: boolean }> {
  const { settings, consultation } = input

  if (!settings.consultationLlmEnabled || !isLlmConfigured()) {
    return { sections: input.fallback, llmUsed: false }
  }

  const startedAt = Date.now()
  const composed = await composeAssessment({
    locale: consultation.locale,
    grounding: buildGrounding(input),
    extraSystemPrompt: settings.consultationSystemPromptExtra,
  })

  if (!composed) {
    await logStage({
      consultationId: consultation.id,
      stage: 'response_composition',
      summary: 'Model unavailable — deterministic wording used',
      aiModel: env().CONSULTATION_MODEL,
      latencyMs: Date.now() - startedAt,
    })
    return { sections: input.fallback, llmUsed: false }
  }

  const allowedTerms = [
    ...input.shown.map((item) => item.candidate.name),
    ...input.shown.flatMap((item) => item.candidate.ingredientNames),
  ]
  const forbiddenTerms = await forbiddenTermList(input.shown)

  const sections: ResponseSections = {
    understood: composed.understood || input.fallback.understood,
    safetyAssessment: composed.safetyAssessment || input.fallback.safetyAssessment,
    nextStep: composed.nextStep || input.fallback.nextStep,
    precautions: composed.precautions || input.fallback.precautions,
    seekCare: composed.seekCare || input.fallback.seekCare,
  }

  const validation = validateComposition({
    texts: Object.values(sections),
    allowedTerms,
    forbiddenTerms,
    emergency: input.triage.level === 'EMERGENCY',
  })

  await logStage({
    consultationId: consultation.id,
    stage: 'safety_validation',
    summary: validation.ok
      ? 'Generated response passed safety validation'
      : `Generated response rejected: ${validation.violations.slice(0, 4).join('; ')}`,
    payload: { violations: validation.violations },
    aiModel: env().CONSULTATION_MODEL,
    latencyMs: Date.now() - startedAt,
  })

  if (!validation.ok) {
    return { sections: input.fallback, llmUsed: false }
  }

  // The label rule is appended by the engine, never left to the model.
  const labelRule = labelRuleText(consultation.locale)
  if (sections.precautions && !sections.precautions.includes(labelRule)) {
    sections.precautions = `${sections.precautions} ${labelRule}`.trim()
  }
  if (input.duplicateWarning && !sections.precautions.includes(input.duplicateWarning)) {
    sections.precautions = `${sections.precautions} ${input.duplicateWarning}`.trim()
  }

  return { sections, llmUsed: true }
}

/**
 * The only thing the model sees. Everything in here is a decision already made
 * by the engines — there is nothing for the model to infer.
 */
function buildGrounding(input: {
  consultation: ConsultationRecord
  triage: TriageOutcome
  redFlags: DetectedRedFlag[]
  guideline: GuidelineRecord | null
  shown: ScoredCandidate[]
  safetyNotes: string[]
  duplicateWarning: string | null
  settings: PharmacySettings
  summaryInput: SummaryInput
}): string {
  const locale = input.consultation.locale
  const lines: string[] = []

  lines.push(`LOCALE: ${locale}`)
  lines.push(`PHARMACY: ${input.settings.pharmacyName} ${input.settings.pharmacyTagline}`)
  lines.push(`EMERGENCY NUMBER: ${input.settings.emergencyNumber}`)
  lines.push('')
  lines.push(`COMPLAINT SUMMARY: ${symptomSummary(input.summaryInput) || 'not categorised'}`)
  if (input.consultation.symptomFreeText) {
    lines.push(`CUSTOMER OWN WORDS: ${input.consultation.symptomFreeText.slice(0, 500)}`)
  }
  lines.push(
    `PATIENT CONTEXT: age band ${input.consultation.ageBand ?? 'unknown'}; pregnancy ${
      input.consultation.pregnancy ?? 'not stated'
    }; chronic conditions ${
      input.consultation.conditions.map((c) => c.conditionCode).join(', ') || 'none reported'
    }; current medicines ${input.consultation.medications.length}; allergies ${
      input.consultation.allergies.map((a) => a.medication).join(', ') || 'none reported'
    }`,
  )
  lines.push('')
  lines.push(`TRIAGE DECISION (FIXED, DO NOT REVISIT): ${input.triage.level}`)
  lines.push(`TRIAGE REASONS: ${reasonsToText(input.triage.reasons, locale) || 'none'}`)
  lines.push(
    `RED FLAGS: ${
      input.redFlags.map((f) => `${redFlagLabel(f.code, locale)} (${f.severity})`).join('; ') || 'none'
    }`,
  )
  lines.push('')

  if (input.guideline) {
    lines.push(`APPROVED GUIDELINE: ${input.guideline.title}`)
    lines.push(`GUIDELINE RATIONALE (you may paraphrase): ${guidelineRationale(input.guideline, locale)}`)
    const precaution = guidelinePrecaution(input.guideline, locale)
    if (precaution) lines.push(`GUIDELINE PRECAUTION: ${precaution}`)
    lines.push(`SELF-CARE WINDOW: ${input.guideline.maxSelfCareDays} days`)
  } else {
    lines.push('APPROVED GUIDELINE: none for this complaint. Do not suggest any product.')
  }

  lines.push('')
  if (input.shown.length > 0) {
    lines.push('PRODUCTS (the only products you may refer to; the interface shows the cards):')
    for (const item of input.shown) {
      lines.push(
        `- ${item.candidate.name} | ingredients: ${
          item.candidate.ingredientNames.join(', ') || 'not recorded'
        } | status: ${item.status} | interaction: ${item.interactionStatus}`,
      )
    }
  } else {
    lines.push('PRODUCTS: none. Say that no suitable over-the-counter option was found.')
  }

  lines.push('')
  lines.push(
    `SAFETY NOTES (use these verbatim in meaning): ${
      input.safetyNotes.join(' | ') || 'no specific warnings'
    }`,
  )
  if (input.duplicateWarning) lines.push(`DUPLICATE INGREDIENT WARNING: ${input.duplicateWarning}`)
  lines.push('')
  lines.push('REMINDER: no doses, no diagnosis, no new product names, no reassurance that contradicts the triage decision.')

  return lines.join('\n')
}

/** Prescription-only ingredient names must never appear in generated text. */
async function forbiddenTermList(shown: ScoredCandidate[]): Promise<string[]> {
  const allowed = new Set(shown.flatMap((item) => item.candidate.ingredientKeys))
  const rows = await prisma.activeIngredient.findMany({
    where: { isOtc: false },
    select: { key: true, name: true, nameMn: true },
  })
  return rows
    .filter((row) => !allowed.has(row.key))
    .flatMap((row) => [row.name, row.nameMn])
    .filter((name): name is string => Boolean(name))
}

// ──────────────────────────── persist & project ────────────────────────────

async function finalise(input: {
  consultation: ConsultationRecord
  settings: PharmacySettings
  triage: TriageOutcome
  redFlags: DetectedRedFlag[]
  sections: ResponseSections
  scored: ScoredCandidate[]
  shown: ScoredCandidate[]
  notices: WireSafetyNotice[]
  duplicateWarning: string | null
  summaryInput: SummaryInput
  llmUsed: boolean
  guideline: GuidelineRecord | null
}): Promise<AssessmentResult> {
  const { consultation, settings, triage, sections } = input
  const locale = consultation.locale
  const shownIds = new Set(input.shown.map((item) => item.candidate.id))

  await prisma.$transaction(async (tx) => {
    // A re-assessment replaces the machine-generated rows but never touches the
    // ones a pharmacist added.
    await tx.consultationRecommendation.deleteMany({
      where: { consultationId: consultation.id, addedByPharmacist: false },
    })
    await tx.consultationSafetyCheck.deleteMany({ where: { consultationId: consultation.id } })

    for (const item of input.scored) {
      const isShown = shownIds.has(item.candidate.id)
      await tx.consultationRecommendation.create({
        data: {
          consultationId: consultation.id,
          productId: item.candidate.id,
          productName: item.candidate.name,
          categoryName: item.candidate.categoryName,
          activeIngredients: item.candidate.activeIngredientsText,
          dosageForm: item.candidate.dosageForm,
          strength: item.candidate.strength,
          packageSize: item.candidate.packageSize,
          price: item.candidate.price,
          prescriptionRequired: false,
          stockQuantity: item.candidate.stock,
          imageKey: item.candidate.imageKey,
          status: item.status as never,
          rank: item.rank,
          safetyScore: item.safetyScore,
          relevanceScore: item.relevanceScore,
          reason: isShown && input.guideline
            ? productReason({
                locale,
                guidelineRationale: guidelineRationale(input.guideline, locale),
                ingredientNames: item.candidate.ingredientNames,
              })
            : null,
          safetyNotes: uniqueStrings(
            item.findings.filter((f) => f.outcome !== 'PASS').map((f) => f.message),
          ).join(' ') || null,
          interactionStatus: item.interactionStatus as never,
          blockedReason: item.blockedReason,
          guidelineId: input.guideline?.id ?? null,
          sourceId: input.guideline?.sourceId ?? null,
        },
      })

      for (const finding of item.findings) {
        await tx.consultationSafetyCheck.create({
          data: {
            consultationId: consultation.id,
            productId: item.candidate.id,
            productName: item.candidate.name,
            type: finding.type as never,
            outcome: finding.outcome as never,
            code: finding.code,
            detail: finding.message,
            ingredientKey: finding.ingredientKey,
            ruleId: finding.ruleId,
            sourceId: finding.sourceId,
          },
        })
      }
    }

    await tx.consultation.update({
      where: { id: consultation.id },
      data: {
        status: 'ASSESSED',
        currentStep: 'RESULT',
        triageLevel: triage.level as never,
        recommendationType: triage.recommendationType as never,
        triageReason: reasonsToText(triage.reasons, locale) || null,
        aiUnderstood: sections.understood || null,
        aiSafetyAssessment: sections.safetyAssessment || null,
        aiNextStep: sections.nextStep || null,
        aiPrecautions: sections.precautions || null,
        aiSeekCare: sections.seekCare || null,
        selfCareEligible: triage.selfCareEligible,
        pharmacistReviewRequired: triage.pharmacistReviewRequired,
        aiModel: input.llmUsed ? env().CONSULTATION_MODEL : null,
        promptVersion: PROMPT_VERSION,
        rulesVersion: RULES_VERSION,
        llmUsed: input.llmUsed,
        assessedAt: new Date(),
        completedAt: new Date(),
      },
    })
  })

  await logStage({
    consultationId: consultation.id,
    stage: 'assessment_completed',
    summary: `${triage.level} — ${input.shown.length} product(s) shown, ${input.scored.length} considered`,
    payload: {
      triageLevel: triage.level,
      recommendationType: triage.recommendationType,
      shown: input.shown.map((s) => s.candidate.name),
      llmUsed: input.llmUsed,
    },
    aiModel: input.llmUsed ? env().CONSULTATION_MODEL : null,
  })

  await maybeEscalate({ consultation, settings, triage })

  const updated = await reload(consultation.id)
  return {
    consultation: updated,
    result: projectResult({
      consultation: updated,
      settings,
      triage,
      redFlags: input.redFlags,
      sections,
      shown: input.shown,
      notices: input.notices,
      duplicateWarning: input.duplicateWarning,
      summaryInput: input.summaryInput,
      guideline: input.guideline,
    }),
  }
}

/** Notifies staff when the configured escalation threshold is reached (§23). */
async function maybeEscalate(input: {
  consultation: ConsultationRecord
  settings: PharmacySettings
  triage: TriageOutcome
}): Promise<void> {
  const threshold = (input.settings.consultationEscalationLevel || 'PHARMACIST_CONSULTATION') as TriageLevelKey
  const thresholdRank = TRIAGE_RANK[threshold] ?? TRIAGE_RANK.PHARMACIST_CONSULTATION
  if (TRIAGE_RANK[input.triage.level] > thresholdRank) return

  // No symptom, no free text, no answers — see the note in
  // `pharmacist.ts#handoffToPharmacist`: staff notifications are readable by
  // every staff account, so they carry only the reference and the urgency.
  await notifyStaff({
    type: input.triage.level === 'EMERGENCY' ? 'CONSULTATION_ESCALATION' : 'NEW_CONSULTATION',
    title:
      input.triage.level === 'EMERGENCY'
        ? `Яаралтай зөвлөгөө — ${input.consultation.code}`
        : `AI зөвлөгөө хяналт шаардаж байна — ${input.consultation.code}`,
    body: `Ангилал: ${input.triage.level}. Дэлгэрэнгүйг зөвлөгөөний хуудсаас үзнэ үү.`,
    linkUrl: `/admin/consultations/${input.consultation.id}`,
    data: { consultationId: input.consultation.id, triageLevel: input.triage.level },
    dedupeKey: `consultation:${input.consultation.id}:${input.triage.level}`,
  })
}

export function projectResult(input: {
  consultation: ConsultationRecord
  settings: PharmacySettings
  triage: TriageOutcome
  redFlags: DetectedRedFlag[]
  sections: ResponseSections
  shown: ScoredCandidate[]
  notices: WireSafetyNotice[]
  duplicateWarning: string | null
  summaryInput: SummaryInput
  guideline: GuidelineRecord | null
}): WireResult {
  const { consultation, settings } = input
  const locale = consultation.locale
  const emergency = input.triage.level === 'EMERGENCY'

  const pharmacistNote =
    consultation.reviews.length > 0
      ? consultation.reviews[0]!.pharmacistRecommendation ?? consultation.reviews[0]!.note ?? null
      : null

  const recommendations: WireRecommendation[] = emergency
    ? []
    : [
        // A pharmacist's own additions always come first (§21).
        ...consultation.recommendations
          .filter((row) => row.addedByPharmacist)
          .map((row) => toWireFromRow(row)),
        ...input.shown.map((item) => ({
          id: item.candidate.id,
          productId: item.candidate.id,
          slug: item.candidate.slug,
          name: item.candidate.name,
          categoryName: item.candidate.categoryName,
          activeIngredients: item.candidate.activeIngredientsText,
          dosageForm: item.candidate.dosageForm,
          strength: item.candidate.strength,
          packageSize: item.candidate.packageSize,
          price: item.candidate.price,
          imageUrl: item.candidate.imageUrl,
          inStock: item.candidate.stock > 0,
          stock: item.candidate.stock,
          prescriptionRequired: false,
          reason: input.guideline
            ? productReason({
                locale,
                guidelineRationale: guidelineRationale(input.guideline, locale),
                ingredientNames: item.candidate.ingredientNames,
              })
            : null,
          safetyNotes:
            uniqueStrings(
              item.findings.filter((f) => f.outcome !== 'PASS').map((f) => f.message),
            ).join(' ') || labelRuleText(locale),
          status: item.status,
          interactionStatus: item.interactionStatus,
          addedByPharmacist: false,
          sourceLabel: input.guideline?.sourceLabel ?? null,
        })),
      ]

  return {
    consultationId: consultation.id,
    code: consultation.code,
    locale,
    triageLevel: input.triage.level,
    recommendationType: input.triage.recommendationType,
    triageReason: reasonsToText(input.triage.reasons, locale) || null,
    understood: input.sections.understood,
    safetyAssessment: input.sections.safetyAssessment,
    nextStep: input.sections.nextStep,
    precautions: input.sections.precautions,
    seekCare: input.sections.seekCare,
    emergency,
    emergencyNumber: settings.emergencyNumber,
    redFlags: input.redFlags.map((flag) => ({
      code: flag.code,
      label: redFlagLabel(flag.code, locale),
      severity: flag.severity,
    })),
    recommendations,
    notices: emergency ? [] : input.notices,
    duplicateIngredientWarning: emergency ? null : input.duplicateWarning,
    pharmacistReviewRequired: input.triage.pharmacistReviewRequired,
    handedOff: Boolean(consultation.handedOffAt),
    pharmacistNote,
    symptomSummary: symptomSummary(input.summaryInput),
    disclaimer: localizedDisclaimer(settings, locale),
  }
}

function toWireFromRow(row: ConsultationRecord['recommendations'][number]): WireRecommendation {
  return {
    id: row.id,
    productId: row.productId,
    slug: null,
    name: row.productName,
    categoryName: row.categoryName,
    activeIngredients: row.activeIngredients,
    dosageForm: row.dosageForm,
    strength: row.strength,
    packageSize: row.packageSize,
    price: row.price,
    imageUrl: mediaUrl(row.imageKey),
    inStock: (row.stockQuantity ?? 0) > 0,
    stock: row.stockQuantity,
    prescriptionRequired: row.prescriptionRequired,
    reason: row.reason,
    safetyNotes: row.safetyNotes,
    status: row.status as WireRecommendation['status'],
    interactionStatus: row.interactionStatus as WireRecommendation['interactionStatus'],
    addedByPharmacist: row.addedByPharmacist,
    sourceLabel: null,
  }
}

// ───────────────────────────────── helpers ─────────────────────────────────

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
}

function answerDigest(consultation: ConsultationRecord): string {
  return consultation.answers
    .map((answer) => `${answer.questionText} → ${answer.answerLabel ?? JSON.stringify(answer.answerValue)}`)
    .join('\n')
}

/**
 * Rebuilds the customer-facing result from stored rows, without re-running the
 * pipeline. Used when a consultation is reopened from history or the admin.
 */
export async function loadStoredResult(input: {
  consultation: ConsultationRecord
  settings?: PharmacySettings
}): Promise<WireResult | null> {
  const consultation = input.consultation
  if (!consultation.assessedAt || !consultation.triageLevel) return null
  const settings = input.settings ?? (await getSettings())
  const locale = consultation.locale
  const emergency = consultation.triageLevel === 'EMERGENCY'

  const shownRows = consultation.recommendations.filter(
    (row) => row.status !== 'BLOCKED' && row.rank <= Math.max(1, settings.consultationMaxProducts),
  )
  const pharmacistRows = consultation.recommendations.filter((row) => row.addedByPharmacist)

  const pharmacistNote =
    consultation.reviews.length > 0
      ? consultation.reviews[0]!.pharmacistRecommendation ?? consultation.reviews[0]!.note ?? null
      : null

  return {
    consultationId: consultation.id,
    code: consultation.code,
    locale,
    triageLevel: consultation.triageLevel as never,
    recommendationType: (consultation.recommendationType ?? 'PHARMACIST_CONSULT') as never,
    triageReason: consultation.triageReason,
    understood: consultation.aiUnderstood ?? '',
    safetyAssessment: consultation.aiSafetyAssessment ?? '',
    nextStep: consultation.aiNextStep ?? '',
    precautions: consultation.aiPrecautions ?? '',
    seekCare: consultation.aiSeekCare ?? '',
    emergency,
    emergencyNumber: settings.emergencyNumber,
    redFlags: consultation.redFlags.map((flag) => ({
      code: flag.code,
      label: flag.label,
      severity: flag.severity as RedFlagSeverityKey,
    })),
    recommendations: emergency
      ? []
      : [...pharmacistRows, ...shownRows.filter((row) => !row.addedByPharmacist)].map(toWireFromRow),
    notices: emergency
      ? []
      : consultation.safetyChecks
          .filter((check) => check.outcome !== 'PASS')
          .map((check) => ({
            type: check.type,
            outcome: check.outcome as never,
            code: check.code,
            message: check.detail ?? check.code,
            productName: check.productName,
          })),
    duplicateIngredientWarning: consultation.safetyChecks.some(
      (check) => check.type === 'DUPLICATE_INGREDIENT',
    )
      ? duplicateWarningText(locale)
      : null,
    pharmacistReviewRequired: consultation.pharmacistReviewRequired,
    handedOff: Boolean(consultation.handedOffAt),
    pharmacistNote,
    symptomSummary: symptomSummary({
      locale,
      primarySymptom: consultation.primarySymptom,
      secondarySymptoms: consultation.secondarySymptoms,
      onsetCode: consultation.onsetCode,
      severity: consultation.severity,
      freeText: consultation.symptomFreeText,
    }),
    disclaimer: localizedDisclaimer(settings, locale),
  }
}
