/**
 * Data-retention job for AI consultations (§28).
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/consultation-purge.ts
 *
 * Deletes the sensitive part of every consultation past its retention horizon —
 * free text, answers, medication and allergy lists — while keeping the
 * non-identifying assessment outcome and the AI audit trail so the pharmacy can
 * still audit and report on agent behaviour.
 *
 * Run it on a schedule (cron, or the platform's scheduler). It is idempotent:
 * an already-purged consultation is skipped via `purgedAt`.
 */
import { prisma } from '../src/lib/prisma'
import { getSettings } from '../src/lib/settings'
import { purgeExpiredConsultations, realignRetentionHorizons } from '../src/lib/consultation/retention'

async function main() {
  const settings = await getSettings()
  console.log(`\n🗄️   Consultation retention — policy: ${settings.consultationRetentionDays} days\n`)

  // Apply the current policy to rows created under an older one first, so a
  // shortened retention period takes effect immediately.
  const realigned = await realignRetentionHorizons()
  console.log(`  → ${realigned} retention horizon(s) realigned`)

  const summary = await purgeExpiredConsultations()
  console.log(`  → ${summary.scanned} due, ${summary.purged} purged`)

  if (summary.purged > 0) {
    console.log(`     ${summary.consultationIds.join(', ')}`)
  }

  console.log('\n✅  Retention pass complete\n')
}

main()
  .catch((error) => {
    console.error('Retention pass failed', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
