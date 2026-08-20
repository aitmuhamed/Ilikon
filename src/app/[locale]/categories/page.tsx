import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Package } from 'lucide-react'

import { Breadcrumbs, Card } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getCategoryTree } from '@/lib/products'
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
    title: d.nav.categories,
    description: d.home.categoriesSubtitle,
    pathWithoutLocale: '/categories',
  })
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const categories = await getCategoryTree(locale)

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: d.common.home, href: `/${locale}` }, { label: d.nav.categories }]}
      />

      <h1 className="text-2xl font-bold text-ink-900">{d.home.categoriesTitle}</h1>
      <p className="mt-1 text-sm text-ink-500">{d.home.categoriesSubtitle}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id} className="flex flex-col">
            <Link
              href={`/${locale}/categories/${category.slug}`}
              className="group flex items-center gap-3"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-brand-600">
                {category.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink-900 transition-colors group-hover:text-brand-700">
                  {category.name}
                </span>
                <span className="block text-xs text-ink-500 tabular">
                  {category.productCount} {d.nav.products.toLowerCase()}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>

            {category.children.length > 0 ? (
              <ul className="mt-3 space-y-0.5 border-t border-ink-100 pt-3">
                {category.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/${locale}/categories/${child.slug}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      <span className="truncate">{child.name}</span>
                      <span className="shrink-0 text-xs text-ink-400 tabular">{child.productCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  )
}
