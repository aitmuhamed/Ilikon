'use client'

import * as React from 'react'

import { ToastProvider } from '@/components/ui/toast'
import type { Dictionary } from '@/i18n/types'
import type { Locale } from '@/lib/locale-types'

/**
 * The dictionary is resolved on the server and handed to the client tree here,
 * so client components translate without re-importing every language bundle.
 */
interface I18nValue {
  locale: Locale
  d: Dictionary
}

const I18nContext = React.createContext<I18nValue | null>(null)

export function useI18n(): I18nValue {
  const context = React.useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside <Providers>')
  return context
}

/** Prefixes a path with the active locale. */
export function useLocalePath(): (path: string) => string {
  const { locale } = useI18n()
  return React.useCallback(
    (path: string) => {
      const clean = path.startsWith('/') ? path : `/${path}`
      return `/${locale}${clean === '/' ? '' : clean}`
    },
    [locale],
  )
}

// ─────────────────────── cart badge (client cache) ────────────────────────

interface CartCountValue {
  count: number
  setCount: (value: number) => void
  refresh: () => Promise<void>
}

const CartCountContext = React.createContext<CartCountValue | null>(null)

export function useCartCount(): CartCountValue {
  const context = React.useContext(CartCountContext)
  if (!context) throw new Error('useCartCount must be used inside <Providers>')
  return context
}

function CartCountProvider({
  initialCount,
  children,
}: {
  initialCount: number
  children: React.ReactNode
}) {
  const [count, setCount] = React.useState(initialCount)

  // Keep the badge in sync when the server-rendered value changes
  // (login, checkout completion, navigation between locales).
  React.useEffect(() => setCount(initialCount), [initialCount])

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch('/api/cart/count', { credentials: 'same-origin' })
      if (!response.ok) return
      const payload = (await response.json()) as { ok: boolean; data?: { count: number } }
      if (payload.ok && payload.data) setCount(payload.data.count)
    } catch {
      // A stale badge is preferable to an error toast here.
    }
  }, [])

  const value = React.useMemo(() => ({ count, setCount, refresh }), [count, refresh])
  return <CartCountContext.Provider value={value}>{children}</CartCountContext.Provider>
}

export function Providers({
  locale,
  dictionary,
  cartCount,
  children,
}: {
  locale: Locale
  dictionary: Dictionary
  cartCount: number
  children: React.ReactNode
}) {
  const i18n = React.useMemo(() => ({ locale, d: dictionary }), [locale, dictionary])

  return (
    <I18nContext.Provider value={i18n}>
      <ToastProvider>
        <CartCountProvider initialCount={cartCount}>{children}</CartCountProvider>
      </ToastProvider>
    </I18nContext.Provider>
  )
}
