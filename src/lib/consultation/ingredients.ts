import 'server-only'

import { prisma } from '../prisma'

/**
 * Resolves what a customer typed into a canonical active ingredient.
 *
 * This is the join between free text ("Панадол 500мг", "аспирин") and the rule
 * tables that key off ingredient codes. It is deliberately conservative:
 *
 *  • Only exact matches against a curated alias list or an ingredient's own
 *    names resolve. There is no fuzzy matching and no stemming.
 *  • Anything unresolved returns `null`, which the callers turn into an
 *    UNKNOWN interaction verdict and a pharmacist referral (§8, §17) — never
 *    into an assumption that the medicine is irrelevant.
 *
 * The alias table is small and changes rarely, so it is cached in process with
 * a short TTL rather than queried per lookup.
 */

export interface ResolvedIngredient {
  key: string
  name: string
  nameMn: string
  classKey: string | null
}

interface IngredientIndex {
  /** alias or ingredient name (normalised) → ingredient key */
  byName: Map<string, string>
  byKey: Map<string, ResolvedIngredient>
  at: number
}

let cache: IngredientIndex | null = null
const TTL_MS = 60_000

/**
 * Lowercases, drops punctuation, and strips strength and pack-size noise so
 * "Панадол 500 мг №20" and "панадол" hit the same alias.
 */
export function normaliseMedicationName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[«»"'`()[\]{},.;:!?/\\+]/g, ' ')
    .replace(/№\s*\d+/g, ' ')
    .replace(/\b\d+([.,]\d+)?\s*(mg|мг|g|г|ml|мл|mcg|мкг|iu|ме|%)\b/g, ' ')
    .replace(/\b(tab|tabs|tablet|tablets|шахмал|капсул|capsule|caps|syrup|сироп|suspension|тариа|injection)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadIndex(): Promise<IngredientIndex> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache

  const [ingredients, aliases] = await Promise.all([
    prisma.activeIngredient.findMany({
      select: { key: true, name: true, nameMn: true, nameRu: true, classKey: true },
    }),
    prisma.medicationAlias.findMany({ select: { alias: true, ingredientKey: true } }),
  ])

  const byName = new Map<string, string>()
  const byKey = new Map<string, ResolvedIngredient>()

  for (const row of ingredients) {
    byKey.set(row.key, {
      key: row.key,
      name: row.name,
      nameMn: row.nameMn,
      classKey: row.classKey,
    })
    for (const candidate of [row.key, row.name, row.nameMn, row.nameRu]) {
      if (!candidate) continue
      const normalised = normaliseMedicationName(candidate)
      if (normalised) byName.set(normalised, row.key)
    }
  }
  for (const row of aliases) {
    const normalised = normaliseMedicationName(row.alias)
    if (normalised) byName.set(normalised, row.ingredientKey)
  }

  cache = { byName, byKey, at: Date.now() }
  return cache
}

export function invalidateIngredientCache(): void {
  cache = null
}

/** Exact-match resolution. Returns null when the name is not recognised. */
export async function resolveIngredient(name: string): Promise<ResolvedIngredient | null> {
  const index = await loadIndex()
  const normalised = normaliseMedicationName(name)
  if (!normalised) return null

  const direct = index.byName.get(normalised)
  if (direct) return index.byKey.get(direct) ?? null

  // A single leading brand word is common ("панадол экстра"); try the first and
  // last token before giving up. Still exact matching — just on a token.
  const tokens = normalised.split(' ').filter((token) => token.length >= 4)
  for (const token of [tokens[0], tokens[tokens.length - 1]]) {
    if (!token) continue
    const hit = index.byName.get(token)
    if (hit) return index.byKey.get(hit) ?? null
  }
  return null
}

export interface ResolutionResult<T> {
  input: T
  ingredient: ResolvedIngredient | null
}

export async function resolveAll<T extends { name: string }>(
  entries: T[],
): Promise<ResolutionResult<T>[]> {
  const out: ResolutionResult<T>[] = []
  for (const entry of entries) {
    out.push({ input: entry, ingredient: await resolveIngredient(entry.name) })
  }
  return out
}

export async function ingredientByKey(key: string): Promise<ResolvedIngredient | null> {
  const index = await loadIndex()
  return index.byKey.get(key) ?? null
}

/**
 * Ingredients of the given catalogue products, keyed by product id. Used by the
 * duplicate-ingredient check and the interaction engine.
 */
export async function productIngredientMap(
  productIds: string[],
): Promise<Map<string, { key: string; name: string; strengthLabel: string | null }[]>> {
  if (productIds.length === 0) return new Map()

  const rows = await prisma.productIngredient.findMany({
    where: { productId: { in: productIds } },
    select: {
      productId: true,
      ingredientKey: true,
      strengthLabel: true,
      ingredient: { select: { name: true } },
    },
  })

  const map = new Map<string, { key: string; name: string; strengthLabel: string | null }[]>()
  for (const row of rows) {
    const list = map.get(row.productId) ?? []
    list.push({
      key: row.ingredientKey,
      name: row.ingredient.name,
      strengthLabel: row.strengthLabel,
    })
    map.set(row.productId, list)
  }
  return map
}

/**
 * Every ingredient the customer is already exposed to, from their declared
 * medication list. `unresolved` carries the names that could not be matched so
 * callers can degrade to "pharmacist verification required".
 */
export interface ExposureProfile {
  ingredientKeys: Set<string>
  classKeys: Set<string>
  unresolved: string[]
}

export async function buildExposure(
  medications: { name: string; ingredientKey?: string | null }[],
): Promise<ExposureProfile> {
  const index = await loadIndex()
  const ingredientKeys = new Set<string>()
  const classKeys = new Set<string>()
  const unresolved: string[] = []

  for (const medication of medications) {
    let key = medication.ingredientKey ?? null
    if (!key) {
      const resolved = await resolveIngredient(medication.name)
      key = resolved?.key ?? null
    }
    if (!key) {
      unresolved.push(medication.name)
      continue
    }
    ingredientKeys.add(key)
    const definition = index.byKey.get(key)
    if (definition?.classKey) classKeys.add(definition.classKey)
  }

  return { ingredientKeys, classKeys, unresolved }
}
