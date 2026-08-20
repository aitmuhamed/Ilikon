import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/ui/primitives'
import { CartClient } from '@/components/site/cart-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getCartSummary } from '@/lib/cart'
import { getSession } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.cart.title,
    description: d.cart.emptyBody,
    pathWithoutLocale: '/cart',
    noIndex: true, // a personal cart must never be indexed
  })
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)

  const session = await getSession()
  const cart = await getCartSummary(session?.id ?? null, locale)

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: d.common.home, href: `/${locale}` }, { label: d.cart.title }]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">{d.cart.title}</h1>
        {cart.unitCount > 0 ? (
          <p className="mt-1 text-sm text-ink-500">
            <span className="font-semibold text-ink-700 tabular">{cart.unitCount}</span> {d.cart.items}
          </p>
        ) : null}
      </div>

      <CartClient initial={cart} />
    </div>
  )
}
