/**
 * Barrel for the AI consultation domain.
 *
 * `types.ts` and `responses.ts` are dependency-free and safe to import from
 * Client Components. Everything re-exported below `// server` is `server-only`
 * and will fail the build if a browser bundle reaches for it — which is the
 * point: no safety engine should ever be reachable from the client.
 */

export * from './types'

// server
export { runAssessment, loadStoredResult, projectResult, type AssessmentResult } from './engine'
export {
  acceptDisclaimer,
  buildWireState,
  createConsultation,
  disclaimerText,
  DISCLAIMER_VERSION,
  loadById,
  loadBySessionKey,
  markAbandoned,
  recordAnswer,
  reload,
  toAnswerState,
  type ConsultationRecord,
} from './session'
export {
  authorise,
  clearConsultationCookie,
  readConsultationCookie,
  requireAnswerAccess,
  requireReviewAccess,
  setConsultationCookie,
  type AccessGrant,
} from './access'
export {
  buildHandoffPacket,
  handoffToPharmacist,
  isLockedByPharmacist,
  recordReview,
  type HandoffPacket,
  type ReviewAction,
} from './pharmacist'
export { findByBarcode, searchStockedMedicines } from './retrieval'
export { purgeExpiredConsultations, realignRetentionHorizons } from './retention'
export { isLlmConfigured, PROMPT_VERSION } from './llm'
export { RULES_VERSION } from './audit'
export { QUESTIONNAIRE_VERSION } from './questionnaire'
