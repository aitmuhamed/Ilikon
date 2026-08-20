import { prisma } from '@/lib/prisma'
import { ApiError, ok, pageMeta, readPagination, route } from '@/lib/api'
import { inventoryAdjustSchema, inventoryThresholdSchema } from '@/lib/validation'
import { StockError, adjustStock, getInventoryAlerts } from '@/lib/inventory'
import { audit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'

/** Stock list with the low-stock / expiry view the admin screen needs. */
export const GET = route({
  auth: { permission: 'inventory.view' },
  async handler({ query }) {
    const pagination = readPagination(query, 25, 100)
    const filter = query.get('filter') ?? 'all'
    const search = (query.get('q') ?? '').trim()
    const settings = await getSettings()

    if (filter === 'alerts') {
      return ok({ alerts: await getInventoryAlerts() })
    }

    const now = new Date()
    const horizon = new Date(now.getTime() + settings.expiryWarningDays * 86_400_000)

    const where = {
      deletedAt: null,
      status: { not: 'ARCHIVED' as const },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
              { barcode: { contains: search } },
            ],
          }
        : {}),
      ...(filter === 'expiring' ? { expiryDate: { gt: now, lte: horizon } } : {}),
      ...(filter === 'expired' ? { expiryDate: { lte: now } } : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          price: true,
          expiryDate: true,
          status: true,
          prescriptionRequired: true,
          category: { select: { name: true } },
          inventory: true,
          batches: { orderBy: { expiryDate: 'asc' }, take: 5 },
        },
        orderBy: filter === 'low' ? { name: 'asc' } : { updatedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    const items = rows
      .map((row) => {
        const quantity = row.inventory?.quantity ?? 0
        const threshold = row.inventory?.lowStockThreshold || settings.lowStockThreshold
        const daysToExpiry = row.expiryDate
          ? Math.ceil((row.expiryDate.getTime() - now.getTime()) / 86_400_000)
          : null
        return {
          id: row.id,
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          categoryName: row.category.name,
          price: row.price,
          status: row.status,
          prescriptionRequired: row.prescriptionRequired,
          quantity,
          reserved: row.inventory?.reserved ?? 0,
          lowStockThreshold: threshold,
          shelfLocation: row.inventory?.shelfLocation ?? null,
          expiryDate: row.expiryDate,
          daysToExpiry,
          isLowStock: quantity <= threshold,
          isExpired: daysToExpiry !== null && daysToExpiry <= 0,
          isExpiringSoon:
            daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= settings.expiryWarningDays,
          batches: row.batches,
        }
      })
      .filter((item) => (filter === 'low' ? item.isLowStock : true))

    return ok({ items, meta: pageMeta(pagination, total) })
  },
})

/** Stock movement. Every call lands in the inventory ledger. */
export const POST = route({
  auth: { permission: 'inventory.adjust' },
  schema: inventoryAdjustSchema,
  async handler({ body, session, request }) {
    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { id: true, name: true, sku: true },
    })
    if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found')

    try {
      const result = await adjustStock({
        productId: body.productId,
        type: body.type,
        quantity: body.quantity,
        reason: body.reason,
        reference: body.reference,
        performedById: session!.id,
      })

      await audit({
        actor: session,
        action: 'inventory.adjust',
        entity: 'Product',
        entityId: body.productId,
        summary: `${product.sku}: ${body.type} ${body.quantity} → ${result.balanceAfter}`,
        changes: { reason: body.reason ?? null },
        request,
      })

      return ok({ balanceAfter: result.balanceAfter })
    } catch (error) {
      if (error instanceof StockError) {
        throw new ApiError(409, error.code, error.code, { available: error.available })
      }
      throw error
    }
  },
})

/** Low-stock threshold / shelf location. */
export const PATCH = route({
  auth: { permission: 'inventory.adjust' },
  schema: inventoryThresholdSchema,
  async handler({ body, session, request }) {
    await prisma.inventory.upsert({
      where: { productId: body.productId },
      create: {
        productId: body.productId,
        quantity: 0,
        lowStockThreshold: body.lowStockThreshold,
        reorderLevel: body.reorderLevel ?? body.lowStockThreshold * 2,
        shelfLocation: body.shelfLocation ?? null,
      },
      update: {
        lowStockThreshold: body.lowStockThreshold,
        reorderLevel: body.reorderLevel,
        shelfLocation: body.shelfLocation ?? null,
      },
    })

    await audit({
      actor: session,
      action: 'inventory.threshold_update',
      entity: 'Product',
      entityId: body.productId,
      summary: `low stock threshold → ${body.lowStockThreshold}`,
      request,
    })

    return ok({ updated: true })
  },
})
