'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

const CONTROL_BASE =
  'w-full rounded-xl border bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors ' +
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400 ' +
  'border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25'

const INVALID = 'border-danger hover:border-danger focus:border-danger focus:ring-danger/20'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leading, trailing, ...props },
  ref,
) {
  if (leading || trailing) {
    return (
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            CONTROL_BASE,
            'h-11',
            leading && 'pl-10',
            trailing && 'pr-10',
            invalid && INVALID,
            className,
          )}
          {...props}
        />
        {trailing ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">{trailing}</span>
        ) : null}
      </div>
    )
  }

  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, 'h-11', invalid && INVALID, className)}
      {...props}
    />
  )
})

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, 'py-2.5 leading-relaxed', invalid && INVALID, className)}
      {...props}
    />
  )
})

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          'h-11 appearance-none pr-9',
          invalid && INVALID,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
})

export function Label({
  children,
  htmlFor,
  required,
  hint,
  className,
}: {
  children: React.ReactNode
  htmlFor?: string
  required?: boolean
  hint?: string
  className?: string
}) {
  return (
    <label htmlFor={htmlFor} className={cn('label', className)}>
      {children}
      {required ? <span className="ml-0.5 text-danger">*</span> : null}
      {hint ? <span className="ml-1.5 font-normal text-ink-400">({hint})</span> : null}
    </label>
  )
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: {
  label?: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string | null
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  )
}

export function Checkbox({
  className,
  label,
  description,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode; description?: string }) {
  const id = props.id ?? React.useId()
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        className={cn(
          'mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-ink-300 text-brand-600',
          'focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0',
          className,
        )}
        {...props}
      />
      {label || description ? (
        <div className="min-w-0">
          {label ? (
            <label htmlFor={id} className="cursor-pointer text-sm text-ink-700">
              {label}
            </label>
          ) : null}
          {description ? <p className="text-xs text-ink-500">{description}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  name,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  name?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      {label || description ? (
        <div className="min-w-0">
          {label ? <p className="text-sm font-medium text-ink-800">{label}</p> : null}
          {description ? <p className="text-xs text-ink-500">{description}</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
          checked ? 'bg-brand-500' : 'bg-ink-300',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
      {name ? <input type="hidden" name={name} value={checked ? 'true' : 'false'} /> : null}
    </div>
  )
}

export function Radio({
  label,
  description,
  icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode
  description?: string
  icon?: React.ReactNode
}) {
  const id = props.id ?? React.useId()
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
        props.checked
          ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/20'
          : 'border-ink-200 bg-white hover:border-ink-300',
        props.disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        id={id}
        type="radio"
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer border-ink-300 text-brand-600 focus:ring-2 focus:ring-brand-500/30"
        {...props}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-ink-500">{icon}</span> : null}
          <span className="text-sm font-medium text-ink-900">{label}</span>
        </div>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{description}</p> : null}
      </div>
    </label>
  )
}
