import { prisma } from '@/lib/prisma'
import { ok, route } from '@/lib/api'

export const DELETE = route<unknown, { productId: string }>({
  auth: 'user',
  async handler({ params, session }) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId: session!.id } })
    if (!wishlist) return ok({ removed: false, count: 0 })

    await prisma.wishlistItem
      .delete({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId: params.productId } },
      })
      .catch(() => undefined)

    const count = await prisma.wishlistItem.count({ where: { wishlistId: wishlist.id } })
    return ok({ removed: true, count })
  },
})
