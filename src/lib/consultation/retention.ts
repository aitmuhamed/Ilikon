import 'server-only'

import { prisma } from '../prisma'
import { getSettings } from '../settings'
import { logStage } from './audit'

/**
 * Data retention for consultations (§28).
 *
 * The rule is "minimise, do not erase": the sensitive part of a consultation —
 * the free text, the answers, the medication and allergy lists — is deleted
 * once the retention window passes, while the non-identifying assessment
 * outcome and the AI audit trail are kept so the pharmacy can still audit how
 * the agent behaved and report on it.
 *
 * `purgedAt` records that this happened, so a gap in the answers is
 * distinguishable from a consultation that never had them.
 */

export interface PurgeSummary {
  scanned: number
  purged: number
  consultationIds: string[]
}

export async function purgeExpiredConsultations(now = new Date()): Promise<PurgeSummary> {
  const due = await prisma.consultation.findMany({
    where: { expiresAt: { lte: now }, purgedAt: null },
    select: { id: true, code: true },
    take: 500,
  })

  const purged: string[] = []

  for (const consultation of due) {
    try {
      await prisma.$transaction([
        prisma.consultationAnswer.deleteMany({ where: { consultationId: consultation.id } }),
        prisma.consultationAllergy.deleteMany({ where: { consultationId: consultation.id } }),
        prisma.consultationMedication.deleteMany({ where: { consultationId: consultation.id } }),
        prisma.consultationCondition.deleteMany({ where: { consultationId: consultation.id } }),
        // Red flag rows are kept for reporting, but the customer's own words go.
        prisma.consultationRedFlag.updateMany({
          where: { consultationId: consultation.id },
          data: { evidence: null },
        }),
        prisma.consultation.update({
          where: { id: consultation.id },
          data: {
            symptomFreeText: null,
            aiUnderstood: null,
            purgedAt: now,
            // Detach the customer so the remaining row is statistical only.
            userId: null,
          },
        }),
      ])
      purged.push(consultation.id)
      await logStage({
        consultationId: consultation.id,
        stage: 'data_purged',
        summary: `Health answers purged under the ${'retention'} policy`,
      })
    } catch (error) {
      console.error('[consultation] purge failed', consultation.code, error)
    }
  }

  return { scanned: due.length, purged: purged.length, consultationIds: purged }
}

/**
 * Recomputes `expiresAt` for consultations created before the retention setting
 * was last changed, so a shortened policy applies to existing rows too.
 */
export async function realignRetentionHorizons(): Promise<number> {
  const settings = await getSettings()
  const days = Math.max(1, settings.consultationRetentionDays)

  const rows = await prisma.consultation.findMany({
    where: { purgedAt: null },
    select: { id: true, createdAt: true, expiresAt: true },
    take: 2000,
  })

  let updated = 0
  for (const row of rows) {
    const target = new Date(row.createdAt.getTime() + days * 24 * 60 * 60 * 1000)
    if (row.expiresAt && Math.abs(row.expiresAt.getTime() - target.getTime()) < 60_000) continue
    await prisma.consultation.update({ where: { id: row.id }, data: { expiresAt: target } })
    updated += 1
  }
  return updated
}
