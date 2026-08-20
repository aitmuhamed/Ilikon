'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, FileText, Package, ShoppingCart, Zap } from 'lucide-react'

import { AddToCartButton, QuantitySelector, WishlistButton } from './product-card'
import { Alert, Badge, StockIndicator } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { useCartCount, useI18n, useLocalePath } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { cn, formatMnt } from '@/lib/utils'

/**
 * Interactive half of the product page: gallery, quantity, add-to-cart and
 * buy-now. Prescription products keep the CTA available (the medicine can be
 * ordered) but state plainly that dispensing requires a verified prescription.
 */
export function ProductPurchasePanel({
  productId,
  slug,
  price,
  discountPrice,
  stock,
  stockStatus,
  prescriptionRequired,
  isWishlisted,
  images,
  name,
}: {
  productId: string
  slug: string
  price: number
  discountPrice: number | null
  stock: number
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
  prescriptionRequired: boolean
  isWishlisted: boolean
  images: { url: string; alt: string }[]
  name: string
}) {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const toast = useToast()
  const cart = useCartCount()
  const [quantity, setQuantity] = React.useState(1)
  const [activeImage, setActiveImage] = React.useState(0)
  const [buying, setBuying] = React.useState(false)

  const outOfStock = stockStatus === 'out_of_stock'
  const effective = discountPrice && discountPrice < price ? discountPrice : price
  const saving = price - effective

  React.useEffect(() => {
    // Product views are analytics, not tracking: anonymous, first-party only.
    void apiFetch('/api/analytics/event', {
      method: 'POST',
      body: { name: 'product_viewed', productId },
    }).catch(() => undefined)
  }, [productId])

  async function buyNow() {
    setBuying(true)
    try {
      await apiFetch('/api/cart/items', { method: 'POST', body: { productId, quantity } })
      await cart.refresh()
      window.location.href = localePath('/checkout')
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'INSUFFICIENT_STOCK') {
        toast.error(d.validation.insufficientStock, `${d.product.maxAvailable}: ${stock}`)
      } else {
        toast.error(d.errors.generic)
      }
      setBuying(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="card relative overflow-hidden p-0">
          <div className="aspect-square bg-ink-50">
            {images[activeImage]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[activeImage]!.url}
                alt={images[activeImage]!.alt}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-ink-300">
                <Package className="h-16 w-16" aria-hidden />
              </div>
            )}
          </div>
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {saving > 0 ? (
              <Badge tone="danger" className="shadow-sm">
                −{Math.round((saving / price) * 100)}%
              </Badge>
            ) : null}
          </div>
          <div className="absolute right-3 top-3">
            <WishlistButton productId={productId} initial={isWishlisted} />
          </div>
        </div>

        {images.length > 1 ? (
          <div className="mt-3 flex gap-2">
            {images.map((image, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveImage(index)}
                className={cn(
                  'h-16 w-16 overflow-hidden rounded-lg border-2 bg-ink-50 transition-colors',
                  index === activeImage ? 'border-brand-500' : 'border-transparent hover:border-ink-300',
                )}
                aria-label={`${name} — ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Purchase box */}
      <div>
        <div className="card p-5">
          <div className="flex items-end gap-3">
            <span className="text-3xl font-extrabold text-ink-900 tabular">{formatMnt(effective)}</span>
            {saving > 0 ? (
              <>
                <span className="pb-1 text-base text-ink-400 line-through tabular">
                  {formatMnt(price)}
                </span>
                <Badge tone="danger" className="mb-1.5">
                  {d.product.saveAmount} {formatMnt(saving)}
                </Badge>
              </>
            ) : null}
          </div>

          <div className="mt-3">
            <StockIndicator
              status={stockStatus}
              stock={stock}
              showCount
              labels={{
                inStock: d.product.inStock,
                lowStock: d.product.lowStock,
                outOfStock: d.product.outOfStock,
                stockCount: d.product.stockCount,
              }}
            />
          </div>

          {prescriptionRequired ? (
            <Alert tone="warning" className="mt-4" title={d.product.prescriptionRequired}>
              <p className="text-xs leading-relaxed">{d.product.prescriptionNotice}</p>
              <Link href={localePath('/prescriptions/upload')} className="mt-2 inline-block">
                <Button variant="accent" size="sm">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  {d.prescription.uploadTitle}
                </Button>
              </Link>
            </Alert>
          ) : null}

          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink-700">{d.common.quantity}</span>
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                max={Math.max(1, stock)}
                disabled={outOfStock}
              />
              {stockStatus === 'low_stock' ? (
                <span className="text-xs text-warning">
                  {d.product.maxAvailable}: {stock}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <AddToCartButton
                productId={productId}
                stock={stock}
                quantity={quantity}
                disabled={outOfStock}
                size="lg"
                variant="outline"
                className="flex-1"
              />
              <Button
                size="lg"
                className="flex-1"
                disabled={outOfStock}
                loading={buying}
                onClick={buyNow}
              >
                {!buying ? <Zap className="h-4 w-4" aria-hidden /> : null}
                {d.common.buyNow}
              </Button>
            </div>

            <WishlistButton productId={productId} initial={isWishlisted} withLabel className="w-full" />
          </div>

          {outOfStock ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
              {d.product.outOfStock} — {d.chatbot.contactPharmacist}
            </p>
          ) : null}

          <p className="mt-4 border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-500">
            <ShoppingCart className="mr-1 inline h-3 w-3" aria-hidden />
            <Link href={localePath(`/products/${slug}`)} className="hover:text-brand-700">
              {d.product.viewProduct}
            </Link>{' '}
            · {d.footer.disclaimer}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Tabbed medicine information. Safety tab is never collapsed away by default. */
export function ProductInfoTabs({
  sections,
  reviews,
}: {
  sections: {
    info: { label: string; value: string }[]
    description: string | null
    ingredients: string | null
    activeIngredients: string | null
    dosage: string | null
    usage: string | null
    warnings: string | null
    sideEffects: string | null
    storage: string | null
  }
  reviews: React.ReactNode
}) {
  const { d } = useI18n()
  const [tab, setTab] = React.useState<'info' | 'usage' | 'safety' | 'reviews'>('info')

  const tabs = [
    { key: 'info' as const, label: d.product.tabInfo },
    { key: 'usage' as const, label: d.product.tabUsage },
    { key: 'safety' as const, label: d.product.tabSafety },
    { key: 'reviews' as const, label: d.product.tabReviews },
  ]

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex overflow-x-auto border-b border-ink-100 no-scrollbar">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'shrink-0 border-b-2 px-5 py-3.5 text-sm font-medium transition-colors',
              tab === item.key
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'info' ? (
          <div className="space-y-5">
            {sections.description ? (
              <Block title={d.product.description} body={sections.description} />
            ) : null}
            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {sections.info.map((row) => (
                <div key={row.label} className="flex justify-between gap-4 border-b border-ink-100 pb-2">
                  <dt className="text-sm text-ink-500">{row.label}</dt>
                  <dd className="text-right text-sm font-medium text-ink-900">{row.value}</dd>
                </div>
              ))}
            </dl>
            {sections.ingredients ? (
              <Block title={d.product.ingredients} body={sections.ingredients} />
            ) : null}
          </div>
        ) : null}

        {tab === 'usage' ? (
          <div className="space-y-5">
            {sections.dosage ? <Block title={d.product.dosage} body={sections.dosage} /> : null}
            {sections.usage ? <Block title={d.product.usage} body={sections.usage} /> : null}
            {sections.storage ? <Block title={d.product.storage} body={sections.storage} /> : null}
            {!sections.dosage && !sections.usage ? (
              <p className="text-sm text-ink-500">{d.common.noResults}</p>
            ) : null}
            <Alert tone="warning">{d.product.safetyDisclaimer}</Alert>
          </div>
        ) : null}

        {tab === 'safety' ? (
          <div className="space-y-5">
            <Alert tone="warning" title={d.product.warnings}>
              {sections.warnings ?? d.product.safetyDisclaimer}
            </Alert>
            {sections.sideEffects ? (
              <Block title={d.product.sideEffects} body={sections.sideEffects} />
            ) : null}
            {sections.activeIngredients ? (
              <Block title={d.product.activeIngredients} body={sections.activeIngredients} />
            ) : null}
            <div className="rounded-xl bg-accent-50 p-4">
              <p className="text-sm font-semibold text-accent-900">{d.chatbot.emergencyNotice}</p>
              <p className="mt-1 text-xs leading-relaxed text-accent-800">{d.chatbot.disclaimer}</p>
            </div>
          </div>
        ) : null}

        {tab === 'reviews' ? reviews : null}
      </div>
    </div>
  )
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold text-ink-900">{title}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{body}</p>
    </div>
  )
}
