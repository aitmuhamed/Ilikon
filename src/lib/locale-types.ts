/**
 * Locale primitives. Deliberately dependency-free so both Server and Client
 * Components (and the middleware) can import it.
 */
export const LOCALES = ['mn', 'en', 'ru'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'mn'
export const LOCALE_COOKIE = 'ilikon_locale'

export const LOCALE_META: Record<Locale, { label: string; nativeLabel: string; flag: string; htmlLang: string }> = {
  mn: { label: 'Mongolian', nativeLabel: 'Монгол', flag: '🇲🇳', htmlLang: 'mn' },
  en: { label: 'English', nativeLabel: 'English', flag: '🇬🇧', htmlLang: 'en' },
  ru: { label: 'Russian', nativeLabel: 'Русский', flag: '🇷🇺', htmlLang: 'ru' },
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function coerceLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** Prefixes a path with the active locale: `/products` → `/en/products`. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `/${locale}${clean === '/' ? '' : clean}`
}
