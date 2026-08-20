import { notFound } from 'next/navigation'

import { AdminPageHeader } from '@/components/admin/shell'
import { ProductForm } from '@/components/admin/product-form'
import { emptyProduct } from '@/lib/product-form-types'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function NewProductPage() {
  const session = (await getSession())!
  if (!can(session, 'products.create')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)

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
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ])

  return (
    <>
      <AdminPageHeader
        title={d.admin.newProduct}
        subtitle={d.admin.productBasics}
        backHref="/admin/products"
      />
      <ProductForm
        initial={emptyProduct()}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.parentId ? `— ${category.name}` : category.name,
        }))}
        brands={brands}
        manufacturers={manufacturers}
        relatedOptions={relatedOptions}
        canDelete={false}
        hasOrderHistory={false}
      />
    </>
  )
}
