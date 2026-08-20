'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Toasts. Every mutation in the app reports its outcome through here — the UX
 * requirement is that a customer never wonders whether an action succeeded.
 */

type ToastTone = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  title: string
  description?: string
  duration: number
}

interface ToastContextValue {
  toast: (input: { tone?: ToastTone; title: string; description?: string; duration?: number }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  dismiss: (id: number) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}

const TONE_CONFIG: Record<ToastTone, { icon: React.ReactNode; ring: string; bar: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-success" />,
    ring: 'ring-green-200',
    bar: 'bg-success',
  },
  error: { icon: <XCircle className="h-5 w-5 text-danger" />, ring: 'ring-red-200', bar: 'bg-danger' },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-warning" />,
    ring: 'ring-amber-200',
    bar: 'bg-warning',
  },
  info: { icon: <Info className="h-5 w-5 text-accent-600" />, ring: 'ring-accent-200', bar: 'bg-accent-500' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const nextId = React.useRef(1)

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback<ToastContextValue['toast']>(
    ({ tone = 'info', title, description, duration = 4500 }) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-3), { id, tone, title, description, duration }])
      if (duration > 0) window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description, duration: 6000 }),
      warning: (title, description) => toast({ tone: 'warning', title, description, duration: 5500 }),
      info: (title, description) => toast({ tone: 'info', title, description }),
    }),
    [toast, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:bottom-auto sm:right-0 sm:top-0 sm:items-end"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((item) => {
          const config = TONE_CONFIG[item.tone]
          return (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 overflow-hidden rounded-xl bg-white p-4 shadow-pop ring-1',
                config.ring,
              )}
            >
              <span className="mt-0.5 shrink-0">{config.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-600">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-m-1 shrink-0 rounded-lg p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
