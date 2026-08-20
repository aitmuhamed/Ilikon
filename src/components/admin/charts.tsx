'use client'

import * as React from 'react'

import { cn, formatMnt, formatNumber } from '@/lib/utils'

/**
 * Charts are hand-rolled SVG rather than a charting library.
 *
 * The dashboard needs four shapes (line, bars, donut, horizontal bars); drawing
 * them directly keeps the admin bundle small, renders identically on the server,
 * and avoids a dependency whose defaults would need overriding anyway.
 *
 * Palette: one brand hue for the primary series, an accent for the secondary,
 * and a fixed categorical ramp for slices — readable and colour-blind safe
 * because every series is also labelled.
 */

const SERIES = {
  primary: '#22a06b',
  primarySoft: 'rgba(34, 160, 107, 0.14)',
  secondary: '#3b95f6',
  secondarySoft: 'rgba(59, 149, 246, 0.14)',
  grid: '#e6eaee',
  axis: '#8f9aa6',
}

const CATEGORICAL = [
  '#22a06b',
  '#3b95f6',
  '#d97706',
  '#8b5cf6',
  '#0e7490',
  '#dc2626',
  '#65a30d',
  '#db2777',
]

function niceMax(value: number): number {
  if (value <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalised = value / magnitude
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10
  return step * magnitude
}

function shortLabel(label: string): string {
  // "2026-08-20" → "08/20"; "14:00" stays as-is.
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return `${label.slice(5, 7)}/${label.slice(8, 10)}`
  return label
}

// ─────────────────────────────── line chart ───────────────────────────────

export function LineChart({
  data,
  height = 220,
  valueFormat = 'money',
  locale = 'mn',
  secondaryKey,
  labels,
}: {
  data: { label: string; value: number; secondary?: number }[]
  height?: number
  valueFormat?: 'money' | 'number'
  locale?: string
  secondaryKey?: string
  labels?: { primary: string; secondary?: string }
}) {
  const [hover, setHover] = React.useState<number | null>(null)

  if (data.length === 0) {
    return <ChartEmpty height={height} />
  }

  const width = 720
  const padding = { top: 16, right: 12, bottom: 28, left: 52 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const maxValue = niceMax(
    Math.max(...data.map((point) => Math.max(point.value, point.secondary ?? 0)), 1),
  )
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0

  const x = (index: number) => padding.left + index * stepX
  const y = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight

  const path = (key: 'value' | 'secondary') =>
    data
      .map((point, index) => {
        const value = key === 'value' ? point.value : (point.secondary ?? 0)
        return `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`
      })
      .join(' ')

  const area = `${path('value')} L${x(data.length - 1).toFixed(1)},${(padding.top + innerHeight).toFixed(
    1,
  )} L${x(0).toFixed(1)},${(padding.top + innerHeight).toFixed(1)} Z`

  const format = (value: number) =>
    valueFormat === 'money' ? formatMnt(value, locale) : formatNumber(value, locale)

  const ticks = 4
  // Label density adapts to width: a 30-day series would otherwise collide.
  const labelEvery = Math.max(1, Math.ceil(data.length / 8))

  return (
    <div className="relative">
      {labels ? (
        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES.primary }} />
            <span className="text-ink-600">{labels.primary}</span>
          </span>
          {labels.secondary ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES.secondary }} />
              <span className="text-ink-600">{labels.secondary}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={labels?.primary ?? 'chart'}
      >
        {Array.from({ length: ticks + 1 }).map((_, index) => {
          const value = (maxValue / ticks) * index
          const lineY = y(value)
          return (
            <g key={index}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={lineY}
                y2={lineY}
                stroke={SERIES.grid}
                strokeWidth="1"
              />
              <text x={padding.left - 8} y={lineY + 3.5} textAnchor="end" fontSize="10" fill={SERIES.axis}>
                {valueFormat === 'money' && value >= 1000
                  ? `${Math.round(value / 1000)}k`
                  : formatNumber(Math.round(value), locale)}
              </text>
            </g>
          )
        })}

        <path d={area} fill={SERIES.primarySoft} />
        <path d={path('value')} fill="none" stroke={SERIES.primary} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {secondaryKey ? (
          <path
            d={path('secondary')}
            fill="none"
            stroke={SERIES.secondary}
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
        ) : null}

        {data.map((point, index) => (
          <g key={index}>
            {hover === index ? (
              <line
                x1={x(index)}
                x2={x(index)}
                y1={padding.top}
                y2={padding.top + innerHeight}
                stroke={SERIES.primary}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ) : null}
            <circle
              cx={x(index)}
              cy={y(point.value)}
              r={hover === index ? 4.5 : 3}
              fill="#fff"
              stroke={SERIES.primary}
              strokeWidth="2"
            />
            {/* Generous invisible hit area so hover works on touch too. */}
            <rect
              x={x(index) - stepX / 2}
              y={padding.top}
              width={Math.max(stepX, 12)}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            />
            {index % labelEvery === 0 || index === data.length - 1 ? (
              <text
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill={SERIES.axis}
              >
                {shortLabel(point.label)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      {hover !== null && data[hover] ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg bg-ink-900 px-2.5 py-1.5 text-[11px] text-white shadow-pop"
          style={{
            left: `${((x(hover) / width) * 100).toFixed(2)}%`,
            top: 0,
          }}
        >
          <p className="font-semibold">{data[hover]!.label}</p>
          <p className="tabular">{format(data[hover]!.value)}</p>
          {secondaryKey && data[hover]!.secondary !== undefined ? (
            <p className="tabular text-white/70">
              {secondaryKey}: {formatNumber(data[hover]!.secondary!, locale)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ─────────────────────────────── bar chart ────────────────────────────────

export function BarChart({
  data,
  height = 220,
  valueFormat = 'number',
  locale = 'mn',
}: {
  data: { label: string; value: number }[]
  height?: number
  valueFormat?: 'money' | 'number'
  locale?: string
}) {
  if (data.length === 0) return <ChartEmpty height={height} />

  const width = 720
  const padding = { top: 16, right: 12, bottom: 30, left: 52 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const maxValue = niceMax(Math.max(...data.map((point) => point.value), 1))
  const slot = innerWidth / data.length
  const barWidth = Math.min(38, slot * 0.62)
  const labelEvery = Math.max(1, Math.ceil(data.length / 10))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} role="img">
      {Array.from({ length: 5 }).map((_, index) => {
        const value = (maxValue / 4) * index
        const lineY = padding.top + innerHeight - (value / maxValue) * innerHeight
        return (
          <g key={index}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={lineY}
              y2={lineY}
              stroke={SERIES.grid}
            />
            <text x={padding.left - 8} y={lineY + 3.5} textAnchor="end" fontSize="10" fill={SERIES.axis}>
              {valueFormat === 'money' && value >= 1000
                ? `${Math.round(value / 1000)}k`
                : formatNumber(Math.round(value), locale)}
            </text>
          </g>
        )
      })}

      {data.map((point, index) => {
        const barHeight = (point.value / maxValue) * innerHeight
        const x = padding.left + index * slot + (slot - barWidth) / 2
        return (
          <g key={index}>
            <rect
              x={x}
              y={padding.top + innerHeight - barHeight}
              width={barWidth}
              height={Math.max(barHeight, 1)}
              rx="3"
              fill={SERIES.primary}
              opacity="0.9"
            >
              <title>{`${point.label}: ${
                valueFormat === 'money' ? formatMnt(point.value, locale) : formatNumber(point.value, locale)
              }`}</title>
            </rect>
            {index % labelEvery === 0 || index === data.length - 1 ? (
              <text
                x={x + barWidth / 2}
                y={height - 9}
                textAnchor="middle"
                fontSize="10"
                fill={SERIES.axis}
              >
                {shortLabel(point.label)}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

// ────────────────────────────── donut chart ───────────────────────────────

export function DonutChart({
  data,
  size = 180,
  valueFormat = 'money',
  locale = 'mn',
  centreLabel,
}: {
  data: { label: string; value: number }[]
  size?: number
  valueFormat?: 'money' | 'number'
  locale?: string
  centreLabel?: string
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) return <ChartEmpty height={size} />

  const radius = size / 2
  const thickness = size * 0.22
  const inner = radius - thickness
  let angle = -Math.PI / 2

  const arcs = data.map((slice, index) => {
    const share = slice.value / total
    const sweep = share * Math.PI * 2
    const start = angle
    const end = angle + sweep
    angle = end

    const point = (r: number, a: number) => `${(radius + r * Math.cos(a)).toFixed(2)},${(radius + r * Math.sin(a)).toFixed(2)}`
    const largeArc = sweep > Math.PI ? 1 : 0

    const path = [
      `M${point(radius, start)}`,
      `A${radius},${radius} 0 ${largeArc} 1 ${point(radius, end)}`,
      `L${point(inner, end)}`,
      `A${inner},${inner} 0 ${largeArc} 0 ${point(inner, start)}`,
      'Z',
    ].join(' ')

    return { path, share, colour: CATEGORICAL[index % CATEGORICAL.length]!, ...slice }
  })

  const format = (value: number) =>
    valueFormat === 'money' ? formatMnt(value, locale) : formatNumber(value, locale)

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
          {arcs.map((arc, index) => (
            <path key={index} d={arc.path} fill={arc.colour} opacity="0.92">
              <title>{`${arc.label}: ${format(arc.value)} (${(arc.share * 100).toFixed(1)}%)`}</title>
            </path>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-extrabold text-ink-900 tabular">
            {valueFormat === 'money' && total >= 1000
              ? `${Math.round(total / 1000)}k₮`
              : formatNumber(total, locale)}
          </span>
          {centreLabel ? <span className="text-[10px] text-ink-400">{centreLabel}</span> : null}
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {arcs.map((arc, index) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: arc.colour }} />
            <span className="min-w-0 flex-1 truncate text-ink-600">{arc.label}</span>
            <span className="shrink-0 font-semibold text-ink-900 tabular">{format(arc.value)}</span>
            <span className="w-10 shrink-0 text-right text-ink-400 tabular">
              {(arc.share * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─────────────────────── horizontal ranked bars ───────────────────────────

export function RankedBars({
  data,
  valueFormat = 'money',
  locale = 'mn',
  emptyLabel,
}: {
  data: { label: string; value: number; sub?: string; href?: string }[]
  valueFormat?: 'money' | 'number'
  locale?: string
  emptyLabel?: string
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-400">{emptyLabel ?? '—'}</p>
  }

  const max = Math.max(...data.map((row) => row.value), 1)
  const format = (value: number) =>
    valueFormat === 'money' ? formatMnt(value, locale) : formatNumber(value, locale)

  return (
    <ul className="space-y-2.5">
      {data.map((row, index) => (
        <li key={index}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-xs font-medium text-ink-800">
              <span className="mr-1.5 text-ink-400 tabular">{index + 1}.</span>
              {row.label}
            </span>
            <span className="shrink-0 text-xs font-bold text-ink-900 tabular">{format(row.value)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, (row.value / max) * 100)}%`,
                  background: CATEGORICAL[index % CATEGORICAL.length],
                }}
              />
            </div>
            {row.sub ? <span className="shrink-0 text-[10px] text-ink-400 tabular">{row.sub}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-ink-200 text-sm text-ink-400"
      style={{ height }}
    >
      —
    </div>
  )
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('card p-5', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
