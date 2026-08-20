import type { Metadata } from 'next'
import Link from 'next/link'
import { Heart } from 'lucide-react'

import { Card, EmptyState } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ProductGrid } from '@/components/site/product-card'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PRODUCT_CARD_SELECT, toProductCard } from '@/lib/products'
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
    title: d.account.wishlist,
    description: d.account.wishlistEmptyBody,
    pathWithoutLocale: '/account/wishlist',
    noIndex: true,
  })
}

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const session = (await getSession())!

  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: session.id },
    include: {
      items: {
        include: { product: { select: PRODUCT_CARD_SELECT } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  const products = (wishlist?.items ?? []).map((item) => toProductCard(item.product, locale))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">{d.account.wishlist}</h1>
        <span className="text-sm text-ink-500 tabular">
          {products.length} {d.cart.items}
        </span>
      </div>

      {products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title={d.account.wishlistEmpty}
            body={d.account.wishlistEmptyBody}
            action={
              <Link href={`/${locale}/products`}>
                <Button size="sm">{d.cart.continueShopping}</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <ProductGrid
          products={products}
          wishlistIds={products.map((product) => product.id)}
          className="lg:grid-cols-3 xl:grid-cols-4"
        />
      )}
    </div>
  )
}
