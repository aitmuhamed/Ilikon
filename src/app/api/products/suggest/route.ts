import { ok, route } from '@/lib/api'
import { quickSearch } from '@/lib/products'
import { coerceLocale } from '@/lib/locale-types'

/** Type-ahead for the header search box and the chatbot. */
export const GET = route({
  auth: 'public',
  rateLimit: 'search',
  async handler({ query }) {
    const term = (query.get('q') ?? '').slice(0, 120)
    const locale = coerceLocale(query.get('locale'))
    const products = await quickSearch(term, locale, 6)

    return ok({
      items: products.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        imageUrl: product.imageUrl,
        prescriptionRequired: product.prescriptionRequired,
        inStock: product.stockStatus !== 'out_of_stock',
        categoryName: product.categoryName,
      })),
    })
  },
})
