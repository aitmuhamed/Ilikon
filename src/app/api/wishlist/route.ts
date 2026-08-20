import { prisma } from '@/lib/prisma'
import { ok, route } from '@/lib/api'
import { cartAddSchema } from '@/lib/validation'
import { PRODUCT_CARD_SELECT, toProductCard } from '@/lib/products'
import { coerceLocale } from '@/lib/locale-types'

export const GET = route({
  auth: 'user',
  rateLimit: false,
  async handler({ session, query }) {
    const locale = coerceLocale(query.get('locale'))
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId: session!.id },
      include: {
        items: {
          include: { product: { select: PRODUCT_CARD_SELECT } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return ok({
      items: (wishlist?.items ?? []).map((item) => toProductCard(item.product, locale)),
    })
  },
})

export const POST = route({
  auth: 'user',
  schema: cartAddSchema.pick({ productId: true }),
  async handler({ body, session }) {
    const wishlist = await prisma.wishlist.upsert({
      where: { userId: session!.id },
      create: { userId: session!.id },
      update: {},
    })

    await prisma.wishlistItem.upsert({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId: body.productId } },
      create: { wishlistId: wishlist.id, productId: body.productId },
      update: {},
    })

    const count = await prisma.wishlistItem.count({ where: { wishlistId: wishlist.id } })
    return ok({ added: true, count })
  },
})
