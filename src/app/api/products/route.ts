import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { listProducts } from '@/lib/products'
import { productQuerySchema, productSchema } from '@/lib/validation'
import { coerceLocale } from '@/lib/locale-types'
import { slugify } from '@/lib/utils'
import { audit } from '@/lib/audit'
import { applyStockMovement } from '@/lib/inventory'
import { trackEvent } from '@/lib/analytics'

/** Public catalogue listing with the full filter/sort/pagination surface. */
export const GET = route({
  auth: 'public',
  rateLimit: 'search',
  async handler({ query, session }) {
    const parsed = productQuerySchema.parse(Object.fromEntries(query.entries()))
    const locale = coerceLocale(query.get('locale'))
    const result = await listProducts(parsed, locale)

    if (parsed.q) {
      void trackEvent({
        name: 'search_performed',
        userId: session?.id ?? null,
        metadata: { term: parsed.q, results: result.total },
      })
    }

    return ok(result)
  },
})

/** Admin product creation. */
export const POST = route({
  auth: { permission: 'products.create' },
  schema: productSchema,
  async handler({ body, session, request }) {
    const existing = await prisma.product.findUnique({ where: { sku: body.sku } })
    if (existing) throw new ApiError(409, 'SKU_TAKEN', 'A product with this SKU already exists')

    if (body.barcode) {
      const barcodeTaken = await prisma.product.findUnique({ where: { barcode: body.barcode } })
      if (barcodeTaken) throw new ApiError(409, 'BARCODE_TAKEN', 'A product with this barcode already exists')
    }

    const slug = await uniqueSlug(body.slug || slugify(body.name) || body.sku.toLowerCase())

    const activeIngredients = Object.values(body.translations ?? {})
      .map((t) => t?.activeIngredients)
      .filter(Boolean)
      .join(', ')
      .toLowerCase()

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: body.sku,
          barcode: body.barcode ?? null,
          slug,
          name: body.name,
          categoryId: body.categoryId,
          brandId: body.brandId ?? null,
          manufacturerId: body.manufacturerId ?? null,
          prescriptionRequired: body.prescriptionRequired,
          isControlled: body.isControlled,
          price: body.price,
          discountPrice: body.discountPrice ?? null,
          costPrice: body.costPrice ?? null,
          taxRatePct: body.taxRatePct,
          status: body.status,
          isFeatured: body.isFeatured,
          isNew: body.isNew,
          weightGrams: body.weightGrams ?? null,
          packageSize: body.packageSize ?? null,
          dosageForm: body.dosageForm ?? null,
          strength: body.strength ?? null,
          expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
          registrationNo: body.registrationNo ?? null,
          activeIngredientsIndex: activeIngredients || null,
          metaTitle: body.metaTitle ?? null,
          metaDescription: body.metaDescription ?? null,
          images: {
            create: (body.images ?? []).map((image, index) => ({
              fileKey: image.fileKey,
              alt: image.alt ?? null,
              sortOrder: index,
              isPrimary: index === 0,
            })),
          },
          translations: {
            create: Object.entries(body.translations ?? {})
              .filter(([, value]) => value && Object.values(value).some(Boolean))
              .map(([locale, value]) => ({
                locale: locale as 'mn' | 'en' | 'ru',
                name: value!.name?.trim() || body.name,
                shortDescription: value!.shortDescription ?? null,
                description: value!.description ?? null,
                ingredients: value!.ingredients ?? null,
                activeIngredients: value!.activeIngredients ?? null,
                dosage: value!.dosage ?? null,
                usage: value!.usage ?? null,
                warnings: value!.warnings ?? null,
                sideEffects: value!.sideEffects ?? null,
                storage: value!.storage ?? null,
              })),
          },
          inventory: {
            create: {
              quantity: 0,
              lowStockThreshold: body.lowStockThreshold,
              shelfLocation: body.shelfLocation ?? null,
            },
          },
          relatedFrom: {
            create: (body.relatedProductIds ?? []).map((relatedId, index) => ({
              relatedId,
              sortOrder: index,
            })),
          },
        },
      })

      // Opening stock goes through the ledger so the history starts complete.
      if (body.stockQuantity > 0) {
        await applyStockMovement(tx, {
          productId: created.id,
          type: 'STOCK_IN',
          quantity: body.stockQuantity,
          reason: 'Нээлтийн нөөц',
          performedById: session!.id,
        })
      }

      return created
    })

    await audit({
      actor: session,
      action: 'product.create',
      entity: 'Product',
      entityId: product.id,
      summary: `${product.name} (${product.sku})`,
      request,
    })

    return ok({ product: { id: product.id, slug: product.slug } }, { status: 201 })
  },
})

async function uniqueSlug(base: string): Promise<string> {
  const candidate = base || 'product'
  const existing = await prisma.product.findUnique({ where: { slug: candidate } })
  if (!existing) return candidate
  for (let suffix = 2; suffix < 200; suffix += 1) {
    const next = `${candidate}-${suffix}`
    // eslint-disable-next-line no-await-in-loop
    const taken = await prisma.product.findUnique({ where: { slug: next } })
    if (!taken) return next
  }
  return `${candidate}-${Date.now()}`
}
