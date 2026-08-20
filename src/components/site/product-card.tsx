'use client'

import * as React from 'react'
import Link from 'next/link'
import { Heart, Minus, Package, Plus, ShoppingCart } from 'lucide-react'

import { Badge, StarRating, StockIndicator } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useCartCount, useI18n, useLocalePath } from '@/components/providers'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { cn, formatMnt } from '@/lib/utils'
import { MAX_CART_QUANTITY } from '@/lib/constants'
import type { ProductCard as ProductCardData } from '@/lib/products'

/**
 * The single product tile used on the home shelves, category pages, search
 * results and the wishlist. Prescription status and stock are always visible —
 * a customer should never reach the cart before learning a prescription is
 * required.
 */
export function ProductCard({
  product,
  className,
  compact = false,
  isWishlisted = false,
  showWishlist = true,
}: {
  product: ProductCardData
  className?: string
  compact?: boolean
  isWishlisted?: boolean
  showWishlist?: boolean
}) {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const href = localePath(`/products/${product.slug}`)

  return (
    <article
      className={cn(
        'card card-hover group flex flex-col overflow-hidden p-0',
        className,
      )}
    >
      <div className="relative">
        <Link href={href} className="block aspect-square overflow-hidden bg-ink-50">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.imageAlt}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-300">
              <Package className="h-10 w-10" aria-hidden />
            </div>
          )}
        </Link>

        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {product.discountPercent ? (
            <Badge tone="danger" className="shadow-sm">
              −{product.discountPercent}%
            </Badge>
          ) : null}
          {product.isNew ? (
            <Badge tone="accent" className="shadow-sm">
              {d.product.newBadge}
            </Badge>
          ) : null}
        </div>

        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1.5">
          <Badge tone={product.prescriptionRequired ? 'rx' : 'otc'} className="shadow-sm">
            {product.prescriptionRequired ? d.product.prescriptionRequiredShort : d.product.otcShort}
          </Badge>
          {showWishlist ? <WishlistButton productId={product.id} initial={isWishlisted} /> : null}
        </div>
      </div>

      <div className={cn('flex min-w-0 flex-1 flex-col', compact ? 'p-3' : 'p-4')}>
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-400">
          {product.brandName ?? product.categoryName}
        </p>

        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ink-900">
          <Link href={href} className="transition-colors hover:text-brand-700">
            {product.name}
          </Link>
        </h3>

        {product.packageSize || product.strength ? (
          <p className="mt-1 truncate text-xs text-ink-500">
            {[product.strength, product.packageSize].filter(Boolean).join(' · ')}
          </p>
        ) : null}

        {product.ratingCount > 0 ? (
          <StarRating value={product.rating} count={product.ratingCount} className="mt-2" />
        ) : null}

        <div className="mt-2.5 flex items-end gap-2">
          <span className="text-base font-bold text-ink-900 tabular">
            {formatMnt(product.effectivePrice)}
          </span>
          {product.discountPrice ? (
            <span className="pb-0.5 text-xs text-ink-400 line-through tabular">
              {formatMnt(product.price)}
            </span>
          ) : null}
        </div>

        <div className="mt-1.5">
          <StockIndicator
            status={product.stockStatus}
            stock={product.stock}
            showCount={product.stockStatus === 'low_stock'}
            labels={{
              inStock: d.product.inStock,
              lowStock: d.product.lowStock,
              outOfStock: d.product.outOfStock,
              stockCount: d.product.stockCount,
            }}
          />
        </div>

        <div className="mt-3 flex-1" />

        <AddToCartButton
          productId={product.id}
          stock={product.stock}
          disabled={product.stockStatus === 'out_of_stock'}
          size="sm"
          fullWidth
        />
      </div>
    </article>
  )
}

// ─────────────────────────── add to cart ──────────────────────────────────

export function AddToCartButton({
  productId,
  stock,
  quantity = 1,
  disabled,
  size = 'md',
  fullWidth,
  variant = 'primary',
  label,
  onAdded,
  className,
}: {
  productId: string
  stock: number
  quantity?: number
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  variant?: 'primary' | 'secondary' | 'outline'
  label?: string
  onAdded?: () => void
  className?: string
}) {
  const { d } = useI18n()
  const toast = useToast()
  const cart = useCartCount()
  const [loading, setLoading] = React.useState(false)

  async function add() {
    setLoading(true)
    try {
      await apiFetch('/api/cart/items', { method: 'POST', body: { productId, quantity } })
      await cart.refresh()
      toast.success(d.cart.added)
      onAdded?.()
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.code === 'INSUFFICIENT_STOCK') {
          toast.error(d.validation.insufficientStock, `${d.product.maxAvailable}: ${stock}`)
        } else if (error.code === 'EXPIRED_PRODUCT') {
          toast.error(d.validation.expiredProduct)
        } else if (error.code === 'UNAUTHORIZED') {
          toast.error(d.errors.unauthorized)
        } else {
          toast.error(d.errors.generic, error.message)
        }
      } else {
        toast.error(d.errors.network)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      loading={loading}
      disabled={disabled}
      onClick={add}
      className={className}
      aria-label={label ?? d.common.addToCart}
    >
      {!loading ? <ShoppingCart className="h-4 w-4" aria-hidden /> : null}
      <span className="truncate">
        {disabled ? d.product.outOfStock : (label ?? d.common.addToCart)}
      </span>
    </Button>
  )
}

// ───────────────────────── quantity selector ──────────────────────────────

export function QuantitySelector({
  value,
  onChange,
  max,
  min = 1,
  disabled,
  size = 'md',
}: {
  value: number
  onChange: (value: number) => void
  max: number
  min?: number
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const cap = Math.max(min, Math.min(max, MAX_CART_QUANTITY))
  const buttonSize = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'

  return (
    <div className="inline-flex items-center rounded-xl border border-ink-300 bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className={cn(
          buttonSize,
          'flex items-center justify-center rounded-l-xl text-ink-600 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:text-ink-300',
        )}
        aria-label="−"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={cap}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isNaN(next)) return
          onChange(Math.max(min, Math.min(cap, next)))
        }}
        className={cn(
          'w-11 border-x border-ink-200 bg-transparent text-center text-sm font-semibold text-ink-900 tabular focus:outline-none',
          size === 'sm' ? 'h-8' : 'h-10',
        )}
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(cap, value + 1))}
        disabled={disabled || value >= cap}
        className={cn(
          buttonSize,
          'flex items-center justify-center rounded-r-xl text-ink-600 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:text-ink-300',
        )}
        aria-label="+"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ────────────────────────── wishlist button ───────────────────────────────

export function WishlistButton({
  productId,
  initial,
  withLabel = false,
  className,
}: {
  productId: string
  initial: boolean
  withLabel?: boolean
  className?: string
}) {
  const { d } = useI18n()
  const toast = useToast()
  const localePath = useLocalePath()
  const [active, setActive] = React.useState(initial)
  const [loading, setLoading] = React.useState(false)

  async function toggle() {
    setLoading(true)
    const next = !active
    try {
      if (next) {
        await apiFetch('/api/wishlist', { method: 'POST', body: { productId } })
      } else {
        await apiFetch(`/api/wishlist/${productId}`, { method: 'DELETE' })
      }
      setActive(next)
      toast.success(next ? d.product.addToWishlist : d.product.removeFromWishlist)
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        toast.info(d.errors.unauthorized, d.auth.loginSubtitle)
        window.location.href = localePath('/login')
        return
      }
      toast.error(d.errors.generic)
    } finally {
      setLoading(false)
    }
  }

  if (withLabel) {
    return (
      <Button variant="outline" size="md" onClick={toggle} loading={loading} className={className}>
        <Heart className={cn('h-4 w-4', active && 'fill-danger text-danger')} aria-hidden />
        {active ? d.product.removeFromWishlist : d.product.addToWishlist}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={active ? d.product.removeFromWishlist : d.product.addToWishlist}
      aria-pressed={active}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink-400 shadow-sm backdrop-blur transition-colors hover:text-danger',
        active && 'text-danger',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', active && 'fill-danger')} aria-hidden />
    </button>
  )
}

// ───────────────────────────── grid / shelf ───────────────────────────────

export function ProductGrid({
  products,
  wishlistIds,
  className,
}: {
  products: ProductCardData[]
  wishlistIds?: string[]
  className?: string
}) {
  const wishlist = new Set(wishlistIds ?? [])
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5',
        className,
      )}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} isWishlisted={wishlist.has(product.id)} />
      ))}
    </div>
  )
}

/** Horizontally scrolling shelf for the home page — no layout shift on mobile. */
export function ProductShelf({
  products,
  wishlistIds,
}: {
  products: ProductCardData[]
  wishlistIds?: string[]
}) {
  const wishlist = new Set(wishlistIds ?? [])
  if (products.length === 0) return null

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 scroll-thin sm:mx-0 sm:px-0">
      <div className="grid auto-cols-[minmax(160px,1fr)] grid-flow-col gap-3 sm:auto-cols-[minmax(200px,1fr)] sm:gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isWishlisted={wishlist.has(product.id)}
            className="w-[160px] sm:w-[210px]"
          />
        ))}
      </div>
    </div>
  )
}
