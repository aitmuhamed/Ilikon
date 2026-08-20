import type { Metadata } from 'next'
import { Search, SearchX } from 'lucide-react'

import { Breadcrumbs, EmptyState, Pagination } from '@/components/ui/primitives'
import { ProductGrid } from '@/components/site/product-card'
import { ProductFilters, SortControl } from '@/components/site/product-filters'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getBrandOptions, getCategoryTree, getPriceBounds, listProducts } from '@/lib/products'
import { productQuerySchema } from '@/lib/validation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildMetadata } from '@/lib/seo'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const query = await searchParams
  const term = typeof query.q === 'string' ? query.q : ''

  return buildMetadata({
    locale,
    title: term ? `${d.search.resultsFor} ${term}` : d.nav.products,
    description: term ? `${d.search.searchBy}: ${term}` : d.meta.defaultDescription,
    pathWithoutLocale: '/products',
    // Filtered and paginated permutations are not worth indexing.
    noIndex: Object.keys(query).length > 0,
  })
}

export default async function ProductsPage({ params, searchParams }: PageProps) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const raw = await searchParams

  const flat: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') flat[key] = value
    else if (Array.isArray(value) && value[0]) flat[key] = value[0]
  }

  const parsed = productQuerySchema.safeParse(flat)
  const query = parsed.success ? parsed.data : {}

  const session = await getSession()

  const [result, categories, brands, priceBounds, wishlistIds] = await Promise.all([
    listProducts({ ...query, perPage: query.perPage ?? 24 }, locale),
    getCategoryTree(locale),
    getBrandOptions(),
    getPriceBounds(),
    session
      ? prisma.wishlistItem
          .findMany({ where: { wishlist: { userId: session.id } }, select: { productId: true } })
          .then((items) => items.map((item) => item.productId))
      : Promise.resolve([]),
  ])

  const buildHref = (page: number) => {
    const next = new URLSearchParams(flat)
    next.set('page', String(page))
    return `/${locale}/products?${next.toString()}`
  }

  const activeCategory = query.category
    ? categories
        .flatMap((c) => [c, ...c.children])
        .find((c) => c.slug === query.category)
    : undefined

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: d.common.home, href: `/${locale}` },
          { label: d.nav.products, href: `/${locale}/products` },
          ...(activeCategory ? [{ label: activeCategory.name }] : []),
          ...(query.q ? [{ label: `“${query.q}”` }] : []),
        ]}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink-900">
            {query.q ? (
              <>
                {d.search.resultsFor} <span className="text-brand-700">“{query.q}”</span>
              </>
            ) : (
              (activeCategory?.name ?? d.nav.products)
            )}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            <span className="font-semibold text-ink-700 tabular">{result.total}</span>{' '}
            {d.search.productsFound}
            {query.prescription === 'rx' ? ` · ${d.product.prescriptionRequired}` : ''}
            {query.prescription === 'otc' ? ` · ${d.product.otc}` : ''}
          </p>
        </div>
        <div className="hidden lg:block">
          <SortControl />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[276px_minmax(0,1fr)]">
        <ProductFilters
          categories={categories}
          brands={brands}
          priceBounds={priceBounds}
          total={result.total}
        />

        <div className="min-w-0">
          {result.items.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<SearchX className="h-6 w-6" />}
                title={d.search.noResultsTitle}
                body={d.search.noResultsBody}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <a href={`/${locale}/products`}>
                      <Button variant="outline" size="sm">
                        {d.search.clearFilters}
                      </Button>
                    </a>
                    <a href={`/${locale}/categories`}>
                      <Button size="sm">
                        <Search className="h-4 w-4" aria-hidden />
                        {d.nav.categories}
                      </Button>
                    </a>
                  </div>
                }
              />
            </div>
          ) : (
            <>
              <ProductGrid products={result.items} wishlistIds={wishlistIds} />
              <Pagination
                className="mt-8"
                page={result.page}
                totalPages={result.totalPages}
                buildHref={buildHref}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
