'use client'

import * as React from 'react'
import { AlertTriangle, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './button'

/**
 * Lightweight modal built on the native <dialog> semantics we need
 * (focus trap, Escape, scroll lock) without pulling in a UI library.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)

  /**
   * `onClose` is almost always an inline arrow (`onClose={() => setForm(null)}`),
   * so it has a new identity on every render. Holding it in a ref keeps the
   * effects below from depending on it.
   *
   * This is not a micro-optimisation. When the effects depended on `onClose`,
   * every keystroke inside the dialog re-ran them, and the autofocus timer
   * fired again 30ms later and yanked focus back to the first field — so typing
   * a single character appeared to dismiss the form. Autofocus must happen when
   * the dialog opens, and never again.
   */
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Escape to close, Tab to cycle focus inside the panel.
  React.useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      // Keep keyboard focus inside the dialog while it is open.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Scroll lock, tied only to open/close.
  React.useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // Initial focus — once per opening.
  React.useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('[data-autofocus], button, input, select, textarea, a[href]')
        ?.focus()
    }, 30)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-ink-900/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'relative z-10 flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl',
          widths[size],
          className,
        )}
      >
        {title ? (
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink-900">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-ink-500">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-m-1.5 shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Destructive-action guard. Used before deleting products, cancelling orders,
 * clearing carts — anything the user cannot undo.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  loading,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Return value is ignored — `unknown` keeps `() => x && save(x)` callers valid. */
  onConfirm: () => unknown
  title: string
  body?: string
  confirmLabel: string
  cancelLabel: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  children?: React.ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
            data-autofocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5 py-1">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            tone === 'danger' ? 'bg-red-50 text-danger' : 'bg-brand-50 text-brand-600',
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">{title}</p>
          {body ? <p className="mt-1 text-sm leading-relaxed text-ink-600">{body}</p> : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </Modal>
  )
}

/** Slide-over panel — used for the cart drawer and admin quick-edit forms. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string
}) {
  // Same reason as `Modal`: callers pass an inline `onClose`, so keeping it in
  // a ref stops this effect from tearing down and re-registering on every
  // render of the drawer's contents.
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  React.useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/45" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex h-full w-full animate-slide-in-right flex-col bg-white shadow-pop',
          width,
        )}
      >
        {title ? (
          <div className="flex items-center justify-between gap-4 border-b border-ink-100 px-5 py-4">
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="-m-1.5 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">{children}</div>
        {footer ? <div className="border-t border-ink-100 bg-white px-5 py-4">{footer}</div> : null}
      </aside>
    </div>
  )
}
