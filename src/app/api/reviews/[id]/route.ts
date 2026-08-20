import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { reviewModerateSchema } from '@/lib/validation'
import { audit } from '@/lib/audit'

/**
 * Recomputes the product's rating aggregate from approved reviews only, so a
 * hidden or deleted review stops influencing the public score immediately.
 */
async function recomputeRating(productId: string) {
  const aggregate = await prisma.review.aggregate({
    where: { productId, status: 'APPROVED', deletedAt: null },
    _avg: { rating: true },
    _count: { _all: true },
  })
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg: Number((aggregate._avg.rating ?? 0).toFixed(2)),
      ratingCount: aggregate._count._all,
    },
  })
}

export const PATCH = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'reviews.moderate' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: reviewModerateSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof reviewModerateSchema>

    const review = await prisma.review.findUnique({ where: { id: params.id } })
    if (!review) throw new ApiError(404, 'NOT_FOUND', 'Review not found')

    await prisma.review.update({
      where: { id: params.id },
      data: { status: data.status, moderatedById: session!.id, moderatedAt: new Date() },
    })
    await recomputeRating(review.productId)

    await audit({
      actor: session,
      action: 'review.moderate',
      entity: 'Review',
      entityId: params.id,
      summary: `${review.status} → ${data.status}`,
      request,
    })

    return ok({ status: data.status })
  },
})

export const DELETE = route<unknown, { id: string }>({
  auth: { permission: 'reviews.moderate' },
  async handler({ params, session, request }) {
    const review = await prisma.review.findUnique({ where: { id: params.id } })
    if (!review) throw new ApiError(404, 'NOT_FOUND', 'Review not found')

    await prisma.review.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'HIDDEN' },
    })
    await recomputeRating(review.productId)

    await audit({
      actor: session,
      action: 'review.delete',
      entity: 'Review',
      entityId: params.id,
      request,
    })

    return ok({ deleted: true })
  },
})
