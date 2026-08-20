import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, Clock, ShieldCheck, Truck } from 'lucide-react'

import {
  Alert,
  Badge,
  Breadcrumbs,
  Card,
  EmptyState,
  Progress,
  SectionHeading,
  StarRating,
} from '@/components/ui/primitives'
import { ProductGrid } from '@/components/site/product-card'
import { ProductInfoTabs, ProductPurchasePanel } from '@/components/site/product-detail-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { bumpViewCount, getProductDetail } from '@/lib/products'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { breadcrumbJsonLd, buildMetadata, absoluteUrl, productJsonLd, jsonLdScript } from '@/lib/seo'
import { daysUntil, formatDate, formatMnt } from '@/lib/utils'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params
  const locale = coerceLocale(rawLocale)
  const product = await getProductDetail(slug, locale)
  if (!product) return { title: 'Not found' }

  const d = getDictionary(locale)

  return buildMetadata({
    locale,
    title: product.metaTitle || `${product.name} — ${product.packageSize ?? ''}`.trim(),
    description:
      product.metaDescription ||
      product.shortDescription ||
      `${product.name} — ${d.meta.siteName} ${d.meta.siteTagline}`,
    pathWithoutLocale: `/products/${product.slug}`,
    imageUrl: product.imageUrl,
    type: 'article',
  })
}

export default async function ProductPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params
  const locale = coerceLocale(rawLocale)
  const d = getDictionary(locale)

  const product = await getProductDetail(slug, locale)
  if (!product) notFound()

  const session = await getSession()
  const [settings, wishlisted] = await Promise.all([
    getSettings(),
    session
      ? prisma.wishlistItem
          .findFirst({
            where: { wishlist: { userId: session.id }, productId: product.id },
            select: { id: true },
          })
          .then(Boolean)
      : Promise.resolve(false),
  ])

  bumpViewCount(product.id)

  const daysToExpiry = daysUntil(product.expiryDate)
  const expiringSoon = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 90

  const infoRows = [
    { label: d.product.sku, value: product.sku },
    ...(product.barcode ? [{ label: d.product.barcode, value: product.barcode }] : []),
    ...(product.brandName ? [{ label: d.product.brand, value: product.brandName }] : []),
    ...(product.manufacturerName
      ? [{ label: d.product.manufacturer, value: product.manufacturerName }]
      : []),
    { label: d.product.category, value: product.categoryName },
    ...(product.packageSize ? [{ label: d.product.packageSize, value: product.packageSize }] : []),
    ...(product.dosageForm ? [{ label: d.product.dosageForm, value: product.dosageForm }] : []),
    ...(product.strength ? [{ label: d.product.strength, value: product.strength }] : []),
    ...(product.registrationNo
      ? [{ label: d.product.registrationNo, value: product.registrationNo }]
      : []),
    ...(product.expiryDate
      ? [{ label: d.product.expiryDate, value: formatDate(product.expiryDate, locale) }]
      : []),
    ...(product.weightGrams ? [{ label: d.product.weight, value: `${product.weightGrams} г` }] : []),
    {
      label: d.search.filterPrescription,
      value: product.prescriptionRequired ? d.product.prescriptionRequired : d.product.otc,
    },
  ]

  const jsonLd = productJsonLd({
    name: product.name,
    description: product.shortDescription ?? product.description ?? product.name,
    sku: product.sku,
    barcode: product.barcode,
    brand: product.brandName,
    price: product.effectivePrice,
    currency: settings.currency,
    inStock: product.stockStatus !== 'out_of_stock',
    url: absoluteUrl(`/${locale}/products/${product.slug}`),
    imageUrl: product.imageUrl ? absoluteUrl(product.imageUrl) : null,
    rating: product.rating,
    ratingCount: product.ratingCount,
    prescriptionRequired: product.prescriptionRequired,
    activeIngredients: product.activeIngredients,
    manufacturer: product.manufacturerName,
  })

  const breadcrumbs = breadcrumbJsonLd([
    { name: d.common.home, url: absoluteUrl(`/${locale}`) },
    { name: d.nav.products, url: absoluteUrl(`/${locale}/products`) },
    { name: product.categoryName, url: absoluteUrl(`/${locale}/categories/${product.categorySlug}`) },
    { name: product.name, url: absoluteUrl(`/${locale}/products/${product.slug}`) },
  ])

  const totalReviews = Object.values(product.ratingBreakdown).reduce((sum, n) => sum + n, 0)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript([jsonLd, breadcrumbs]) }}
      />

      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs
          className="mb-5"
          items={[
            { label: d.common.home, href: `/${locale}` },
            { label: d.nav.products, href: `/${locale}/products` },
            { label: product.categoryName, href: `/${locale}/categories/${product.categorySlug}` },
            { label: product.name },
          ]}
        />

        {/* Title block */}
        <div className="mb-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={product.prescriptionRequired ? 'rx' : 'otc'}>
              {product.prescriptionRequired ? d.product.prescriptionRequired : d.product.otc}
            </Badge>
            {product.isNew ? <Badge tone="accent">{d.product.newBadge}</Badge> : null}
            {product.isFeatured ? <Badge tone="brand">{d.product.featuredBadge}</Badge> : null}
            {expiringSoon ? (
              <Badge tone="warning" icon={<CalendarClock className="h-3 w-3" />}>
                {d.product.expiringSoon} · {daysToExpiry} {d.admin.daysLeft}
              </Badge>
            ) : null}
          </div>

          <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{product.name}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-500">
            {product.brandName ? (
              <Link
                href={`/${locale}/products?brand=${product.brandSlug}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {product.brandName}
              </Link>
            ) : null}
            {product.ratingCount > 0 ? (
              <StarRating value={product.rating} count={product.ratingCount} showValue />
            ) : (
              <span className="text-xs">{d.product.noReviews}</span>
            )}
            <span className="text-xs">
              {d.product.sku}: <span className="tabular">{product.sku}</span>
            </span>
          </div>

          {product.shortDescription ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-600">
              {product.shortDescription}
            </p>
          ) : null}
        </div>

        <ProductPurchasePanel
          productId={product.id}
          slug={product.slug}
          price={product.price}
          discountPrice={product.discountPrice}
          stock={product.stock}
          stockStatus={product.stockStatus}
          prescriptionRequired={product.prescriptionRequired}
          isWishlisted={wishlisted}
          images={product.images.length ? product.images : [{ url: product.imageUrl ?? '', alt: product.name }]}
          name={product.name}
        />

        {/* Service strip */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-3 border-brand-100 py-3.5">
            <Truck className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-ink-900">{d.home.trustDelivery}</p>
              <p className="text-ink-500">
                {formatMnt(settings.deliveryFee, locale)} ·{' '}
                {formatMnt(settings.freeDeliveryThreshold, locale)} {d.home.deliveryFreeNote}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 border-brand-100 py-3.5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-ink-900">{d.home.trustPharmacist}</p>
              <p className="text-ink-500">{d.home.trustPharmacistDesc}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 border-brand-100 py-3.5">
            <Clock className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-ink-900">{d.footer.workingHours}</p>
              <p className="text-ink-500">{settings.workingHoursWeekdays}</p>
            </div>
          </Card>
        </div>

        {/* Prescription banner, repeated below the fold for Rx items */}
        {product.prescriptionRequired ? (
          <Alert
            tone="warning"
            className="mt-6"
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

        {/* Detail tabs */}
        <div className="mt-8">
          <ProductInfoTabs
            sections={{
              info: infoRows,
              description: product.description,
              ingredients: product.ingredients,
              activeIngredients: product.activeIngredients,
              dosage: product.dosage,
              usage: product.usage,
              warnings: product.warnings,
              sideEffects: product.sideEffects,
              storage: product.storage,
            }}
            reviews={
              product.reviews.length === 0 ? (
                <EmptyState
                  icon={<AlertTriangle className="h-6 w-6" />}
                  title={d.product.noReviews}
                  body={d.product.writeReview}
                />
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-8">
                    <div className="text-center">
                      <p className="text-4xl font-extrabold text-ink-900 tabular">
                        {product.rating.toFixed(1)}
                      </p>
                      <StarRating value={product.rating} size="md" className="mt-1 justify-center" />
                      <p className="mt-1 text-xs text-ink-500">
                        {product.ratingCount} {d.product.reviewsCount}
                      </p>
                    </div>
                    <div className="min-w-52 flex-1 space-y-1.5">
                      {([5, 4, 3, 2, 1] as const).map((stars) => (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="w-3 text-xs text-ink-500 tabular">{stars}</span>
                          <Progress
                            value={totalReviews ? (product.ratingBreakdown[stars] / totalReviews) * 100 : 0}
                            className="flex-1"
                          />
                          <span className="w-6 text-right text-xs text-ink-400 tabular">
                            {product.ratingBreakdown[stars]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ul className="space-y-4">
                    {product.reviews.map((review) => (
                      <li key={review.id} className="border-t border-ink-100 pt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StarRating value={review.rating} />
                          {review.title ? (
                            <span className="text-sm font-semibold text-ink-900">{review.title}</span>
                          ) : null}
                          {review.isVerifiedBuyer ? (
                            <Badge tone="success">{d.admin.verifiedBuyer}</Badge>
                          ) : null}
                        </div>
                        {review.comment ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{review.comment}</p>
                        ) : null}
                        <p className="mt-1.5 text-xs text-ink-400">
                          {review.author} · {formatDate(review.createdAt, locale)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            }
          />
        </div>

        {/* Related */}
        {product.related.length > 0 ? (
          <section className="mt-10">
            <SectionHeading
              title={d.product.relatedProducts}
              href={`/${locale}/categories/${product.categorySlug}`}
              linkLabel={d.common.viewAll}
            />
            <ProductGrid products={product.related} />
          </section>
        ) : null}

        <Alert tone="warning" className="mt-8">
          {d.product.safetyDisclaimer}
        </Alert>
      </div>
    </>
  )
}
