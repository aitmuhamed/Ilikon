import 'server-only'

import { prisma } from './prisma'
import {
  DEFAULT_SETTINGS,
  SETTING_GROUPS,
  type PharmacySettings,
} from './settings-defaults'

/**
 * Database-backed pharmacy settings.
 *
 * The shape and defaults live in `settings-defaults.ts` so tooling (the seed
 * script in particular) can read them without a database client. Secrets are
 * never stored here — see `env.ts`.
 */

let cache: { value: PharmacySettings; at: number } | null = null
const TTL_MS = 30_000

export async function getSettings(): Promise<PharmacySettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value

  const rows = await prisma.setting.findMany().catch(() => [])
  const merged = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    if (row.key in merged) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(merged as any)[row.key] = row.value
    }
  }
  cache = { value: merged, at: Date.now() }
  return merged
}

export async function updateSettings(patch: Partial<PharmacySettings>): Promise<PharmacySettings> {
  const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS)
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: {
          key,
          value: value as never,
          group: SETTING_GROUPS[key as keyof PharmacySettings] ?? 'general',
        },
        update: { value: value as never },
      }),
    ),
  )
  cache = null
  return getSettings()
}

export function invalidateSettingsCache() {
  cache = null
}

export {
  DEFAULT_SETTINGS,
  SETTING_GROUPS,
  SAFETY_CRITICAL_SETTINGS,
  localizedAddress,
  localizedGreeting,
  localizedDisclaimer,
} from './settings-defaults'
export type { PharmacySettings } from './settings-defaults'
