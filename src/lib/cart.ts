import 'server-only'

import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'

import { prisma } from './prisma'
import { CART_COOKIE } from './auth'
import { getSettings } from './settings'
import { evaluateCoupon } from './coupons'
import { mediaUrl } from './storage'
import { PRODUCT_CARD_SELECT, pickTranslation, sellableWhere } from './products'
import { effectivePrice, discountPercent } from './utils'
import type { Locale } from './locale-types'

/**
 * Carts are server-side rows keyed either by user id (signed in) or by an
 * httpOnly session cookie (guest). Keeping the cart on the server means stock
 * and pricing are always re-validated — a client-side cart can be tampered
 * with, which for a pharmacy is unacceptable.
 */

export interface CartLine {
  productId: string
  slug: string
  sku: string
  name: string
  imageUrl: string | null
  unitPrice: number
  listPrice: number
  discountPerUnit: number
  quantity: number
  lineTotal: number
  stock: number
  /** Quantity was capped because stock ran short. */
  clamped: boolean
  prescriptionRequired: boolean
  packageSize: string | null
}

export interface CartSummary {
  id: string | null
  lines: CartLine[]
  itemCount: number
  unitCount: number
  subtotal: number
  productDiscount: number
  couponCode: string | null
  couponDiscount: number
  couponError: string | null
  discountTotal: number
  deliveryFee: number
  freeDeliveryThreshold: number
  amountToFreeDelivery: number
  taxTotal: number
  total: number
  requiresPrescription: boolean
  hasIssues: boolean
}

export const EMPTY_CART: CartSummary = {
  id: null,
  lines: [],
  itemCount: 0,
  unitCount: 0,
  subtotal: 0,
  productDiscount: 0,
  couponCode: null,
  couponDiscount: 0,
  couponError: null,
  discountTotal: 0,
  deliveryFee: 0,
  freeDeliveryThreshold: 0,
  amountToFreeDelivery: 0,
  taxTotal: 0,
  total: 0,
  requiresPrescription: false,
  hasIssues: false,
}

async function readCartCookie(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null
}

async function writeCartCookie(sessionId: string): Promise<void> {
  const jar = await cookies()
  jar.set(CART_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

/** Resolves the caller's cart, creating one only when `create` is set. */
export async function resolveCart(
  userId: string | null,
  create = false,
): Promise<{ id: string } | null> {
  if (userId) {
    const existing = await prisma.cart.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } })
    if (existing) return existing
    return create ? prisma.cart.create({ data: { userId } }) : null
  }

  const sessionId = await readCartCookie()
  if (sessionId) {
    const existing = await prisma.cart.findUnique({ where: { sessionId } })
    if (existing) return existing
  }
  if (!create) return null

  const newSessionId = randomBytes(24).toString('base64url')
  await writeCartCookie(newSessionId)
  return prisma.cart.create({ data: { sessionId: newSessionId } })
}

/**
 * Merges a guest cart into the user's cart on login so nothing is lost.
 */
export async function mergeGuestCart(userId: string): Promise<void> {
  const sessionId = await readCartCookie()
  if (!sessionId) return

  const guestCart = await prisma.cart.findUnique({ where: { sessionId }, include: { items: true } })
  if (!guestCart || guestCart.items.length === 0) {
    if (guestCart) await prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined)
    return
  }

  const userCart =
    (await prisma.cart.findFirst({ where: { userId } })) ??
    (await prisma.cart.create({ data: { userId } }))

  for (const item of guestCart.items) {
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
      create: { cartId: userCart.id, productId: item.productId, quantity: item.quantity },
      update: { quantity: { increment: item.quantity } },
    })
  }

  if (guestCart.couponId && !userCart.couponId) {
    await prisma.cart.update({ where: { id: userCart.id }, data: { couponId: guestCart.couponId } })
  }

  await prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined)
  ;(await cookies()).delete(CART_COOKIE)
}

/**
 * Prices the cart from live catalogue data. Quantities above available stock
 * are clamped here rather than at checkout, so the customer sees the correction
 * before they commit.
 */
export async function getCartSummary(
  userId: string | null,
  locale: Locale,
  options?: { deliveryMethod?: 'PHARMACY_PICKUP' | 'HOME_DELIVERY' },
): Promise<CartSummary> {
  const settings = await getSettings()
  const cart = await resolveCart(userId, false)
  if (!cart) {
    return {
      ...EMPTY_CART,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
    }
  }

  const row = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: {
      coupon: true,
      items: {
        include: { product: { select: PRODUCT_CARD_SELECT } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!row) return { ...EMPTY_CART, freeDeliveryThreshold: settings.freeDeliveryThreshold }

  const lines: CartLine[] = []
  const staleItemIds: string[] = []

  for (const item of row.items) {
    const product = item.product
    const isExpired = Boolean(product.expiryDate && product.expiryDate.getTime() <= Date.now())
    if (product.status !== 'ACTIVE' || isExpired) {
      staleItemIds.push(item.id)
      continue
    }

    const stock = product.inventory?.quantity ?? 0
    const quantity = Math.min(item.quantity, Math.max(0, stock))
    if (quantity === 0) {
      // Keep the row visible so the customer knows why it cannot be ordered.
      lines.push(buildLine(product as CartProductRow, 0, stock, locale, item.quantity > 0))
      continue
    }
    lines.push(buildLine(product as CartProductRow, quantity, stock, locale, quantity !== item.quantity))
  }

  if (staleItemIds.length) {
    await prisma.cartItem.deleteMany({ where: { id: { in: staleItemIds } } }).catch(() => undefined)
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const productDiscount = lines.reduce((sum, l) => sum + l.discountPerUnit * l.quantity, 0)

  let couponDiscount = 0
  let couponCode: string | null = null
  let couponError: string | null = null

  if (row.coupon) {
    const evaluation = await evaluateCoupon({
      code: row.coupon.code,
      subtotal,
      userId,
    })
    if (evaluation.ok) {
      couponCode = row.coupon.code
      couponDiscount = evaluation.discount
    } else {
      couponError = evaluation.reason ?? 'NOT_FOUND'
    }
  }

  const discountTotal = couponDiscount
  const afterDiscount = Math.max(0, subtotal - discountTotal)

  const isPickup = options?.deliveryMethod === 'PHARMACY_PICKUP'
  const qualifiesFree = afterDiscount >= settings.freeDeliveryThreshold
  const deliveryFee = lines.length === 0 || isPickup || qualifiesFree ? 0 : settings.deliveryFee

  const taxTotal = settings.taxIncludedInPrice
    ? 0
    : Math.round((afterDiscount * settings.taxRatePct) / 100)

  return {
    id: row.id,
    lines,
    itemCount: lines.length,
    unitCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal,
    productDiscount,
    couponCode,
    couponDiscount,
    couponError,
    discountTotal,
    deliveryFee,
    freeDeliveryThreshold: settings.freeDeliveryThreshold,
    amountToFreeDelivery: Math.max(0, settings.freeDeliveryThreshold - afterDiscount),
    taxTotal,
    total: afterDiscount + deliveryFee + taxTotal,
    requiresPrescription: lines.some((l) => l.prescriptionRequired && l.quantity > 0),
    hasIssues: lines.some((l) => l.clamped || l.quantity === 0),
  }
}

/** Shape of the product columns `PRODUCT_CARD_SELECT` gives us for a cart row. */
interface CartProductRow {
  id: string
  slug: string
  sku: string
  name: string
  price: number
  discountPrice: number | null
  prescriptionRequired: boolean
  packageSize: string | null
  translations: { locale: string; name: string }[]
  images: { fileKey: string; isPrimary: boolean }[]
}

function buildLine(
  product: CartProductRow,
  quantity: number,
  stock: number,
  locale: Locale,
  clamped: boolean,
): CartLine {
  const translation = pickTranslation(product.translations, locale)
  const unit = effectivePrice(product.price, product.discountPrice)
  const primary = product.images.find((i) => i.isPrimary) ?? product.images[0]
  return {
    productId: product.id,
    slug: product.slug,
    sku: product.sku,
    name: translation?.name?.trim() || product.name,
    imageUrl: mediaUrl(primary?.fileKey),
    unitPrice: unit,
    listPrice: product.price,
    discountPerUnit: Math.max(0, product.price - unit),
    quantity,
    lineTotal: unit * quantity,
    stock,
    clamped,
    prescriptionRequired: product.prescriptionRequired,
    packageSize: product.packageSize ?? null,
  }
}

// ─────────────────────────── mutations ────────────────────────────────────

export class CartError extends Error {
  constructor(
    public readonly code:
      | 'PRODUCT_NOT_FOUND'
      | 'PRODUCT_UNAVAILABLE'
      | 'EXPIRED_PRODUCT'
      | 'INSUFFICIENT_STOCK',
    public readonly available?: number,
  ) {
    super(code)
  }
}

export async function addToCart(
  userId: string | null,
  productId: string,
  quantity: number,
): Promise<{ available: number }> {
  const product = await prisma.product.findFirst({
    where: { id: productId, ...sellableWhere() },
    select: { id: true, inventory: { select: { quantity: true } } },
  })
  if (!product) {
    // Distinguish "gone" from "not sellable right now" for a clearer message.
    const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, expiryDate: true } })
    if (!exists) throw new CartError('PRODUCT_NOT_FOUND')
    if (exists.expiryDate && exists.expiryDate.getTime() <= Date.now()) {
      throw new CartError('EXPIRED_PRODUCT')
    }
    throw new CartError('PRODUCT_UNAVAILABLE')
  }

  const available = product.inventory?.quantity ?? 0
  const cart = (await resolveCart(userId, true))!

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  })
  const desired = (existing?.quantity ?? 0) + quantity

  if (desired > available) throw new CartError('INSUFFICIENT_STOCK', available)

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity },
    update: { quantity: desired },
  })
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } })

  return { available }
}

export async function setCartQuantity(
  userId: string | null,
  productId: string,
  quantity: number,
): Promise<void> {
  const cart = await resolveCart(userId, false)
  if (!cart) return

  if (quantity <= 0) {
    await prisma.cartItem
      .delete({ where: { cartId_productId: { cartId: cart.id, productId } } })
      .catch(() => undefined)
    return
  }

  const inventory = await prisma.inventory.findUnique({ where: { productId } })
  const available = inventory?.quantity ?? 0
  if (quantity > available) throw new CartError('INSUFFICIENT_STOCK', available)

  await prisma.cartItem.update({
    where: { cartId_productId: { cartId: cart.id, productId } },
    data: { quantity },
  })
}

export async function removeFromCart(userId: string | null, productId: string): Promise<void> {
  await setCartQuantity(userId, productId, 0)
}

export async function clearCart(userId: string | null): Promise<void> {
  const cart = await resolveCart(userId, false)
  if (!cart) return
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
  await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } })
}

export async function applyCartCoupon(
  userId: string | null,
  code: string,
  locale: Locale,
): Promise<{ ok: boolean; reason?: string }> {
  const summary = await getCartSummary(userId, locale)
  if (!summary.id) return { ok: false, reason: 'NOT_FOUND' }

  const evaluation = await evaluateCoupon({ code, subtotal: summary.subtotal, userId })
  if (!evaluation.ok || !evaluation.coupon) {
    return { ok: false, reason: evaluation.reason }
  }
  await prisma.cart.update({ where: { id: summary.id }, data: { couponId: evaluation.coupon.id } })
  return { ok: true }
}

export async function removeCartCoupon(userId: string | null): Promise<void> {
  const cart = await resolveCart(userId, false)
  if (!cart) return
  await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } })
}

export async function cartBadgeCount(userId: string | null): Promise<number> {
  const cart = await resolveCart(userId, false)
  if (!cart) return 0
  const agg = await prisma.cartItem.aggregate({
    where: { cartId: cart.id },
    _sum: { quantity: true },
  })
  return agg._sum.quantity ?? 0
}

export { discountPercent }
