import 'server-only'

import type { Prisma } from '@prisma/client'

import { prisma } from './prisma'
import { mediaUrl } from './storage'
import { DEFAULT_LOCALE, type Locale } from './locale-types'
import { discountPercent, effectivePrice } from './utils'
import type { ProductQuery } from './validation'

/**
 * Catalogue read layer. Everything the storefront renders goes through here so
 * the sellability rules — active, not archived, in stock, not expired — are
 * applied in exactly one place.
 */

export const PRODUCT_CARD_SELECT = {
  id: true,
  slug: true,
  sku: true,
  name: true,
  price: true,
  discountPrice: true,
  prescriptionRequired: true,
  isFeatured: true,
  isNew: true,
  status: true,
  ratingAvg: true,
  ratingCount: true,
  soldCount: true,
  expiryDate: true,
  packageSize: true,
  strength: true,
  dosageForm: true,
  createdAt: true,
  category: { select: { id: true, slug: true, name: true, translations: true } },
  brand: { select: { id: true, slug: true, name: true } },
  images: { select: { fileKey: true, alt: true, isPrimary: true, sortOrder: true }, orderBy: { sortOrder: 'asc' as const } },
  translations: true,
  inventory: { select: { quantity: true, reserved: true, lowStockThreshold: true } },
} satisfies Prisma.ProductSelect

type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_CARD_SELECT }>

export interface ProductCard {
  id: string
  slug: string
  sku: string
  name: string
  shortDescription: string | null
  price: number
  discountPrice: number | null
  effectivePrice: number
  discountPercent: number | null
  prescriptionRequired: boolean
  isFeatured: boolean
  isNew: boolean
  rating: number
  ratingCount: number
  soldCount: number
  imageUrl: string | null
  imageAlt: string
  brandName: string | null
  brandSlug: string | null
  categoryName: string
  categorySlug: string
  stock: number
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
  isExpired: boolean
  packageSize: string | null
  strength: string | null
}

/** Only rows matching this are offered for sale anywhere on the storefront. */
export function sellableWhere(): Prisma.ProductWhereInput {
  return {
    deletedAt: null,
    status: 'ACTIVE',
    // Expired stock is never sellable. Products without a tracked expiry
    // (devices, cosmetics) are unaffected.
    OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
  }
}

export function pickTranslation<T extends { locale: string }>(
  translations: T[] | undefined,
  locale: Locale,
): T | undefined {
  if (!translations?.length) return undefined
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === DEFAULT_LOCALE) ??
    translations[0]
  )
}

export function toProductCard(row: ProductCardRow, locale: Locale): ProductCard {
  const translation = pickTranslation(row.translations, locale)
  const categoryTranslation = pickTranslation(row.category.translations, locale)
  const quantity = row.inventory?.quantity ?? 0
  const lowThreshold = row.inventory?.lowStockThreshold ?? 10
  const isExpired = Boolean(row.expiryDate && row.expiryDate.getTime() <= Date.now())
  const primary = row.images.find((i) => i.isPrimary) ?? row.images[0]
  const name = translation?.name?.trim() || row.name

  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name,
    shortDescription: translation?.shortDescription ?? null,
    price: row.price,
    discountPrice: row.discountPrice,
    effectivePrice: effectivePrice(row.price, row.discountPrice),
    discountPercent: discountPercent(row.price, row.discountPrice),
    prescriptionRequired: row.prescriptionRequired,
    isFeatured: row.isFeatured,
    isNew: row.isNew,
    rating: Number(row.ratingAvg.toFixed(1)),
    ratingCount: row.ratingCount,
    soldCount: row.soldCount,
    imageUrl: mediaUrl(primary?.fileKey),
    imageAlt: primary?.alt || name,
    brandName: row.brand?.name ?? null,
    brandSlug: row.brand?.slug ?? null,
    categoryName: categoryTranslation?.name?.trim() || row.category.name,
    categorySlug: row.category.slug,
    stock: quantity,
    stockStatus:
      isExpired || quantity <= 0 ? 'out_of_stock' : quantity <= lowThreshold ? 'low_stock' : 'in_stock',
    isExpired,
    packageSize: row.packageSize,
    strength: row.strength,
  }
}

// ───────────────────────────── list / search ──────────────────────────────

export interface ProductListResult {
  items: ProductCard[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

function orderBy(sort: ProductQuery['sort']): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ createdAt: 'desc' }]
    case 'price_asc':
      return [{ price: 'asc' }]
    case 'price_desc':
      return [{ price: 'desc' }]
    case 'name':
      return [{ name: 'asc' }]
    case 'rating':
      return [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }]
    case 'discount':
      // Rows with a discount first, biggest absolute saving leading.
      return [{ discountPrice: 'asc' }, { price: 'desc' }]
    case 'popular':
    default:
      return [{ soldCount: 'desc' }, { viewCount: 'desc' }, { createdAt: 'desc' }]
  }
}

export async function buildProductWhere(query: ProductQuery): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = [sellableWhere()]

  if (query.q) {
    const term = query.q.trim()
    and.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { barcode: { contains: term, mode: 'insensitive' } },
        { activeIngredientsIndex: { contains: term.toLowerCase() } },
        { strength: { contains: term, mode: 'insensitive' } },
        { brand: { name: { contains: term, mode: 'insensitive' } } },
        { category: { name: { contains: term, mode: 'insensitive' } } },
        { translations: { some: { name: { contains: term, mode: 'insensitive' } } } },
        { translations: { some: { activeIngredients: { contains: term, mode: 'insensitive' } } } },
      ],
    })
  }

  if (query.category) {
    // Include descendants so a parent category page shows the whole subtree.
    const category = await prisma.category.findFirst({
      where: { slug: query.category, deletedAt: null },
      select: { id: true, children: { select: { id: true } } },
    })
    if (category) {
      and.push({ categoryId: { in: [category.id, ...category.children.map((c) => c.id)] } })
    } else {
      and.push({ id: '__no_match__' })
    }
  }

  if (query.brand) {
    const slugs = query.brand.split(',').map((s) => s.trim()).filter(Boolean)
    if (slugs.length) and.push({ brand: { slug: { in: slugs } } })
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    and.push({
      price: {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      },
    })
  }

  if (query.inStock === '1' || query.inStock === 'true') {
    and.push({ inventory: { quantity: { gt: 0 } } })
  }

  if (query.prescription === 'rx') and.push({ prescriptionRequired: true })
  if (query.prescription === 'otc') and.push({ prescriptionRequired: false })

  if (query.discount === '1' || query.discount === 'true') {
    and.push({ discountPrice: { not: null } })
  }

  if (query.rating) and.push({ ratingAvg: { gte: query.rating } })
  if (query.featured === '1' || query.featured === 'true') and.push({ isFeatured: true })

  return { AND: and }
}

export async function listProducts(query: ProductQuery, locale: Locale): Promise<ProductListResult> {
  const where = await buildProductWhere(query)
  const page = query.page ?? 1
  const perPage = query.perPage ?? 24

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: PRODUCT_CARD_SELECT,
      orderBy: orderBy(query.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  let items = rows.map((row) => toProductCard(row, locale))

  // `discount` sorting needs the computed percentage, which the database does
  // not store; re-order the page in memory.
  if (query.sort === 'discount') {
    items = items.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
  }

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

/** Curated shelves used by the home page. */
export async function getShelf(
  kind: 'featured' | 'popular' | 'new' | 'discount' | 'category',
  options: { locale: Locale; take?: number; categorySlug?: string },
): Promise<ProductCard[]> {
  const take = options.take ?? 8
  const base = sellableWhere()

  const where: Prisma.ProductWhereInput =
    kind === 'featured'
      ? { AND: [base, { isFeatured: true }] }
      : kind === 'new'
        ? { AND: [base, { isNew: true }] }
        : kind === 'discount'
          ? { AND: [base, { discountPrice: { not: null } }] }
          : kind === 'category'
            ? { AND: [base, { category: { slug: options.categorySlug ?? '' } }] }
            : base

  const order: Prisma.ProductOrderByWithRelationInput[] =
    kind === 'new'
      ? [{ createdAt: 'desc' }]
      : kind === 'popular'
        ? [{ soldCount: 'desc' }, { ratingAvg: 'desc' }]
        : [{ isFeatured: 'desc' }, { soldCount: 'desc' }]

  const rows = await prisma.product.findMany({
    where,
    select: PRODUCT_CARD_SELECT,
    orderBy: order,
    take,
  })
  return rows.map((row) => toProductCard(row, options.locale))
}

/** Products from several category slugs, used for the themed home shelves. */
export async function getShelfByCategories(
  slugs: string[],
  locale: Locale,
  take = 8,
): Promise<ProductCard[]> {
  const rows = await prisma.product.findMany({
    where: { AND: [sellableWhere(), { category: { slug: { in: slugs } } }] },
    select: PRODUCT_CARD_SELECT,
    orderBy: [{ soldCount: 'desc' }, { ratingAvg: 'desc' }],
    take,
  })
  return rows.map((row) => toProductCard(row, locale))
}

// ───────────────────────────── detail page ────────────────────────────────

export interface ProductDetail extends ProductCard {
  barcode: string | null
  description: string | null
  ingredients: string | null
  activeIngredients: string | null
  dosage: string | null
  usage: string | null
  warnings: string | null
  sideEffects: string | null
  storage: string | null
  manufacturerName: string | null
  dosageForm: string | null
  registrationNo: string | null
  weightGrams: number | null
  expiryDate: string | null
  metaTitle: string | null
  metaDescription: string | null
  images: { url: string; alt: string }[]
  related: ProductCard[]
  reviews: {
    id: string
    rating: number
    title: string | null
    comment: string | null
    author: string
    isVerifiedBuyer: boolean
    createdAt: string
  }[]
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>
}

export async function getProductDetail(slug: string, locale: Locale): Promise<ProductDetail | null> {
  const row = await prisma.product.findFirst({
    where: { slug, deletedAt: null, status: { in: ['ACTIVE', 'INACTIVE'] } },
    include: {
      category: { include: { translations: true } },
      brand: true,
      manufacturer: true,
      images: { orderBy: { sortOrder: 'asc' } },
      translations: true,
      inventory: true,
      relatedFrom: {
        include: {
          related: { select: PRODUCT_CARD_SELECT },
        },
        orderBy: { sortOrder: 'asc' },
        take: 8,
      },
      reviews: {
        where: { status: 'APPROVED', deletedAt: null },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })
  if (!row) return null

  const card = toProductCard(row as unknown as ProductCardRow, locale)
  const translation = pickTranslation(row.translations, locale)

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
  for (const review of row.reviews) {
    const key = Math.min(5, Math.max(1, review.rating)) as 1 | 2 | 3 | 4 | 5
    ratingBreakdown[key] += 1
  }

  // Fall back to same-category products when no explicit relations are set.
  let related = row.relatedFrom
    .map((r) => toProductCard(r.related as unknown as ProductCardRow, locale))
    .filter((p) => p.stockStatus !== 'out_of_stock' || true)

  if (related.length < 4) {
    const fill = await prisma.product.findMany({
      where: {
        AND: [
          sellableWhere(),
          { categoryId: row.categoryId },
          { id: { notIn: [row.id, ...related.map((r) => r.id)] } },
        ],
      },
      select: PRODUCT_CARD_SELECT,
      orderBy: [{ soldCount: 'desc' }],
      take: 4 - related.length,
    })
    related = [...related, ...fill.map((f) => toProductCard(f, locale))]
  }

  return {
    ...card,
    barcode: row.barcode,
    description: translation?.description ?? null,
    ingredients: translation?.ingredients ?? null,
    activeIngredients: translation?.activeIngredients ?? null,
    dosage: translation?.dosage ?? null,
    usage: translation?.usage ?? null,
    warnings: translation?.warnings ?? null,
    sideEffects: translation?.sideEffects ?? null,
    storage: translation?.storage ?? null,
    manufacturerName: row.manufacturer?.name ?? null,
    dosageForm: row.dosageForm,
    registrationNo: row.registrationNo,
    weightGrams: row.weightGrams,
    expiryDate: row.expiryDate ? row.expiryDate.toISOString() : null,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    images: row.images.length
      ? row.images.map((i) => ({ url: mediaUrl(i.fileKey) ?? '', alt: i.alt || card.name }))
      : [],
    related,
    reviews: row.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      author: r.user.fullName,
      isVerifiedBuyer: r.isVerifiedBuyer,
      createdAt: r.createdAt.toISOString(),
    })),
    ratingBreakdown,
  }
}

/** Fire-and-forget view counter — never blocks the render. */
export function bumpViewCount(productId: string): void {
  prisma.product
    .update({ where: { id: productId }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined)
}

// ───────────────────────────── taxonomy ───────────────────────────────────

export interface CategoryNode {
  id: string
  slug: string
  name: string
  icon: string | null
  imageUrl: string | null
  productCount: number
  children: CategoryNode[]
}

export async function getCategoryTree(locale: Locale, onlyActive = true): Promise<CategoryNode[]> {
  const rows = await prisma.category.findMany({
    where: { deletedAt: null, ...(onlyActive ? { isActive: true } : {}) },
    include: {
      translations: true,
      _count: { select: { products: { where: sellableWhere() } } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const byId = new Map<string, CategoryNode & { parentId: string | null }>()
  for (const row of rows) {
    const translation = pickTranslation(row.translations, locale)
    byId.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: translation?.name?.trim() || row.name,
      icon: row.icon,
      imageUrl: mediaUrl(row.imageKey),
      productCount: row._count.products,
      children: [],
      parentId: row.parentId,
    })
  }

  const roots: CategoryNode[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Parent counts include the subtree so a parent chip is never "0 products".
  const rollUp = (node: CategoryNode): number => {
    const childTotal = node.children.reduce((sum, child) => sum + rollUp(child), 0)
    node.productCount += childTotal
    return node.productCount
  }
  roots.forEach(rollUp)

  return roots
}

export async function getBrandOptions(): Promise<{ slug: string; name: string; count: number }[]> {
  const rows = await prisma.brand.findMany({
    where: { deletedAt: null, isActive: true },
    include: { _count: { select: { products: { where: sellableWhere() } } } },
    orderBy: { name: 'asc' },
  })
  return rows
    .map((b) => ({ slug: b.slug, name: b.name, count: b._count.products }))
    .filter((b) => b.count > 0)
}

export async function getPriceBounds(): Promise<{ min: number; max: number }> {
  const agg = await prisma.product.aggregate({
    where: sellableWhere(),
    _min: { price: true },
    _max: { price: true },
  })
  return { min: agg._min.price ?? 0, max: agg._max.price ?? 500_000 }
}

/** Lightweight autocomplete used by the header search and the chatbot. */
export async function quickSearch(term: string, locale: Locale, take = 6): Promise<ProductCard[]> {
  if (!term.trim()) return []
  const where = await buildProductWhere({ q: term })
  const rows = await prisma.product.findMany({
    where,
    select: PRODUCT_CARD_SELECT,
    orderBy: [{ soldCount: 'desc' }, { ratingAvg: 'desc' }],
    take,
  })
  return rows.map((row) => toProductCard(row, locale))
}
