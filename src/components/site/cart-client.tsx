'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, FileText, Package, ShoppingBag, Tag, Trash2, X } from 'lucide-react'

import { QuantitySelector } from './product-card'
import { Alert, Badge, Card, EmptyState, Progress } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/field'
import { useCartCount, useI18n, useLocalePath } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { interpolate } from '@/i18n'
import { formatMnt } from '@/lib/utils'
import type { CartSummary } from '@/lib/cart'

/**
 * Cart page. Every mutation re-reads the priced summary from the server, so the
 * totals on screen are always the totals the checkout will charge.
 */
export function CartClient({ initial }: { initial: CartSummary }) {
  const { d, locale } = useI18n()
  const localePath = useLocalePath()
  const router = useRouter()
  const toast = useToast()
  const cartBadge = useCartCount()

  const [cart, setCart] = React.useState(initial)
  const [busyProduct, setBusyProduct] = React.useState<string | null>(null)
  const [coupon, setCoupon] = React.useState('')
  const [couponBusy, setCouponBusy] = React.useState(false)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const [removeTarget, setRemoveTarget] = React.useState<{ id: string; name: string } | null>(null)

  function sync(next: CartSummary) {
    setCart(next)
    cartBadge.setCount(next.unitCount)
  }

  async function updateQuantity(productId: string, quantity: number) {
    setBusyProduct(productId)
    try {
      const next = await apiFetch<CartSummary>(`/api/cart/items?locale=${locale}`, {
        method: 'PATCH',
        body: { productId, quantity },
      })
      sync(next)
      toast.success(d.cart.updated)
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'INSUFFICIENT_STOCK') {
        const available = (error.details as { available?: number })?.available
        toast.error(
          d.validation.insufficientStock,
          available !== undefined ? interpolate(d.cart.stockWarning, { count: available }) : undefined,
        )
      } else {
        toast.error(d.errors.generic)
      }
    } finally {
      setBusyProduct(null)
    }
  }

  async function remove(productId: string) {
    setBusyProduct(productId)
    try {
      const next = await apiFetch<CartSummary>(`/api/cart/items/${productId}?locale=${locale}`, {
        method: 'DELETE',
      })
      sync(next)
      toast.success(d.cart.removed)
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusyProduct(null)
      setRemoveTarget(null)
    }
  }

  async function clearAll() {
    try {
      const next = await apiFetch<CartSummary>(`/api/cart?locale=${locale}`, { method: 'DELETE' })
      sync(next)
      toast.success(d.cart.removed)
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setConfirmClear(false)
    }
  }

  async function applyCoupon() {
    if (!coupon.trim()) return
    setCouponBusy(true)
    try {
      const next = await apiFetch<CartSummary>(`/api/cart/coupon?locale=${locale}`, {
        method: 'POST',
        body: { code: coupon.trim() },
      })
      sync(next)
      setCoupon('')
      toast.success(d.cart.couponApplied)
    } catch (error) {
      toast.error(
        d.cart.couponInvalid,
        error instanceof ApiClientError ? error.message : undefined,
      )
    } finally {
      setCouponBusy(false)
    }
  }

  async function removeCoupon() {
    setCouponBusy(true)
    try {
      const next = await apiFetch<CartSummary>(`/api/cart/coupon?locale=${locale}`, { method: 'DELETE' })
      sync(next)
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setCouponBusy(false)
    }
  }

  if (cart.lines.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title={d.cart.empty}
          body={d.cart.emptyBody}
          action={
            <Link href={localePath('/products')}>
              <Button>
                {d.cart.continueShopping}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
          }
        />
      </Card>
    )
  }

  const freeDeliveryProgress =
    cart.freeDeliveryThreshold > 0
      ? Math.min(100, ((cart.subtotal - cart.discountTotal) / cart.freeDeliveryThreshold) * 100)
      : 100

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Lines */}
      <div className="space-y-3">
        {cart.hasIssues ? (
          <Alert tone="warning" title={d.validation.insufficientStock}>
            {d.cart.updated} — {d.product.maxAvailable}.
          </Alert>
        ) : null}

        {cart.requiresPrescription ? (
          <Alert tone="warning" title={d.cart.prescriptionItems}>
            <p>{d.cart.prescriptionItemsBody}</p>
            <Link href={localePath('/prescriptions/upload')} className="mt-2 inline-block">
              <Button variant="accent" size="sm">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {d.prescription.uploadTitle}
              </Button>
            </Link>
          </Alert>
        ) : null}

        {cart.couponError ? (
          <Alert tone="danger" title={d.cart.couponInvalid}>
            {d.cart.couponRemove}
          </Alert>
        ) : null}

        {cart.lines.map((line) => (
          <Card key={line.productId} className="p-3.5 sm:p-4">
            <div className="flex gap-3.5">
              <Link
                href={localePath(`/products/${line.slug}`)}
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-50 sm:h-24 sm:w-24"
              >
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-ink-300" aria-hidden />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={localePath(`/products/${line.slug}`)}
                      className="line-clamp-2 text-sm font-semibold text-ink-900 hover:text-brand-700"
                    >
                      {line.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {line.sku}
                      {line.packageSize ? ` · ${line.packageSize}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {line.prescriptionRequired ? (
                        <Badge tone="rx">{d.product.prescriptionRequired}</Badge>
                      ) : null}
                      {line.quantity === 0 ? (
                        <Badge tone="danger">{d.product.outOfStock}</Badge>
                      ) : line.clamped ? (
                        <Badge tone="warning">
                          {interpolate(d.cart.stockWarning, { count: line.stock })}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRemoveTarget({ id: line.productId, name: line.name })}
                    className="-m-1 shrink-0 rounded-lg p-1 text-ink-400 transition-colors hover:bg-red-50 hover:text-danger"
                    aria-label={d.cart.remove}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <QuantitySelector
                    value={Math.max(1, line.quantity)}
                    onChange={(value) => updateQuantity(line.productId, value)}
                    max={Math.max(1, line.stock)}
                    disabled={busyProduct === line.productId || line.stock === 0}
                    size="sm"
                  />
                  <div className="text-right">
                    {line.discountPerUnit > 0 ? (
                      <p className="text-xs text-ink-400 line-through tabular">
                        {formatMnt(line.listPrice * Math.max(1, line.quantity), locale)}
                      </p>
                    ) : null}
                    <p className="text-base font-bold text-ink-900 tabular">
                      {formatMnt(line.lineTotal, locale)}
                    </p>
                    <p className="text-xs text-ink-400 tabular">
                      {formatMnt(line.unitPrice, locale)} × {Math.max(1, line.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Link href={localePath('/products')}>
            <Button variant="ghost" size="sm">
              ← {d.cart.continueShopping}
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} className="text-danger">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {d.cart.clearCart}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div>
        <Card className="lg:sticky lg:top-32">
          <h2 className="text-base font-semibold text-ink-900">{d.checkout.orderSummary}</h2>

          {/* Coupon */}
          <div className="mt-4">
            {cart.couponCode ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Tag className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <span className="truncate text-sm font-semibold text-brand-800">{cart.couponCode}</span>
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  disabled={couponBusy}
                  className="shrink-0 text-xs font-medium text-brand-700 underline hover:text-brand-900"
                >
                  {d.cart.couponRemove}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={coupon}
                  onChange={(event) => setCoupon(event.target.value.toUpperCase())}
                  onKeyDown={(event) => event.key === 'Enter' && applyCoupon()}
                  placeholder={d.cart.couponPlaceholder}
                  className="uppercase"
                  aria-label={d.cart.couponCode}
                />
                <Button variant="outline" onClick={applyCoupon} loading={couponBusy} disabled={!coupon.trim()}>
                  {d.cart.couponApply}
                </Button>
              </div>
            )}
          </div>

          {/* Free delivery progress */}
          {cart.amountToFreeDelivery > 0 ? (
            <div className="mt-4 rounded-xl bg-accent-50 p-3.5">
              <p className="text-xs font-medium text-accent-900">
                {interpolate(d.cart.freeDeliveryProgress, {
                  amount: formatMnt(cart.amountToFreeDelivery, locale),
                })}
              </p>
              <Progress value={freeDeliveryProgress} tone="accent" className="mt-2" />
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-brand-50 p-3 text-center text-xs font-semibold text-brand-800">
              ✓ {d.cart.deliveryFee}: {d.cart.freeDelivery}
            </div>
          )}

          <dl className="mt-4 space-y-2.5 border-t border-ink-100 pt-4 text-sm">
            <Row label={`${d.cart.subtotal} (${cart.unitCount} ${d.cart.items})`} value={formatMnt(cart.subtotal, locale)} />
            {cart.productDiscount > 0 ? (
              <Row
                label={d.product.discountBadge}
                value={`−${formatMnt(cart.productDiscount, locale)}`}
                tone="success"
              />
            ) : null}
            {cart.couponDiscount > 0 ? (
              <Row
                label={`${d.cart.discount} (${cart.couponCode})`}
                value={`−${formatMnt(cart.couponDiscount, locale)}`}
                tone="success"
              />
            ) : null}
            <Row
              label={d.cart.deliveryFee}
              value={cart.deliveryFee === 0 ? d.cart.freeDelivery : formatMnt(cart.deliveryFee, locale)}
              tone={cart.deliveryFee === 0 ? 'success' : undefined}
            />
            {cart.taxTotal > 0 ? (
              <Row label={d.admin.taxRate} value={formatMnt(cart.taxTotal, locale)} />
            ) : null}
          </dl>

          <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-4">
            <span className="text-sm font-semibold text-ink-700">{d.cart.total}</span>
            <span className="text-2xl font-extrabold text-ink-900 tabular">
              {formatMnt(cart.total, locale)}
            </span>
          </div>

          <Button
            fullWidth
            size="lg"
            className="mt-4"
            disabled={cart.unitCount === 0}
            onClick={() => router.push(localePath('/checkout'))}
          >
            {d.cart.checkout}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {d.footer.disclaimer}
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        title={d.cart.clearCart}
        body={d.cart.clearCartConfirm}
        confirmLabel={d.cart.clearCart}
        cancelLabel={d.common.cancel}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && remove(removeTarget.id)}
        title={d.cart.removeConfirm}
        body={removeTarget?.name}
        confirmLabel={d.cart.remove}
        cancelLabel={d.common.cancel}
      />
    </div>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success'
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-500">{label}</dt>
      <dd className={tone === 'success' ? 'font-semibold text-success tabular' : 'font-medium text-ink-900 tabular'}>
        {value}
      </dd>
    </div>
  )
}
