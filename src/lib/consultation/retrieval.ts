import 'server-only'

import type { Prisma } from '@prisma/client'

import { prisma } from '../prisma'
import { mediaUrl } from '../storage'
import { pickTranslation, sellableWhere } from '../products'
import { effectivePrice } from '../utils'
import type { Locale } from '../locale-types'
import { tr, type LocalizedText } from './types'

/**
 * Pharmacy product retrieval for the consultation engine (§12, §13).
 *
 * The engine never searches the internet and never generates a product. Every
 * candidate is a live catalogue row, and the query itself enforces the hard
 * exclusions so a downstream bug cannot leak a forbidden product:
 *
 *   • prescription-only products are excluded at the database level (§26);
 *   • only sellable rows (active, not archived, unexpired) are eligible;
 *   • only products inside the pharmacist-approved guideline scope
 *     (categories + active ingredients) are eligible;
 *   • out-of-stock and admin-blocked products are excluded;
 *   • products whose remaining shelf life is too short are excluded.
 */

export interface GuidelineRecord {
  id: string
  key: string
  symptomCode: string
  title: string
  categorySlugs: string[]
  ingredientKeys: string[]
  minAgeYears: number | null
  maxSelfCareDays: number
  rationale: LocalizedText
  precaution: LocalizedText | null
  pregnancyNeedsPharmacist: boolean
  sourceId: string | null
  sourceLabel: string | null
}

/** The approved self-care guideline for a symptom, or null when none exists. */
export async function loadGuideline(
  symptomCode: string | null | undefined,
): Promise<GuidelineRecord | null> {
  if (!symptomCode) return null

  const row = await prisma.otcGuideline.findFirst({
    where: { symptomCode, isActive: true },
    orderBy: { createdAt: 'asc' },
    include: {
      source: { select: { id: true, title: true, version: true, sourceType: true, isActive: true } },
    },
  })
  if (!row) return null

  return {
    id: row.id,
    key: row.key,
    symptomCode: row.symptomCode,
    title: row.title,
    categorySlugs: row.categorySlugs,
    ingredientKeys: row.ingredientKeys,
    minAgeYears: row.minAgeYears,
    maxSelfCareDays: row.maxSelfCareDays,
    rationale: { mn: row.rationaleMn, en: row.rationaleEn, ru: row.rationaleRu },
    precaution:
      row.precautionMn || row.precautionEn || row.precautionRu
        ? {
            mn: row.precautionMn ?? '',
            en: row.precautionEn ?? '',
            ru: row.precautionRu ?? '',
          }
        : null,
    pregnancyNeedsPharmacist: row.pregnancyNeedsPharmacist,
    sourceId: row.source?.isActive ? row.source.id : null,
    sourceLabel: row.source?.isActive ? `${row.source.title} (v${row.source.version})` : null,
  }
}

export interface CandidateProduct {
  id: string
  slug: string
  name: string
  categoryName: string
  categorySlug: string
  price: number
  imageKey: string | null
  imageUrl: string | null
  dosageForm: string | null
  strength: string | null
  packageSize: string | null
  activeIngredientsText: string | null
  ingredientKeys: string[]
  ingredientNames: string[]
  stock: number
  soldCount: number
  ratingAvg: number
  expiryDate: Date | null
  /** Verified label text, when the pharmacy stores it for this product. */
  usage: string | null
  warnings: string | null
}

const CANDIDATE_SELECT = {
  id: true,
  slug: true,
  name: true,
  price: true,
  discountPrice: true,
  dosageForm: true,
  strength: true,
  packageSize: true,
  activeIngredientsIndex: true,
  soldCount: true,
  ratingAvg: true,
  expiryDate: true,
  category: { select: { slug: true, name: true, translations: true } },
  images: {
    select: { fileKey: true, isPrimary: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  translations: true,
  inventory: { select: { quantity: true, reserved: true } },
  ingredients: {
    select: { ingredientKey: true, strengthLabel: true, ingredient: { select: { name: true } } },
  },
} satisfies Prisma.ProductSelect

export interface RetrievalOptions {
  guideline: GuidelineRecord
  locale: Locale
  /** Category allow-list from admin configuration; empty means "no extra limit". */
  allowedCategorySlugs: string[]
  blockedProductIds: string[]
  /** Minimum remaining shelf life for a product to be suggested. */
  minExpiryDays: number
  take?: number
}

/**
 * Candidate products inside the guideline's scope. Ranking and safety filtering
 * happen afterwards — this returns everything that is *eligible*, not what will
 * be shown.
 */
export async function findCandidates(options: RetrievalOptions): Promise<CandidateProduct[]> {
  const { guideline } = options

  const scope: Prisma.ProductWhereInput[] = []
  if (guideline.categorySlugs.length > 0) {
    scope.push({ category: { slug: { in: guideline.categorySlugs } } })
  }
  if (guideline.ingredientKeys.length > 0) {
    scope.push({ ingredients: { some: { ingredientKey: { in: guideline.ingredientKeys } } } })
  }
  // A guideline with no scope at all must not match the whole catalogue.
  if (scope.length === 0) return []

  const minExpiry = new Date(Date.now() + options.minExpiryDays * 24 * 60 * 60 * 1000)

  const where: Prisma.ProductWhereInput = {
    ...sellableWhere(),
    // Hard exclusions — enforced by the query, not by later filtering.
    prescriptionRequired: false,
    isControlled: false,
    OR: scope,
    inventory: { quantity: { gt: 0 } },
    AND: [
      { OR: [{ expiryDate: null }, { expiryDate: { gt: minExpiry } }] },
      ...(options.allowedCategorySlugs.length > 0
        ? [{ category: { slug: { in: options.allowedCategorySlugs } } } as Prisma.ProductWhereInput]
        : []),
      ...(options.blockedProductIds.length > 0
        ? [{ id: { notIn: options.blockedProductIds } } as Prisma.ProductWhereInput]
        : []),
    ],
  }

  const rows = await prisma.product.findMany({
    where,
    select: CANDIDATE_SELECT,
    // Ordering here is only to bound the candidate set deterministically; the
    // clinical ranking in `ranking.ts` decides what is actually shown.
    orderBy: [{ soldCount: 'desc' }, { name: 'asc' }],
    take: options.take ?? 40,
  })

  return rows.map((row) => {
    const translation = pickTranslation(row.translations, options.locale)
    const categoryTranslation = pickTranslation(row.category.translations, options.locale)
    const primary = row.images.find((image) => image.isPrimary) ?? row.images[0]

    return {
      id: row.id,
      slug: row.slug,
      name: translation?.name?.trim() || row.name,
      categoryName: categoryTranslation?.name?.trim() || row.category.name,
      categorySlug: row.category.slug,
      price: effectivePrice(row.price, row.discountPrice),
      imageKey: primary?.fileKey ?? null,
      imageUrl: primary ? mediaUrl(primary.fileKey) : null,
      dosageForm: row.dosageForm,
      strength: row.strength,
      packageSize: row.packageSize,
      activeIngredientsText:
        translation?.activeIngredients?.trim() ||
        row.ingredients.map((i) => i.ingredient.name).join(', ') ||
        row.activeIngredientsIndex,
      ingredientKeys: row.ingredients.map((i) => i.ingredientKey),
      ingredientNames: row.ingredients.map((i) => i.ingredient.name),
      stock: Math.max(0, (row.inventory?.quantity ?? 0) - (row.inventory?.reserved ?? 0)),
      soldCount: row.soldCount,
      ratingAvg: row.ratingAvg,
      expiryDate: row.expiryDate,
      usage: translation?.usage?.trim() || null,
      warnings: translation?.warnings?.trim() || null,
    }
  })
}

/** The guideline rationale in the customer's language. */
export function guidelineRationale(guideline: GuidelineRecord, locale: string): string {
  return tr(guideline.rationale, locale)
}

export function guidelinePrecaution(guideline: GuidelineRecord, locale: string): string | null {
  if (!guideline.precaution) return null
  const text = tr(guideline.precaution, locale)
  return text.trim() ? text : null
}

/**
 * Products matching a name the customer typed, restricted to what the pharmacy
 * actually stocks. Used by the "what are you already taking" search box.
 */
export async function searchStockedMedicines(
  term: string,
  locale: Locale,
  take = 8,
): Promise<{ id: string; name: string; strength: string | null; packageSize: string | null }[]> {
  const trimmed = term.trim()
  if (trimmed.length < 2) return []

  const rows = await prisma.product.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      OR: [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { activeIngredientsIndex: { contains: trimmed.toLowerCase() } },
        { translations: { some: { name: { contains: trimmed, mode: 'insensitive' } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      strength: true,
      packageSize: true,
      translations: true,
    },
    take,
    orderBy: { soldCount: 'desc' },
  })

  return rows.map((row) => ({
    id: row.id,
    name: pickTranslation(row.translations, locale)?.name?.trim() || row.name,
    strength: row.strength,
    packageSize: row.packageSize,
  }))
}

/** Looks up a stocked product by barcode for the barcode-scan entry path. */
export async function findByBarcode(
  barcode: string,
  locale: Locale,
): Promise<{ id: string; name: string; strength: string | null } | null> {
  const trimmed = barcode.trim()
  if (!trimmed) return null

  const row = await prisma.product.findFirst({
    where: { barcode: trimmed, deletedAt: null },
    select: { id: true, name: true, strength: true, translations: true },
  })
  if (!row) return null

  return {
    id: row.id,
    name: pickTranslation(row.translations, locale)?.name?.trim() || row.name,
    strength: row.strength,
  }
}
