import type { Metadata } from 'next'

import { publicEnv } from './env'
import { LOCALES, type Locale } from './locale-types'
import type { Dictionary } from '@/i18n/types'

/**
 * Metadata helpers. Every page builds canonical + hreflang links from the same
 * place so the three language variants never compete with each other in search.
 */

export function absoluteUrl(path: string): string {
  const base = publicEnv.siteUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function alternateLanguages(pathWithoutLocale: string): Record<string, string> {
  const clean = pathWithoutLocale === '/' ? '' : pathWithoutLocale
  const alternates: Record<string, string> = {}
  for (const locale of LOCALES) {
    alternates[locale] = absoluteUrl(`/${locale}${clean}`)
  }
  alternates['x-default'] = absoluteUrl(`/mn${clean}`)
  return alternates
}

export function buildMetadata(input: {
  locale: Locale
  title: string
  description: string
  pathWithoutLocale: string
  imageUrl?: string | null
  noIndex?: boolean
  siteName?: string
  type?: 'website' | 'article'
}): Metadata {
  const url = absoluteUrl(`/${input.locale}${input.pathWithoutLocale === '/' ? '' : input.pathWithoutLocale}`)
  const image = input.imageUrl ?? '/og-default.svg'

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: url,
      languages: alternateLanguages(input.pathWithoutLocale),
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: input.siteName ?? 'Иликон — Уужим Эмийн Сан',
      locale: input.locale === 'mn' ? 'mn_MN' : input.locale === 'ru' ? 'ru_RU' : 'en_US',
      type: input.type ?? 'website',
      images: [{ url: image.startsWith('http') ? image : absoluteUrl(image) }],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [image.startsWith('http') ? image : absoluteUrl(image)],
    },
    robots: input.noIndex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true },
  }
}

// ───────────────────────── structured data ────────────────────────────────

export function pharmacyJsonLd(input: {
  name: string
  tagline: string
  phone: string
  email: string
  address: string
  url: string
  openingHours: { weekdays: string; saturday: string; sunday: string }
}) {
  const parseHours = (value: string) => {
    const [opens, closes] = value.split('-').map((v) => v.trim())
    return { opens: opens || '09:00', closes: closes || '21:00' }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Pharmacy',
    name: `${input.name} — ${input.tagline}`,
    telephone: input.phone,
    email: input.email,
    url: input.url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: input.address,
      addressLocality: 'Ulaanbaatar',
      addressCountry: 'MN',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        ...parseHours(input.openingHours.weekdays),
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday'],
        ...parseHours(input.openingHours.saturday),
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday'],
        ...parseHours(input.openingHours.sunday),
      },
    ],
  }
}

/**
 * Product structured data.
 *
 * Prescription-only medicines are described with `Drug` semantics and
 * explicitly marked as requiring a prescription — never as freely purchasable.
 */
export function productJsonLd(input: {
  name: string
  description: string
  sku: string
  barcode: string | null
  brand: string | null
  price: number
  currency: string
  inStock: boolean
  url: string
  imageUrl: string | null
  rating: number
  ratingCount: number
  prescriptionRequired: boolean
  activeIngredients: string | null
  manufacturer: string | null
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': input.prescriptionRequired ? ['Product', 'Drug'] : 'Product',
    name: input.name,
    description: input.description,
    sku: input.sku,
    ...(input.barcode ? { gtin: input.barcode } : {}),
    ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
    ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
    ...(input.manufacturer
      ? { manufacturer: { '@type': 'Organization', name: input.manufacturer } }
      : {}),
    offers: {
      '@type': 'Offer',
      url: input.url,
      priceCurrency: input.currency,
      price: input.price,
      availability: input.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }

  if (input.ratingCount > 0) {
    base.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.rating,
      reviewCount: input.ratingCount,
    }
  }

  if (input.prescriptionRequired) {
    base.prescriptionStatus = 'https://schema.org/PrescriptionOnly'
    if (input.activeIngredients) base.activeIngredient = input.activeIngredients
  } else {
    base.prescriptionStatus = 'https://schema.org/OTC'
  }

  return base
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function faqJsonLd(d: Dictionary) {
  const pairs: [string, string][] = [
    [d.faq.q1, d.faq.a1],
    [d.faq.q2, d.faq.a2],
    [d.faq.q3, d.faq.a3],
    [d.faq.q4, d.faq.a4],
    [d.faq.q5, d.faq.a5],
    [d.faq.q6, d.faq.a6],
    [d.faq.q7, d.faq.a7],
    [d.faq.q8, d.faq.a8],
  ]
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
}

/**
 * Serialises a JSON-LD payload for embedding in a `<script>` tag.
 *
 * `JSON.stringify` alone is NOT safe here: it does not escape `<`, so any text
 * that reaches structured data — a product name, a description, a brand — can
 * close the script element and inject markup. Product copy is editable by any
 * staff member holding `products.update`, which made that a stored-XSS path
 * against every visitor, including an administrator.
 *
 * Escaping `<`, `>` and `&` as unicode sequences keeps the JSON semantically
 * identical while making a `</script>` breakout impossible. U+2028/U+2029 are
 * escaped too: they are valid in JSON strings but are line terminators in
 * JavaScript.
 */
/**
 * U+2028 / U+2029 are valid inside a JSON string but are line terminators in
 * JavaScript, so they must be escaped too. The pattern is built from char codes
 * rather than written as a regex literal — the raw characters would terminate
 * the literal itself.
 */
const JS_LINE_TERMINATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, 'g')

export function jsonLdScript(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(JS_LINE_TERMINATORS, (char) =>
      char.charCodeAt(0) === 0x2028 ? '\\u2028' : '\\u2029',
    )
}
