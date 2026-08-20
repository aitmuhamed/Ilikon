import mn from './dictionaries/mn'
import en from './dictionaries/en'
import ru from './dictionaries/ru'
import type { Dictionary } from './types'
import { DEFAULT_LOCALE, coerceLocale, type Locale } from '@/lib/locale-types'

const DICTIONARIES: Record<Locale, Dictionary> = {
  mn: mn as unknown as Dictionary,
  en,
  ru,
}

/**
 * Dictionaries are plain objects bundled at build time — no async loading, so
 * Server and Client Components can both call this synchronously.
 */
export function getDictionary(locale: unknown): Dictionary {
  return DICTIONARIES[coerceLocale(locale)] ?? DICTIONARIES[DEFAULT_LOCALE]
}

/** Substitutes `{name}` placeholders: interpolate(d.cart.stockWarning, { count: 3 }) */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  )
}

export type { Dictionary }
export * from '@/lib/locale-types'
