'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Package, Search, X } from 'lucide-react'

import { useI18n, useLocalePath } from '@/components/providers'
import { apiFetch } from '@/lib/client-api'
import { Badge } from '@/components/ui/primitives'
import { cn, formatMnt } from '@/lib/utils'

interface Suggestion {
  id: string
  slug: string
  name: string
  price: number
  discountPrice: number | null
  imageUrl: string | null
  prescriptionRequired: boolean
  inStock: boolean
  categoryName: string
}

/**
 * Header search with debounced type-ahead over name, brand, active ingredient,
 * SKU and barcode. Submitting always lands on the full results page so a
 * customer is never trapped inside the dropdown.
 */
export function SearchBar({
  className,
  autoFocus,
  onNavigate,
}: {
  className?: string
  autoFocus?: boolean
  onNavigate?: () => void
}) {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const router = useRouter()

  const [term, setTerm] = React.useState('')
  const [results, setResults] = React.useState<Suggestion[]>([])
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const trimmed = term.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const data = await apiFetch<{ items: Suggestion[] }>(
          `/api/products/suggest?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        )
        setResults(data.items)
        setOpen(true)
        setActiveIndex(-1)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [term])

  React.useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function submit(event?: React.FormEvent) {
    event?.preventDefault()
    const trimmed = term.trim()
    if (!trimmed) return
    setOpen(false)
    onNavigate?.()
    router.push(`${localePath('/products')}?q=${encodeURIComponent(trimmed)}`)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      const picked = results[activeIndex]!
      setOpen(false)
      onNavigate?.()
      router.push(localePath(`/products/${picked.slug}`))
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form onSubmit={submit} role="search">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
          <input
            type="search"
            value={term}
            autoFocus={autoFocus}
            onChange={(event) => setTerm(event.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={d.common.searchPlaceholder}
            aria-label={d.search.searchBy}
            className="h-11 w-full rounded-xl border border-ink-200 bg-ink-50/70 pl-10 pr-20 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:bg-white focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" aria-hidden /> : null}
            {term ? (
              <button
                type="button"
                onClick={() => {
                  setTerm('')
                  setResults([])
                }}
                className="rounded-lg p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                aria-label={d.common.clear}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="submit"
              className="hidden h-8 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-600 sm:block"
            >
              {d.common.search}
            </button>
          </div>
        </div>
      </form>

      {open && term.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
          {results.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-ink-800">{d.search.noResultsTitle}</p>
              <p className="mt-1 text-xs text-ink-500">{d.search.noResultsBody}</p>
            </div>
          ) : (
            <>
              <ul className="max-h-[22rem] overflow-y-auto scroll-thin">
                {results.map((item, index) => (
                  <li key={item.id}>
                    <Link
                      href={localePath(`/products/${item.slug}`)}
                      onClick={() => {
                        setOpen(false)
                        onNavigate?.()
                      }}
                      className={cn(
                        'flex items-center gap-3 border-b border-ink-100 px-3 py-2.5 last:border-0 transition-colors',
                        index === activeIndex ? 'bg-brand-50' : 'hover:bg-ink-50',
                      )}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-ink-300" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">{item.name}</span>
                        <span className="block truncate text-xs text-ink-500">{item.categoryName}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-ink-900 tabular">
                          {formatMnt(item.discountPrice ?? item.price)}
                        </span>
                        {item.prescriptionRequired ? (
                          <Badge tone="rx">{d.product.prescriptionRequiredShort}</Badge>
                        ) : !item.inStock ? (
                          <Badge tone="neutral">{d.product.outOfStock}</Badge>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => submit()}
                className="block w-full border-t border-ink-100 bg-ink-50/60 px-4 py-2.5 text-center text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
              >
                {d.search.resultsFor} “{term.trim()}” →
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
