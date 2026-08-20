'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { useI18n } from '@/components/providers'
import { cn } from '@/lib/utils'

/**
 * Admin table shell.
 *
 * Tables scroll horizontally inside their own container rather than pushing the
 * page wide, and collapse to a card list on narrow screens where a row would be
 * unreadable.
 */
export function DataTable({
  head,
  children,
  empty,
  isEmpty,
  className,
}: {
  head: React.ReactNode
  children: React.ReactNode
  empty?: string
  isEmpty?: boolean
  className?: string
}) {
  const { d } = useI18n()

  if (isEmpty) {
    return (
      <div className="card">
        <p className="py-12 text-center text-sm text-ink-400">{empty ?? d.admin.emptyTable}</p>
      </div>
    )
  }

  return (
    <div className={cn('card overflow-hidden p-0', className)}>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50/60 text-left">{head}</tr>
          </thead>
          <tbody className="divide-y divide-ink-100">{children}</tbody>
        </table>
      </div>
    </div>
  )
}

export function Th({
  children,
  className,
  align = 'left',
}: {
  children?: React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  align = 'left',
}: {
  children?: React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <td
      className={cn(
        'px-3.5 py-3 align-middle text-ink-700',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function Tr({
  children,
  className,
  href,
}: {
  children: React.ReactNode
  className?: string
  href?: string
}) {
  const router = useRouter()
  return (
    <tr
      className={cn('transition-colors hover:bg-brand-50/40', href && 'cursor-pointer', className)}
      onClick={href ? () => router.push(href) : undefined}
    >
      {children}
    </tr>
  )
}

// ───────────────────────── filters & pagination ───────────────────────────

/** Debounced search box that writes `q` into the URL. */
export function TableSearch({
  placeholder,
  paramName = 'q',
  className,
}: {
  placeholder?: string
  paramName?: string
  className?: string
}) {
  const { d } = useI18n()
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = React.useState(params.get(paramName) ?? '')

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value.trim()) next.set(paramName, value.trim())
      else next.delete(paramName)
      next.delete('page')
      const query = next.toString()
      if (query !== params.toString()) {
        router.replace(`${window.location.pathname}${query ? `?${query}` : ''}`)
      }
    }, 320)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden
      />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder ?? d.admin.searchPlaceholder}
        className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-8 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        aria-label={placeholder ?? d.admin.searchPlaceholder}
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100"
          aria-label={d.common.clear}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

/** Pill filter row that writes a single param into the URL. */
export function FilterPills({
  paramName,
  options,
  className,
}: {
  paramName: string
  options: { value: string; label: string; count?: number }[]
  className?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const current = params.get(paramName) ?? options[0]?.value ?? 'all'

  function select(value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === (options[0]?.value ?? 'all')) next.delete(paramName)
    else next.set(paramName, value)
    next.delete('page')
    const query = next.toString()
    router.push(`${window.location.pathname}${query ? `?${query}` : ''}`)
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((option) => {
        const active = current === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={cn('tabular', active ? 'text-brand-600' : 'text-ink-400')}>
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Preset + custom date range, driving `range`, `from` and `to` params. */
export function DateRangeFilter({ className }: { className?: string }) {
  const { d } = useI18n()
  const router = useRouter()
  const params = useSearchParams()
  const current = params.get('range') ?? 'today'
  const [showCustom, setShowCustom] = React.useState(current === 'custom')
  const [from, setFrom] = React.useState(params.get('from') ?? '')
  const [to, setTo] = React.useState(params.get('to') ?? '')

  const presets = [
    { value: 'today', label: d.admin.today },
    { value: 'yesterday', label: d.admin.yesterday },
    { value: '7d', label: d.admin.last7Days },
    { value: '30d', label: d.admin.last30Days },
    { value: 'month', label: d.admin.thisMonth },
  ]

  function apply(range: string, fromValue?: string, toValue?: string) {
    const next = new URLSearchParams(params.toString())
    next.set('range', range)
    if (range === 'custom' && fromValue && toValue) {
      next.set('from', fromValue)
      next.set('to', toValue)
    } else {
      next.delete('from')
      next.delete('to')
    }
    router.push(`${window.location.pathname}?${next.toString()}`)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {presets.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => {
            setShowCustom(false)
            apply(preset.value)
          }}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            current === preset.value
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300',
          )}
        >
          {preset.label}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
          current === 'custom'
            ? 'border-brand-500 bg-brand-50 text-brand-700'
            : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300',
        )}
      >
        <Calendar className="h-3.5 w-3.5" aria-hidden />
        {d.admin.customRange}
      </button>

      {showCustom ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white p-2">
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 w-36"
            aria-label={d.admin.startDate}
          />
          <span className="text-ink-400">—</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 w-36"
            aria-label={d.admin.endDate}
          />
          <Button size="sm" onClick={() => apply('custom', from, to)} disabled={!from || !to}>
            {d.common.apply}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function TablePagination({
  page,
  totalPages,
  total,
  className,
}: {
  page: number
  totalPages: number
  total: number
  className?: string
}) {
  const { d } = useI18n()
  const params = useSearchParams()

  if (totalPages <= 1) {
    return (
      <p className={cn('px-1 pt-3 text-xs text-ink-400 tabular', className)}>
        {total} {d.common.results}
      </p>
    )
  }

  const href = (target: number) => {
    const next = new URLSearchParams(params.toString())
    next.set('page', String(target))
    return `?${next.toString()}`
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 pt-3', className)}>
      <p className="text-xs text-ink-400 tabular">
        {d.common.page} {page} / {totalPages} · {total} {d.common.results}
      </p>
      <div className="flex items-center gap-1.5">
        <Link
          href={href(Math.max(1, page - 1))}
          aria-disabled={page === 1}
          className={cn(
            'rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-600 transition-colors hover:border-brand-300',
            page === 1 && 'pointer-events-none opacity-40',
          )}
        >
          ‹ {d.common.previous}
        </Link>
        <Link
          href={href(Math.min(totalPages, page + 1))}
          aria-disabled={page === totalPages}
          className={cn(
            'rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-600 transition-colors hover:border-brand-300',
            page === totalPages && 'pointer-events-none opacity-40',
          )}
        >
          {d.common.next} ›
        </Link>
      </div>
    </div>
  )
}

/** Simple select bound to a URL param — used for per-page and sort controls. */
export function ParamSelect({
  paramName,
  options,
  label,
  className,
}: {
  paramName: string
  options: { value: string; label: string }[]
  label?: string
  className?: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  return (
    <div className={cn('w-40', className)}>
      <Select
        aria-label={label}
        value={params.get(paramName) ?? options[0]?.value ?? ''}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString())
          next.set(paramName, event.target.value)
          next.delete('page')
          router.push(`${window.location.pathname}?${next.toString()}`)
        }}
        className="h-10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
