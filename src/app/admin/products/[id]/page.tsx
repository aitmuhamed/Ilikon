import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/shell'
import { ProductForm } from '@/components/admin/product-form'
import {
  emptyTranslation,
  type ProductFormValues,
  type ProductTranslationInput,
} from '@/lib/product-form-types'
import { Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { LOCALES, coerceLocale, type Locale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = (await getSession())!
  if (!can(session, 'products.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      translations: true,
      inventory: true,
      relatedFrom: { select: { relatedId: true } },
      _count: { select: { orderItems: true } },
    },
  })
  if (!product) notFound()

  const [categories, brands, manufacturers, relatedOptions] = await Promise.all([
    prisma.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, parentId: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.brand.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.manufacturer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { deletedAt: null, status: 'ACTIVE', id: { not: id } },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ])

  const translations = Object.fromEntries(
    LOCALES.map((code) => {
      const row = product.translations.find((translation) => translation.locale === code)
      const value: ProductTranslationInput = row
        ? {
            name: row.name ?? '',
            shortDescription: row.shortDescription ?? '',
            description: row.description ?? '',
            ingredients: row.ingredients ?? '',
            activeIngredients: row.activeIngredients ?? '',
            dosage: row.dosage ?? '',
            usage: row.usage ?? '',
            warnings: row.warnings ?? '',
            sideEffects: row.sideEffects ?? '',
            storage: row.storage ?? '',
          }
        : emptyTranslation()
      return [code, value]
    }),
  ) as Record<Locale, ProductTranslationInput>

  const initial: ProductFormValues = {
    sku: product.sku,
    barcode: product.barcode ?? '',
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    brandId: product.brandId ?? '',
    manufacturerId: product.manufacturerId ?? '',
    prescriptionRequired: product.prescriptionRequired,
    isControlled: product.isControlled,
    price: String(product.price),
    discountPrice: product.discountPrice ? String(product.discountPrice) : '',
    costPrice: product.costPrice ? String(product.costPrice) : '',
    taxRatePct: String(product.taxRatePct),
    status: product.status,
    isFeatured: product.isFeatured,
    isNew: product.isNew,
    weightGrams: product.weightGrams ? String(product.weightGrams) : '',
    packageSize: product.packageSize ?? '',
    dosageForm: product.dosageForm ?? '',
    strength: product.strength ?? '',
    expiryDate: product.expiryDate ? product.expiryDate.toISOString().slice(0, 10) : '',
    registrationNo: product.registrationNo ?? '',
    metaTitle: product.metaTitle ?? '',
    metaDescription: product.metaDescription ?? '',
    stockQuantity: String(product.inventory?.quantity ?? 0),
    lowStockThreshold: String(product.inventory?.lowStockThreshold ?? 10),
    shelfLocation: product.inventory?.shelfLocation ?? '',
    images: product.images.map((image) => ({ fileKey: image.fileKey, alt: image.alt ?? '' })),
    relatedProductIds: product.relatedFrom.map((relation) => relation.relatedId),
    translations,
  }

  return (
    <>
      <AdminPageHeader
        title={product.name}
        subtitle={`SKU ${product.sku} · ${product._count.orderItems} ${d.cart.items}`}
        backHref="/admin/products"
        badge={
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={product.prescriptionRequired ? 'rx' : 'otc'}>
              {product.prescriptionRequired
                ? d.product.prescriptionRequiredShort
                : d.product.otcShort}
            </Badge>
            {product.deletedAt ? <Badge tone="neutral">{d.admin.archived}</Badge> : null}
          </div>
        }
        actions={
          <Link href={`/${locale}/products/${product.slug}`} target="_blank">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4" aria-hidden />
              {d.product.viewProduct}
            </Button>
          </Link>
        }
      />

      <ProductForm
        initial={initial}
        productId={product.id}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.parentId ? `— ${category.name}` : category.name,
        }))}
        brands={brands}
        manufacturers={manufacturers}
        relatedOptions={relatedOptions}
        canDelete={can(session, 'products.delete')}
        hasOrderHistory={product._count.orderItems > 0}
      />
    </>
  )
}
