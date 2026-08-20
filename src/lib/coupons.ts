import 'server-only'

import type { Coupon, Prisma } from '@prisma/client'

import { prisma } from './prisma'

export type CouponRejection =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'USAGE_LIMIT_REACHED'
  | 'CUSTOMER_LIMIT_REACHED'
  | 'MIN_ORDER_NOT_MET'

export interface CouponEvaluation {
  ok: boolean
  reason?: CouponRejection
  coupon?: Coupon
  discount: number
  minOrderAmount?: number
}

/**
 * Validates a coupon against the current basket. Called both when the code is
 * entered and again at order creation — the second check is the authoritative
 * one, since a coupon can expire or hit its limit between the two.
 */
export async function evaluateCoupon(input: {
  code: string
  subtotal: number
  userId?: string | null
  tx?: Prisma.TransactionClient
}): Promise<CouponEvaluation> {
  const db = input.tx ?? prisma
  const code = input.code.trim().toUpperCase()

  const coupon = await db.coupon.findFirst({ where: { code, deletedAt: null } })
  if (!coupon) return { ok: false, reason: 'NOT_FOUND', discount: 0 }
  if (!coupon.isActive) return { ok: false, reason: 'INACTIVE', discount: 0 }

  const now = new Date()
  if (coupon.startsAt > now) return { ok: false, reason: 'NOT_STARTED', discount: 0, coupon }
  if (coupon.endsAt < now) return { ok: false, reason: 'EXPIRED', discount: 0, coupon }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: 'USAGE_LIMIT_REACHED', discount: 0, coupon }
  }

  if (input.subtotal < coupon.minOrderAmount) {
    return {
      ok: false,
      reason: 'MIN_ORDER_NOT_MET',
      discount: 0,
      coupon,
      minOrderAmount: coupon.minOrderAmount,
    }
  }

  if (input.userId) {
    const used = await db.couponRedemption.count({
      where: { couponId: coupon.id, userId: input.userId },
    })
    if (used >= coupon.perCustomerLimit) {
      return { ok: false, reason: 'CUSTOMER_LIMIT_REACHED', discount: 0, coupon }
    }
  }

  return { ok: true, coupon, discount: computeDiscount(coupon, input.subtotal) }
}

export function computeDiscount(coupon: Coupon, subtotal: number): number {
  const raw =
    coupon.discountType === 'PERCENTAGE'
      ? Math.floor((subtotal * coupon.discountValue) / 100)
      : coupon.discountValue

  const capped = coupon.maxDiscountAmount ? Math.min(raw, coupon.maxDiscountAmount) : raw
  // A discount can never exceed the basket itself.
  return Math.max(0, Math.min(capped, subtotal))
}

/** Records a redemption and increments the counter, inside the order transaction. */
export async function redeemCoupon(
  tx: Prisma.TransactionClient,
  input: { couponId: string; userId?: string | null; orderId: string; amount: number },
): Promise<void> {
  await tx.coupon.update({
    where: { id: input.couponId },
    data: { usedCount: { increment: 1 } },
  })
  await tx.couponRedemption.create({
    data: {
      couponId: input.couponId,
      userId: input.userId ?? null,
      orderId: input.orderId,
      amount: input.amount,
    },
  })
}

export function couponRejectionMessage(reason: CouponRejection, locale: string): string {
  const messages: Record<CouponRejection, Record<string, string>> = {
    NOT_FOUND: {
      mn: 'Купоны код олдсонгүй.',
      en: 'Coupon code not found.',
      ru: 'Промокод не найден.',
    },
    INACTIVE: {
      mn: 'Энэ купон идэвхгүй байна.',
      en: 'This coupon is not active.',
      ru: 'Этот промокод неактивен.',
    },
    NOT_STARTED: {
      mn: 'Энэ купон хараахан хүчин төгөлдөр болоогүй.',
      en: 'This coupon is not valid yet.',
      ru: 'Промокод ещё не действует.',
    },
    EXPIRED: {
      mn: 'Купоны хугацаа дууссан.',
      en: 'This coupon has expired.',
      ru: 'Срок действия промокода истёк.',
    },
    USAGE_LIMIT_REACHED: {
      mn: 'Купоны хэрэглэх хязгаар дууссан.',
      en: 'This coupon has reached its usage limit.',
      ru: 'Лимит использования промокода исчерпан.',
    },
    CUSTOMER_LIMIT_REACHED: {
      mn: 'Та энэ купоныг аль хэдийн хэрэглэсэн.',
      en: 'You have already used this coupon.',
      ru: 'Вы уже использовали этот промокод.',
    },
    MIN_ORDER_NOT_MET: {
      mn: 'Захиалгын дүн купоны доод шаардлагад хүрэхгүй байна.',
      en: 'Your order total is below the coupon minimum.',
      ru: 'Сумма заказа ниже минимума для промокода.',
    },
  }
  return messages[reason][locale] ?? messages[reason].mn
}
