import 'server-only'

import type { InventoryTxType, Prisma } from '@prisma/client'

import { prisma } from './prisma'
import { getSettings } from './settings'
import { notifyStaff } from './notifications'

/**
 * Stock is authoritative in `inventory.quantity`; every change is mirrored into
 * `inventory_transactions` as a signed ledger entry with the resulting balance,
 * so the history can always be reconciled against the current figure.
 */

export class StockError extends Error {
  constructor(
    public readonly code: 'INSUFFICIENT_STOCK' | 'EXPIRED_PRODUCT' | 'PRODUCT_UNAVAILABLE',
    public readonly productId: string,
    public readonly available?: number,
  ) {
    super(code)
  }
}

const NEGATIVE_TYPES: InventoryTxType[] = ['STOCK_OUT', 'SALE', 'DAMAGED', 'EXPIRED']

/**
 * Applies a stock movement inside an optional transaction.
 * `quantity` is always positive — the sign comes from `type`.
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  input: {
    productId: string
    type: InventoryTxType
    quantity: number
    reason?: string | null
    reference?: string | null
    performedById?: string | null
    allowNegative?: boolean
  },
): Promise<{ balanceAfter: number }> {
  const delta = NEGATIVE_TYPES.includes(input.type) ? -Math.abs(input.quantity) : Math.abs(input.quantity)

  const inventory = await tx.inventory.findUnique({ where: { productId: input.productId } })
  const current = inventory?.quantity ?? 0
  const next = current + delta

  if (next < 0 && !input.allowNegative) {
    throw new StockError('INSUFFICIENT_STOCK', input.productId, current)
  }

  if (inventory) {
    await tx.inventory.update({
      where: { productId: input.productId },
      data: { quantity: next, lastCountedAt: input.type === 'ADJUSTMENT' ? new Date() : undefined },
    })
  } else {
    await tx.inventory.create({ data: { productId: input.productId, quantity: Math.max(0, next) } })
  }

  await tx.inventoryTransaction.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantityDelta: delta,
      balanceAfter: Math.max(0, next),
      reason: input.reason ?? null,
      reference: input.reference ?? null,
      performedById: input.performedById ?? null,
    },
  })

  if (input.type === 'SALE') {
    await tx.product.update({
      where: { id: input.productId },
      data: { soldCount: { increment: Math.abs(input.quantity) } },
    })
  }

  return { balanceAfter: Math.max(0, next) }
}

/** Standalone adjustment from the admin inventory screen. */
export async function adjustStock(input: {
  productId: string
  type: InventoryTxType
  quantity: number
  reason?: string
  reference?: string
  performedById: string
}): Promise<{ balanceAfter: number }> {
  const result = await prisma.$transaction((tx) => applyStockMovement(tx, input))
  await checkLowStock(input.productId)
  return result
}

/**
 * Confirms every line of a prospective order can actually be dispensed.
 * Throws on the first problem so the caller can surface a precise message.
 */
export async function assertSellable(
  tx: Prisma.TransactionClient,
  lines: { productId: string; quantity: number }[],
): Promise<void> {
  const products = await tx.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
    select: {
      id: true,
      status: true,
      deletedAt: true,
      expiryDate: true,
      inventory: { select: { quantity: true } },
    },
  })
  const byId = new Map(products.map((p) => [p.id, p]))

  for (const line of lines) {
    const product = byId.get(line.productId)
    if (!product || product.deletedAt || product.status !== 'ACTIVE') {
      throw new StockError('PRODUCT_UNAVAILABLE', line.productId)
    }
    if (product.expiryDate && product.expiryDate.getTime() <= Date.now()) {
      throw new StockError('EXPIRED_PRODUCT', line.productId)
    }
    const available = product.inventory?.quantity ?? 0
    if (available < line.quantity) {
      throw new StockError('INSUFFICIENT_STOCK', line.productId, available)
    }
  }
}

// ───────────────────────────── alerting ───────────────────────────────────

export async function checkLowStock(productId: string): Promise<void> {
  const settings = await getSettings()
  if (!settings.notifyOnLowStock) return

  const inventory = await prisma.inventory.findUnique({
    where: { productId },
    include: { product: { select: { name: true, sku: true } } },
  })
  if (!inventory) return

  const threshold = inventory.lowStockThreshold || settings.lowStockThreshold
  if (inventory.quantity > threshold) return

  await notifyStaff({
    type: 'LOW_STOCK',
    title: 'Нөөц багассан',
    body: `${inventory.product.name} (${inventory.product.sku}) — үлдэгдэл ${inventory.quantity}. Доод хязгаар ${threshold}.`,
    linkUrl: '/admin/inventory',
    dedupeKey: `low_stock:${productId}:${inventory.quantity}`,
  })
}

export interface InventoryAlerts {
  lowStock: {
    productId: string
    name: string
    sku: string
    quantity: number
    threshold: number
  }[]
  expiring: { productId: string; name: string; sku: string; expiryDate: Date; daysLeft: number }[]
  expired: { productId: string; name: string; sku: string; expiryDate: Date }[]
}

export async function getInventoryAlerts(): Promise<InventoryAlerts> {
  const settings = await getSettings()
  const now = new Date()
  const horizon = new Date(now.getTime() + settings.expiryWarningDays * 86_400_000)

  const [lowRows, expiringRows, expiredRows] = await Promise.all([
    prisma.inventory.findMany({
      where: { product: { deletedAt: null, status: { in: ['ACTIVE', 'INACTIVE'] } } },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { quantity: 'asc' },
      take: 200,
    }),
    prisma.product.findMany({
      where: {
        deletedAt: null,
        status: { in: ['ACTIVE', 'INACTIVE'] },
        expiryDate: { gt: now, lte: horizon },
      },
      select: { id: true, name: true, sku: true, expiryDate: true },
      orderBy: { expiryDate: 'asc' },
      take: 100,
    }),
    prisma.product.findMany({
      where: { deletedAt: null, status: { not: 'ARCHIVED' }, expiryDate: { lte: now } },
      select: { id: true, name: true, sku: true, expiryDate: true },
      orderBy: { expiryDate: 'asc' },
      take: 100,
    }),
  ])

  return {
    lowStock: lowRows
      .filter((r) => r.quantity <= (r.lowStockThreshold || settings.lowStockThreshold))
      .map((r) => ({
        productId: r.product.id,
        name: r.product.name,
        sku: r.product.sku,
        quantity: r.quantity,
        threshold: r.lowStockThreshold || settings.lowStockThreshold,
      })),
    expiring: expiringRows.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      expiryDate: p.expiryDate!,
      daysLeft: Math.ceil((p.expiryDate!.getTime() - now.getTime()) / 86_400_000),
    })),
    expired: expiredRows.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      expiryDate: p.expiryDate!,
    })),
  }
}

/**
 * Recomputes `product.expiryDate` from the batch table (earliest unblocked
 * lot). Called after a batch is created, edited or written off.
 */
export async function syncProductExpiry(productId: string): Promise<void> {
  const earliest = await prisma.inventoryBatch.findFirst({
    where: { productId, isBlocked: false, quantity: { gt: 0 } },
    orderBy: { expiryDate: 'asc' },
    select: { expiryDate: true },
  })
  await prisma.product.update({
    where: { id: productId },
    data: { expiryDate: earliest?.expiryDate ?? null },
  })
}
