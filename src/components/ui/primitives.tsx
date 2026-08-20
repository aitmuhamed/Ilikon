import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Loader2, Star, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

// ─────────────────────────────── badge ────────────────────────────────────

type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'rx'
  | 'otc'
  | 'outline'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  accent: 'bg-accent-50 text-accent-700 ring-1 ring-accent-200',
  success: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  // Prescription vs over-the-counter must be visually unmistakable.
  rx: 'bg-accent-600 text-white',
  otc: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  outline: 'border border-ink-300 text-ink-600',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  className?: string
  icon?: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5',
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

// ─────────────────────────────── card ─────────────────────────────────────

export function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode
  className?: string
  padded?: boolean
}) {
  return <div className={cn('card', padded && 'p-5', className)}>{children}</div>
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

// ─────────────────────────────── alert ────────────────────────────────────

type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'brand'

const ALERT_TONES: Record<AlertTone, { wrap: string; icon: React.ReactNode }> = {
  info: { wrap: 'bg-accent-50 text-accent-900 border-accent-200', icon: <Info className="h-5 w-5 text-accent-600" /> },
  success: {
    wrap: 'bg-green-50 text-green-900 border-green-200',
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
  },
  warning: {
    wrap: 'bg-amber-50 text-amber-900 border-amber-200',
    icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  },
  danger: { wrap: 'bg-red-50 text-red-900 border-red-200', icon: <XCircle className="h-5 w-5 text-red-600" /> },
  brand: { wrap: 'bg-brand-50 text-brand-900 border-brand-200', icon: <Info className="h-5 w-5 text-brand-600" /> },
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: AlertTone
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  const config = ALERT_TONES[tone]
  return (
    <div className={cn('flex gap-3 rounded-xl border p-4', config.wrap, className)} role="status">
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn('leading-relaxed', title && 'mt-1 opacity-90')}>{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  )
}

// ───────────────────────────── skeletons ──────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden p-0">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cn('h-10 flex-1', c === 0 && 'max-w-[52px]')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-500', className)} aria-hidden />
}

// ─────────────────────────── empty / error states ─────────────────────────

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  body?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-ink-500">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

// ───────────────────────────── star rating ────────────────────────────────

export function StarRating({
  value,
  count,
  size = 'sm',
  showValue = false,
  className,
}: {
  value: number
  count?: number
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  className?: string
}) {
  const dimension = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center gap-0.5" aria-label={`${value} / 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              dimension,
              star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-ink-200 text-ink-200',
            )}
            aria-hidden
          />
        ))}
      </div>
      {showValue && value > 0 ? (
        <span className="text-xs font-medium text-ink-700 tabular">{value.toFixed(1)}</span>
      ) : null}
      {count !== undefined ? <span className="text-xs text-ink-400 tabular">({count})</span> : null}
    </div>
  )
}

// ────────────────────────────── breadcrumbs ───────────────────────────────

export function Breadcrumbs({
  items,
  className,
}: {
  items: { label: string; href?: string }[]
  className?: string
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1 text-sm', className)}>
      {items.map((item, index) => (
        <React.Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden /> : null}
          {item.href && index < items.length - 1 ? (
            <Link href={item.href} className="text-ink-500 transition-colors hover:text-brand-600">
              {item.label}
            </Link>
          ) : (
            <span className={index === items.length - 1 ? 'font-medium text-ink-800' : 'text-ink-500'}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

// ────────────────────────── section heading ───────────────────────────────

export function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel,
  icon,
  className,
}: {
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="section-title flex items-center gap-2">
          {icon ? <span className="text-brand-500">{icon}</span> : null}
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          {linkLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  )
}

// ─────────────────────────────── progress ─────────────────────────────────

export function Progress({
  value,
  tone = 'brand',
  className,
}: {
  value: number
  tone?: 'brand' | 'warning' | 'danger' | 'accent'
  className?: string
}) {
  const tones = {
    brand: 'bg-brand-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    accent: 'bg-accent-500',
  }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

// ─────────────────────────────── pagination ───────────────────────────────

export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: {
  page: number
  totalPages: number
  buildHref: (page: number) => string
  className?: string
}) {
  if (totalPages <= 1) return null

  // Compact window: first, last, and up to two neighbours either side.
  const pages = new Set<number>([1, totalPages, page])
  for (let offset = 1; offset <= 2; offset += 1) {
    if (page - offset >= 1) pages.add(page - offset)
    if (page + offset <= totalPages) pages.add(page + offset)
  }
  const ordered = [...pages].sort((a, b) => a - b)

  return (
    <nav className={cn('flex items-center justify-center gap-1.5', className)} aria-label="Pagination">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          'flex h-10 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700',
          page === 1 && 'pointer-events-none opacity-40',
        )}
      >
        ‹
      </Link>
      {ordered.map((p, index) => (
        <React.Fragment key={p}>
          {index > 0 && p - ordered[index - 1]! > 1 ? (
            <span className="px-1 text-ink-400">…</span>
          ) : null}
          <Link
            href={buildHref(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors',
              p === page
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700',
            )}
          >
            {p}
          </Link>
        </React.Fragment>
      ))}
      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={cn(
          'flex h-10 items-center rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700',
          page === totalPages && 'pointer-events-none opacity-40',
        )}
      >
        ›
      </Link>
    </nav>
  )
}

// ─────────────────────── stock / status indicators ────────────────────────

export function StockIndicator({
  status,
  labels,
  stock,
  showCount = false,
}: {
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  labels: { inStock: string; lowStock: string; outOfStock: string; stockCount: string }
  stock?: number
  showCount?: boolean
}) {
  const config = {
    in_stock: { dot: 'bg-success', text: 'text-success', label: labels.inStock },
    low_stock: { dot: 'bg-warning', text: 'text-warning', label: labels.lowStock },
    out_of_stock: { dot: 'bg-ink-400', text: 'text-ink-500', label: labels.outOfStock },
  }[status]

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', config.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} aria-hidden />
      {config.label}
      {showCount && status !== 'out_of_stock' && stock !== undefined ? (
        <span className="text-ink-400 tabular">
          · {stock} {labels.stockCount}
        </span>
      ) : null}
    </span>
  )
}

/** Colour mapping shared by the customer timeline and the admin order table. */
export const ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  NEW: 'accent',
  CONFIRMING: 'warning',
  PREPARING: 'brand',
  SHIPPED: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

export const PAYMENT_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'neutral',
  AWAITING_CONFIRMATION: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  CANCELLED: 'danger',
}

export const PRESCRIPTION_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
  CLARIFICATION_REQUESTED: 'accent',
  EXPIRED: 'neutral',
}

export const PRODUCT_STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'neutral',
}
