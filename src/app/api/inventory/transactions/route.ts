import { prisma } from '@/lib/prisma'
import { ok, pageMeta, readPagination, route } from '@/lib/api'

/** Inventory ledger, optionally scoped to one product. */
export const GET = route({
  auth: { permission: 'inventory.view' },
  rateLimit: false,
  async handler({ query }) {
    const pagination = readPagination(query, 50, 200)
    const productId = query.get('productId')
    const type = query.get('type')

    const where = {
      ...(productId ? { productId } : {}),
      ...(type && type !== 'all' ? { type: type as never } : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          performedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    return ok({
      transactions: rows.map((row) => ({
        id: row.id,
        type: row.type,
        quantityDelta: row.quantityDelta,
        balanceAfter: row.balanceAfter,
        reason: row.reason,
        reference: row.reference,
        performedBy: row.performedBy?.fullName ?? null,
        createdAt: row.createdAt.toISOString(),
        productName: row.product.name,
        productSku: row.product.sku,
      })),
      meta: pageMeta(pagination, total),
    })
  },
})
