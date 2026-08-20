import 'server-only'

import { prisma } from '../prisma'
import { PROMPT_VERSION } from './llm'
import { QUESTIONNAIRE_VERSION } from './questionnaire'
import { RED_FLAG_RULES_VERSION } from './red-flags'
import { TRIAGE_RULES_VERSION } from './triage'
import { CONTRAINDICATION_RULES_VERSION } from './contraindications'
import { INTERACTION_RULES_VERSION } from './interactions'

/**
 * AI audit trail for consultations (§29).
 *
 * One row per pipeline stage, written as the stage completes. Failures are
 * swallowed and logged: losing an audit row must not deny a customer their
 * safety assessment, but it has to be visible in the server log.
 *
 * The combined rules version below is stamped on every consultation so a
 * behaviour change can be attributed to the exact rule set that produced it.
 */

export const RULES_VERSION = [
  QUESTIONNAIRE_VERSION,
  RED_FLAG_RULES_VERSION,
  TRIAGE_RULES_VERSION,
  CONTRAINDICATION_RULES_VERSION,
  INTERACTION_RULES_VERSION,
].join('|')

export type AuditStage =
  | 'consultation_started'
  | 'consent_accepted'
  | 'answer_recorded'
  | 'symptom_extraction'
  | 'red_flag_screening'
  | 'triage'
  | 'guideline_lookup'
  | 'contraindication_check'
  | 'interaction_check'
  | 'duplicate_check'
  | 'product_retrieval'
  | 'ranking'
  | 'response_composition'
  | 'safety_validation'
  | 'assessment_completed'
  | 'pharmacist_handoff'
  | 'pharmacist_review'
  | 'data_purged'

export interface AuditStageInput {
  consultationId: string
  stage: AuditStage
  summary: string
  payload?: Record<string, unknown> | null
  aiModel?: string | null
  latencyMs?: number | null
  actorId?: string | null
  actorLabel?: string | null
}

export async function logStage(input: AuditStageInput): Promise<void> {
  try {
    await prisma.consultationAuditEntry.create({
      data: {
        consultationId: input.consultationId,
        stage: input.stage,
        summary: input.summary.slice(0, 500),
        payload: (input.payload ?? undefined) as never,
        aiModel: input.aiModel ?? null,
        promptVersion: PROMPT_VERSION,
        rulesVersion: RULES_VERSION,
        latencyMs: input.latencyMs ?? null,
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel ?? null,
      },
    })
  } catch (error) {
    console.error('[consultation] audit write failed', input.stage, error)
  }
}

/** Times an async stage and records it in one call. */
export async function timedStage<T>(
  input: Omit<AuditStageInput, 'latencyMs' | 'summary'> & {
    summary: string | ((result: T) => string)
    payloadOf?: (result: T) => Record<string, unknown> | null
  },
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  const result = await run()
  await logStage({
    consultationId: input.consultationId,
    stage: input.stage,
    summary: typeof input.summary === 'function' ? input.summary(result) : input.summary,
    payload: input.payloadOf ? input.payloadOf(result) : input.payload,
    aiModel: input.aiModel,
    latencyMs: Date.now() - startedAt,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
  })
  return result
}
