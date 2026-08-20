import type { MetadataRoute } from 'next'

import { prisma } from '@/lib/prisma'
import { LOCALES } from '@/lib/locale-types'
import { absoluteUrl } from '@/lib/seo'
import { sellableWhere } from '@/lib/products'

/**
 * Sitemap covering all three languages.
 *
 * Only public, indexable routes are listed — cart, checkout, account and
 * prescription pages are excluded here and in robots.txt.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '', priority: 1, changeFrequency: 'daily' },
    { path: '/products', priority: 0.9, changeFrequency: 'daily' },
    { path: '/categories', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  ]

  const [products, categories] = await Promise.all([
    prisma.product
      .findMany({
        where: sellableWhere(),
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5000,
      })
      .catch(() => []),
    prisma.category
      .findMany({
        where: { deletedAt: null, isActive: true },
        select: { slug: true, updatedAt: true },
      })
      .catch(() => []),
  ])

  const entries: MetadataRoute.Sitemap = []

  const alternates = (path: string) => ({
    languages: Object.fromEntries(
      LOCALES.map((locale) => [locale, absoluteUrl(`/${locale}${path}`)]),
    ),
  })

  for (const locale of LOCALES) {
    for (const entry of staticPaths) {
      entries.push({
        url: absoluteUrl(`/${locale}${entry.path}`),
        lastModified: new Date(),
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: alternates(entry.path),
      })
    }

    for (const category of categories) {
      entries.push({
        url: absoluteUrl(`/${locale}/categories/${category.slug}`),
        lastModified: category.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: alternates(`/categories/${category.slug}`),
      })
    }

    for (const product of products) {
      entries.push({
        url: absoluteUrl(`/${locale}/products/${product.slug}`),
        lastModified: product.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: alternates(`/products/${product.slug}`),
      })
    }
  }

  return entries
}
