import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { productUpdateSchema } from '@/lib/validation'
import { audit, diffChanges } from '@/lib/audit'
import { applyStockMovement } from '@/lib/inventory'
import { mediaUrl } from '@/lib/storage'

/** Full record for the admin edit form. */
export const GET = route<unknown, { id: string }>({
  auth: { permission: 'products.view' },
  async handler({ params }) {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        translations: true,
        inventory: true,
        batches: { orderBy: { expiryDate: 'asc' } },
        relatedFrom: { include: { related: { select: { id: true, name: true, sku: true } } } },
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        manufacturer: { select: { id: true, name: true } },
        _count: { select: { orderItems: true, reviews: true } },
      },
    })
    if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found')

    return ok({
      product: {
        ...product,
        images: product.images.map((image) => ({ ...image, url: mediaUrl(image.fileKey) })),
      },
    })
  },
})

export const PUT = route<Record<string, unknown>, { id: string }>({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: productUpdateSchema as any,
  auth: { permission: 'products.update' },
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof productUpdateSchema>

    const current = await prisma.product.findUnique({
      where: { id: params.id },
      include: { inventory: true },
    })
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Product not found')

    if (data.sku !== current.sku) {
      const taken = await prisma.product.findUnique({ where: { sku: data.sku } })
      if (taken) throw new ApiError(409, 'SKU_TAKEN', 'A product with this SKU already exists')
    }
    if (data.barcode && data.barcode !== current.barcode) {
      const taken = await prisma.product.findUnique({ where: { barcode: data.barcode } })
      if (taken) throw new ApiError(409, 'BARCODE_TAKEN', 'A product with this barcode already exists')
    }

    const activeIngredients = Object.values(data.translations ?? {})
      .map((t) => t?.activeIngredients)
      .filter(Boolean)
      .join(', ')
      .toLowerCase()

    const updated = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: params.id },
        data: {
          sku: data.sku,
          barcode: data.barcode ?? null,
          name: data.name,
          slug: data.slug || current.slug,
          categoryId: data.categoryId,
          brandId: data.brandId ?? null,
          manufacturerId: data.manufacturerId ?? null,
          prescriptionRequired: data.prescriptionRequired,
          isControlled: data.isControlled,
          price: data.price,
          discountPrice: data.discountPrice ?? null,
          costPrice: data.costPrice ?? null,
          taxRatePct: data.taxRatePct,
          status: data.status,
          isFeatured: data.isFeatured,
          isNew: data.isNew,
          weightGrams: data.weightGrams ?? null,
          packageSize: data.packageSize ?? null,
          dosageForm: data.dosageForm ?? null,
          strength: data.strength ?? null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          registrationNo: data.registrationNo ?? null,
          activeIngredientsIndex: activeIngredients || null,
          metaTitle: data.metaTitle ?? null,
          metaDescription: data.metaDescription ?? null,
        },
      })

      // Images and translations are replaced wholesale — the form always posts
      // the complete set.
      await tx.productImage.deleteMany({ where: { productId: params.id } })
      if (data.images?.length) {
        await tx.productImage.createMany({
          data: data.images.map((image, index) => ({
            productId: params.id,
            fileKey: image.fileKey,
            alt: image.alt ?? null,
            sortOrder: index,
            isPrimary: index === 0,
          })),
        })
      }

      for (const [locale, value] of Object.entries(data.translations ?? {})) {
        if (!value || !Object.values(value).some(Boolean)) continue
        await tx.productTranslation.upsert({
          where: { productId_locale: { productId: params.id, locale: locale as 'mn' | 'en' | 'ru' } },
          create: {
            productId: params.id,
            locale: locale as 'mn' | 'en' | 'ru',
            name: value.name?.trim() || data.name,
            shortDescription: value.shortDescription ?? null,
            description: value.description ?? null,
            ingredients: value.ingredients ?? null,
            activeIngredients: value.activeIngredients ?? null,
            dosage: value.dosage ?? null,
            usage: value.usage ?? null,
            warnings: value.warnings ?? null,
            sideEffects: value.sideEffects ?? null,
            storage: value.storage ?? null,
          },
          update: {
            name: value.name?.trim() || data.name,
            shortDescription: value.shortDescription ?? null,
            description: value.description ?? null,
            ingredients: value.ingredients ?? null,
            activeIngredients: value.activeIngredients ?? null,
            dosage: value.dosage ?? null,
            usage: value.usage ?? null,
            warnings: value.warnings ?? null,
            sideEffects: value.sideEffects ?? null,
            storage: value.storage ?? null,
          },
        })
      }

      await tx.relatedProduct.deleteMany({ where: { productId: params.id } })
      if (data.relatedProductIds?.length) {
        await tx.relatedProduct.createMany({
          data: data.relatedProductIds
            .filter((relatedId) => relatedId !== params.id)
            .map((relatedId, index) => ({ productId: params.id, relatedId, sortOrder: index })),
          skipDuplicates: true,
        })
      }

      await tx.inventory.upsert({
        where: { productId: params.id },
        create: {
          productId: params.id,
          quantity: 0,
          lowStockThreshold: data.lowStockThreshold,
          shelfLocation: data.shelfLocation ?? null,
        },
        update: {
          lowStockThreshold: data.lowStockThreshold,
          shelfLocation: data.shelfLocation ?? null,
        },
      })

      // Stock is only moved when the figure actually differs, and always via
      // the ledger so the change is attributable.
      const currentQuantity = current.inventory?.quantity ?? 0
      if (data.stockQuantity !== currentQuantity) {
        const delta = data.stockQuantity - currentQuantity
        await applyStockMovement(tx, {
          productId: params.id,
          type: 'ADJUSTMENT',
          quantity: Math.abs(delta),
          reason: `Бүтээгдэхүүний форм: ${currentQuantity} → ${data.stockQuantity}`,
          performedById: session!.id,
          allowNegative: false,
        })
        if (delta < 0) {
          await tx.inventory.update({
            where: { productId: params.id },
            data: { quantity: data.stockQuantity },
          })
        }
      }

      return product
    })

    await audit({
      actor: session,
      action: 'product.update',
      entity: 'Product',
      entityId: params.id,
      summary: `${updated.name} (${updated.sku})`,
      changes: diffChanges(
        current as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      ),
      request,
    })

    return ok({ product: { id: updated.id, slug: updated.slug } })
  },
})

/**
 * Soft-delete: a product referenced by an order is archived rather than
 * removed, so historical invoices stay intact.
 */
export const DELETE = route<unknown, { id: string }>({
  auth: { permission: 'products.delete' },
  async handler({ params, session, request }) {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: { _count: { select: { orderItems: true } } },
    })
    if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found')

    const hasHistory = product._count.orderItems > 0

    await prisma.product.update({
      where: { id: params.id },
      data: hasHistory
        ? { status: 'ARCHIVED', isFeatured: false, deletedAt: new Date() }
        : { deletedAt: new Date(), status: 'ARCHIVED' },
    })

    // Never leave an archived product sitting in someone's cart.
    await prisma.cartItem.deleteMany({ where: { productId: params.id } })

    await audit({
      actor: session,
      action: hasHistory ? 'product.archive' : 'product.delete',
      entity: 'Product',
      entityId: params.id,
      summary: `${product.name} (${product.sku})${hasHistory ? ' — archived, order history exists' : ''}`,
      request,
    })

    return ok({ archived: hasHistory, deleted: true })
  },
})
