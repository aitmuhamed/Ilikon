'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, Star, X } from 'lucide-react'

import { useI18n, useLocalePath } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/primitives'
import { Checkbox, Select } from '@/components/ui/field'
import { cn, formatMnt } from '@/lib/utils'
import type { CategoryNode } from '@/lib/products'

interface FilterProps {
  categories: CategoryNode[]
  brands: { slug: string; name: string; count: number }[]
  priceBounds: { min: number; max: number }
  total: number
}

/**
 * Filters write straight to the URL, so a filtered view is shareable,
 * bookmarkable and server-rendered — no client-side catalogue state to drift.
 */
export function ProductFilters({ categories, brands, priceBounds, total }: FilterProps) {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const router = useRouter()
  const params = useSearchParams()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const current = {
    category: params.get('category') ?? '',
    brands: (params.get('brand') ?? '').split(',').filter(Boolean),
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    inStock: params.get('inStock') === '1',
    prescription: params.get('prescription') ?? 'all',
    discount: params.get('discount') === '1',
    rating: params.get('rating') ?? '',
    q: params.get('q') ?? '',
    sort: params.get('sort') ?? 'popular',
  }

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    next.delete('page') // any filter change returns to page one
    router.push(`${localePath('/products')}?${next.toString()}`)
  }

  function toggleBrand(slug: string) {
    const set = new Set(current.brands)
    if (set.has(slug)) set.delete(slug)
    else set.add(slug)
    apply({ brand: set.size ? [...set].join(',') : null })
  }

  const activeCount =
    (current.category ? 1 : 0) +
    current.brands.length +
    (current.minPrice || current.maxPrice ? 1 : 0) +
    (current.inStock ? 1 : 0) +
    (current.prescription !== 'all' ? 1 : 0) +
    (current.discount ? 1 : 0) +
    (current.rating ? 1 : 0)

  const flatCategories: { slug: string; name: string; count: number; depth: number }[] = []
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      flatCategories.push({ slug: node.slug, name: node.name, count: node.productCount, depth })
      if (node.children.length) walk(node.children, depth + 1)
    }
  }
  walk(categories, 0)

  const panel = (
    <div className="space-y-6">
      {/* Category */}
      <FilterGroup title={d.search.filterCategory}>
        <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1 scroll-thin">
          <button
            type="button"
            onClick={() => apply({ category: null })}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
              !current.category ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-600 hover:bg-ink-50',
            )}
          >
            {d.common.all}
          </button>
          {flatCategories.map((category) => (
            <button
              key={category.slug}
              type="button"
              onClick={() => apply({ category: category.slug })}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                current.category === category.slug
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-ink-600 hover:bg-ink-50',
              )}
              style={{ paddingLeft: `${10 + category.depth * 14}px` }}
            >
              <span className="truncate">{category.name}</span>
              <span className="shrink-0 text-xs text-ink-400 tabular">{category.count}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      {/* Prescription / OTC — the most safety-relevant filter, kept high up */}
      <FilterGroup title={d.search.filterPrescription}>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 'all', label: d.common.all },
            { value: 'otc', label: d.product.otc },
            { value: 'rx', label: d.product.prescriptionRequired },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => apply({ prescription: option.value === 'all' ? null : option.value })}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                current.prescription === option.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-ink-200 text-ink-600 hover:border-ink-300',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </FilterGroup>

      {/* Price */}
      <FilterGroup title={d.search.filterPrice}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            defaultValue={current.minPrice}
            placeholder={String(priceBounds.min)}
            min={0}
            onBlur={(event) => apply({ minPrice: event.target.value || null })}
            className="h-10 w-full rounded-lg border border-ink-300 px-2.5 text-sm tabular focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            aria-label={d.common.from}
          />
          <span className="text-ink-400">—</span>
          <input
            type="number"
            defaultValue={current.maxPrice}
            placeholder={String(priceBounds.max)}
            min={0}
            onBlur={(event) => apply({ maxPrice: event.target.value || null })}
            className="h-10 w-full rounded-lg border border-ink-300 px-2.5 text-sm tabular focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            aria-label={d.common.to}
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-400">
          {formatMnt(priceBounds.min)} — {formatMnt(priceBounds.max)}
        </p>
      </FilterGroup>

      {/* Brand */}
      {brands.length > 0 ? (
        <FilterGroup title={d.search.filterBrand}>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1 scroll-thin">
            {brands.map((brand) => (
              <Checkbox
                key={brand.slug}
                checked={current.brands.includes(brand.slug)}
                onChange={() => toggleBrand(brand.slug)}
                label={
                  <span className="flex items-center gap-1.5">
                    {brand.name}
                    <span className="text-xs text-ink-400 tabular">({brand.count})</span>
                  </span>
                }
              />
            ))}
          </div>
        </FilterGroup>
      ) : null}

      {/* Availability & discount */}
      <FilterGroup title={d.search.filterAvailability}>
        <div className="space-y-2.5">
          <Checkbox
            checked={current.inStock}
            onChange={(event) => apply({ inStock: event.target.checked ? '1' : null })}
            label={d.search.filterInStockOnly}
          />
          <Checkbox
            checked={current.discount}
            onChange={(event) => apply({ discount: event.target.checked ? '1' : null })}
            label={d.search.filterDiscountOnly}
          />
        </div>
      </FilterGroup>

      {/* Rating */}
      <FilterGroup title={d.search.filterRating}>
        <div className="space-y-0.5">
          {[4, 3, 2].map((stars) => (
            <button
              key={stars}
              type="button"
              onClick={() => apply({ rating: current.rating === String(stars) ? null : String(stars) })}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                current.rating === String(stars)
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className={cn(
                      'h-3.5 w-3.5',
                      index < stars ? 'fill-amber-400 text-amber-400' : 'fill-ink-200 text-ink-200',
                    )}
                  />
                ))}
              </span>
              <span className="text-xs">{d.search.filterRatingAndUp}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      {activeCount > 0 ? (
        <Button
          variant="outline"
          size="sm"
          fullWidth
          onClick={() =>
            router.push(`${localePath('/products')}${current.q ? `?q=${encodeURIComponent(current.q)}` : ''}`)
          }
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          {d.search.clearFilters}
        </Button>
      ) : null}
    </div>
  )

  return (
    <>
      {/* Mobile trigger + sort row */}
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {d.common.filters}
          {activeCount > 0 ? <Badge tone="brand">{activeCount}</Badge> : null}
        </Button>
        <SortSelect value={current.sort} onChange={(value) => apply({ sort: value })} className="ml-auto" />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="card sticky top-32 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">{d.common.filters}</h2>
            <span className="text-xs text-ink-400 tabular">
              {total} {d.common.results}
            </span>
          </div>
          {panel}
        </div>
      </aside>

      {/* Mobile sheet */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-ink-900/45" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 max-h-[86dvh] animate-slide-up overflow-hidden rounded-t-2xl bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <h2 className="text-base font-semibold text-ink-900">{d.common.filters}</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
                aria-label={d.common.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[62dvh] overflow-y-auto px-5 py-4 scroll-thin">{panel}</div>
            <div className="border-t border-ink-100 p-4">
              <Button fullWidth onClick={() => setMobileOpen(false)}>
                {total} {d.common.results} — {d.common.apply}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</h3>
      {children}
    </div>
  )
}

export function SortSelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const { d } = useI18n()
  const options = [
    { value: 'popular', label: d.search.sortPopular },
    { value: 'newest', label: d.search.sortNewest },
    { value: 'price_asc', label: d.search.sortPriceAsc },
    { value: 'price_desc', label: d.search.sortPriceDesc },
    { value: 'discount', label: d.search.sortDiscount },
    { value: 'rating', label: d.search.sortRating },
    { value: 'name', label: d.search.sortName },
  ]

  return (
    <div className={cn('w-44', className)}>
      <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label={d.common.sort}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  )
}

/** Thin client wrapper so the server page can render a sort control. */
export function SortControl() {
  const router = useRouter()
  const params = useSearchParams()
  const localePath = useLocalePath()

  return (
    <SortSelect
      value={params.get('sort') ?? 'popular'}
      onChange={(value) => {
        const next = new URLSearchParams(params.toString())
        next.set('sort', value)
        next.delete('page')
        router.push(`${localePath('/products')}?${next.toString()}`)
      }}
    />
  )
}
