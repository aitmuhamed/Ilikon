import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

import { Alert, Breadcrumbs, EmptyState, Pagination } from '@/components/ui/primitives'
import { ProductGrid } from '@/components/site/product-card'
import { SortControl } from '@/components/site/product-filters'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getCategoryTree, listProducts } from '@/lib/products'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { productQuerySchema } from '@/lib/validation'
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, jsonLdScript } from '@/lib/seo'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function loadCategory(slug: string, locale: string) {
  const category = await prisma.category.findFirst({
    where: { slug, deletedAt: null, isActive: true },
    include: {
      translations: true,
      parent: { include: { translations: true } },
      children: { where: { deletedAt: null, isActive: true }, include: { translations: true }, orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!category) return null

  const localise = <T extends { locale: string; name: string }>(translations: T[], fallback: string) =>
    translations.find((t) => t.locale === locale)?.name ?? fallback

  return {
    id: category.id,
    slug: category.slug,
    name: localise(category.translations, category.name),
    metaTitle: category.metaTitle,
    metaDescription: category.metaDescription,
    parent: category.parent
      ? { slug: category.parent.slug, name: localise(category.parent.translations, category.parent.name) }
      : null,
    children: category.children.map((child) => ({
      slug: child.slug,
      name: localise(child.translations, child.name),
    })),
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params
  const locale = coerceLocale(rawLocale)
  const category = await loadCategory(slug, locale)
  if (!category) return { title: 'Not found' }
  const d = getDictionary(locale)

  return buildMetadata({
    locale,
    title: category.metaTitle || category.name,
    description:
      category.metaDescription ||
      `${category.name} — ${d.meta.siteName} ${d.meta.siteTagline}. ${d.home.categoriesSubtitle}`,
    pathWithoutLocale: `/categories/${category.slug}`,
  })
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { locale: rawLocale, slug } = await params
  const locale = coerceLocale(rawLocale)
  const d = getDictionary(locale)

  const category = await loadCategory(slug, locale)
  if (!category) notFound()

  const raw = await searchParams
  const flat: Record<string, string> = { category: slug }
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') flat[key] = value
    else if (Array.isArray(value) && value[0]) flat[key] = value[0]
  }

  // Deep filtering belongs on /products, which owns the full filter UI.
  const hasAdvancedFilters = ['brand', 'minPrice', 'maxPrice', 'rating', 'q'].some((key) => flat[key])
  if (hasAdvancedFilters) {
    redirect(`/${locale}/products?${new URLSearchParams(flat).toString()}`)
  }

  const parsed = productQuerySchema.safeParse(flat)
  const query = parsed.success ? parsed.data : { category: slug }

  const session = await getSession()
  const [result, tree, wishlistIds] = await Promise.all([
    listProducts({ ...query, perPage: 24 }, locale),
    getCategoryTree(locale),
    session
      ? prisma.wishlistItem
          .findMany({ where: { wishlist: { userId: session.id } }, select: { productId: true } })
          .then((items) => items.map((item) => item.productId))
      : Promise.resolve([]),
  ])

  const siblings = category.parent
    ? (tree.find((node) => node.slug === category.parent!.slug)?.children ?? [])
    : (tree.find((node) => node.slug === category.slug)?.children ?? [])

  const breadcrumbItems = [
    { label: d.common.home, href: `/${locale}` },
    { label: d.nav.categories, href: `/${locale}/categories` },
    ...(category.parent
      ? [{ label: category.parent.name, href: `/${locale}/categories/${category.parent.slug}` }]
      : []),
    { label: category.name },
  ]

  const jsonLd = breadcrumbJsonLd([
    { name: d.common.home, url: absoluteUrl(`/${locale}`) },
    { name: d.nav.categories, url: absoluteUrl(`/${locale}/categories`) },
    { name: category.name, url: absoluteUrl(`/${locale}/categories/${category.slug}`) },
  ])

  const isPrescriptionCategory = slug === 'joroor-olgoh-em'

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs className="mb-4" items={breadcrumbItems} />

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink-900">{category.name}</h1>
            <p className="mt-1 text-sm text-ink-500">
              <span className="font-semibold text-ink-700 tabular">{result.total}</span>{' '}
              {d.search.productsFound}
            </p>
          </div>
          <SortControl />
        </div>

        {isPrescriptionCategory ? (
          <Alert
            tone="warning"
            className="mb-5"
            title={d.home.prescriptionTitle}
            action={
              <Link href={`/${locale}/prescriptions/upload`}>
                <span className="text-sm font-semibold underline">{d.prescription.uploadTitle} →</span>
              </Link>
            }
          >
            {d.home.prescriptionNotice}
          </Alert>
        ) : null}

        {/* Sub-category chips */}
        {siblings.length > 0 ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {category.parent ? (
              <Link
                href={`/${locale}/categories/${category.parent.slug}`}
                className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-sm text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                ← {category.parent.name}
              </Link>
            ) : null}
            {siblings.map((child) => (
              <Link
                key={child.slug}
                href={`/${locale}/categories/${child.slug}`}
                className={
                  child.slug === category.slug
                    ? 'rounded-full border border-brand-500 bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-700'
                    : 'rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-sm text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700'
                }
              >
                {child.name}
                <span className="ml-1.5 text-xs text-ink-400 tabular">{child.productCount}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {result.items.length === 0 ? (
          <div className="card">
            <EmptyState
              title={d.search.noResultsTitle}
              body={d.search.noResultsBody}
              action={
                <Link href={`/${locale}/products`} className="text-sm font-semibold text-brand-700 underline">
                  {d.nav.products} →
                </Link>
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
              buildHref={(page) => {
                const next = new URLSearchParams(flat)
                next.delete('category')
                next.set('page', String(page))
                return `/${locale}/categories/${slug}?${next.toString()}`
              }}
            />
          </>
        )}
      </div>
    </>
  )
}
