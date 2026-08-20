import { prisma } from '@/lib/prisma'
import { ok, route } from '@/lib/api'
import { batchSchema } from '@/lib/validation'
import { syncProductExpiry } from '@/lib/inventory'
import { audit } from '@/lib/audit'

/**
 * Batch (lot) tracking.
 *
 * A blocked or expired lot is excluded from `syncProductExpiry`, which is what
 * keeps `product.expiryDate` — and therefore the sellability rule — honest.
 */
export const POST = route({
  auth: { permission: 'inventory.adjust' },
  schema: batchSchema,
  async handler({ body, session, request }) {
    const batch = await prisma.inventoryBatch.upsert({
      where: { productId_lotNumber: { productId: body.productId, lotNumber: body.lotNumber } },
      create: {
        productId: body.productId,
        lotNumber: body.lotNumber,
        quantity: body.quantity,
        expiryDate: new Date(body.expiryDate),
        supplier: body.supplier ?? null,
        isBlocked: body.isBlocked,
      },
      update: {
        quantity: body.quantity,
        expiryDate: new Date(body.expiryDate),
        supplier: body.supplier ?? null,
        isBlocked: body.isBlocked,
      },
    })

    await syncProductExpiry(body.productId)

    await audit({
      actor: session,
      action: 'inventory.batch_upsert',
      entity: 'InventoryBatch',
      entityId: batch.id,
      summary: `lot ${batch.lotNumber}, qty ${batch.quantity}, expires ${batch.expiryDate.toISOString().slice(0, 10)}${
        batch.isBlocked ? ' (blocked)' : ''
      }`,
      request,
    })

    return ok({ batch })
  },
})

export const GET = route({
  auth: { permission: 'inventory.view' },
  rateLimit: false,
  async handler({ query }) {
    const productId = query.get('productId')
    const batches = await prisma.inventoryBatch.findMany({
      where: productId ? { productId } : {},
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { expiryDate: 'asc' },
      take: 200,
    })
    return ok({ batches })
  },
})
