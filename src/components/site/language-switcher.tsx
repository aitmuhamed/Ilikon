'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Check, Globe } from 'lucide-react'

import { useI18n } from '@/components/providers'
import { LOCALES, LOCALE_COOKIE, LOCALE_META, type Locale } from '@/lib/locale-types'
import { cn } from '@/lib/utils'

/**
 * Swaps the locale segment of the current URL, keeping the customer on the same
 * page, and remembers the choice in a cookie so the next visit opens in the
 * chosen language.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, d } = useI18n()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function switchTo(next: Locale) {
    setOpen(false)
    if (next === locale) return

    // One year: the language preference is a convenience, not tracking.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`

    const segments = (pathname || `/${locale}`).split('/')
    if (LOCALES.includes(segments[1] as Locale)) {
      segments[1] = next
    } else {
      segments.splice(1, 0, next)
    }
    router.push(segments.join('/') || `/${next}`)
    router.refresh()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={d.nav.language}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700',
          compact && 'px-2',
        )}
      >
        <Globe className="h-4 w-4" aria-hidden />
        {compact ? (
          <span className="uppercase">{locale}</span>
        ) : (
          <>
            <span aria-hidden>{LOCALE_META[locale].flag}</span>
            <span className="hidden sm:inline">{LOCALE_META[locale].nativeLabel}</span>
          </>
        )}
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-pop"
        >
          {LOCALES.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === locale}
                onClick={() => switchTo(option)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-ink-50',
                  option === locale ? 'font-semibold text-brand-700' : 'text-ink-700',
                )}
              >
                <span aria-hidden>{LOCALE_META[option].flag}</span>
                <span className="flex-1">{LOCALE_META[option].nativeLabel}</span>
                {option === locale ? <Check className="h-4 w-4 text-brand-600" aria-hidden /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
