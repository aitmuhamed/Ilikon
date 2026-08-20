import Link from 'next/link'
import { headers } from 'next/headers'
import { Home, PackageSearch, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'

/**
 * Locale-aware 404. The locale comes from the middleware header, since a
 * not-found boundary does not receive route params.
 */
export default async function LocaleNotFound() {
  const locale = coerceLocale((await headers()).get('x-locale'))
  const d = getDictionary(locale)

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        <PackageSearch className="h-8 w-8" aria-hidden />
      </span>
      <p className="mt-6 text-5xl font-extrabold text-brand-700 tabular">404</p>
      <h1 className="mt-2 text-xl font-bold text-ink-900">{d.errors.notFound}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{d.errors.notFoundBody}</p>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href={`/${locale}`}>
          <Button>
            <Home className="h-4 w-4" aria-hidden />
            {d.errors.backHome}
          </Button>
        </Link>
        <Link href={`/${locale}/products`}>
          <Button variant="outline">
            <Search className="h-4 w-4" aria-hidden />
            {d.nav.products}
          </Button>
        </Link>
      </div>
    </div>
  )
}
