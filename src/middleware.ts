import { NextResponse, type NextRequest } from 'next/server'

import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, type Locale } from '@/lib/locale-types'

/**
 * Locale routing.
 *
 * Storefront URLs always carry a locale segment (`/mn/products/...`) so each
 * language has a canonical, cacheable, indexable URL. A bare path is redirected
 * to the visitor's remembered choice, then their `Accept-Language`, then
 * Mongolian.
 *
 * The resolved locale is also forwarded as an `x-locale` request header so the
 * root layout can set `<html lang>` correctly — including on `/admin`, which is
 * deliberately locale-free in the URL.
 */

const LOCALE_HEADER = 'x-locale'
const PUBLIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|ico|txt|xml|webmanifest|js|css|map|woff2?)$/i

/**
 * Resolves the locale for a URL that carries no locale segment.
 *
 * Mongolian is the pharmacy's default and is what a first-time visitor gets,
 * regardless of their browser language. `Accept-Language` is deliberately *not*
 * consulted: most devices in Mongolia ship with an `en-US` browser, so honouring
 * the header sent local customers to the English storefront by default.
 *
 * An explicit choice still wins — the language switcher writes the locale
 * cookie, and that is what this reads.
 */
function detectLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookie && LOCALES.includes(cookie as Locale)) return cookie as Locale

  return DEFAULT_LOCALE
}

function withLocaleHeader(request: NextRequest, locale: Locale) {
  const headers = new Headers(request.headers)
  headers.set(LOCALE_HEADER, locale)
  return NextResponse.next({ request: { headers } })
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/_next') || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next()
  }

  // API and admin keep locale-free URLs; they still get the header.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt'
  ) {
    return withLocaleHeader(request, detectLocale(request))
  }

  const segments = pathname.split('/')
  const first = segments[1]

  if (first && LOCALES.includes(first as Locale)) {
    const locale = first as Locale
    const response = withLocaleHeader(request, locale)
    // Keep the cookie in step with the URL the visitor is actually on.
    if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
      response.cookies.set(LOCALE_COOKIE, locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      })
    }
    return response
  }

  const locale = detectLocale(request)
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`
  url.search = search
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
