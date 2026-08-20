import { prisma } from '@/lib/prisma'
import { ApiError, ok, pageMeta, readPagination, route } from '@/lib/api'
import { reviewSchema } from '@/lib/validation'

/** Moderation queue (staff). */
export const GET = route({
  auth: { permission: 'reviews.view' },
  async handler({ query }) {
    const pagination = readPagination(query, 20, 100)
    const status = query.get('status')

    const where = {
      deletedAt: null,
      ...(status && status !== 'all' ? { status: status as never } : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, slug: true, sku: true } },
          user: { select: { id: true, fullName: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    return ok({ reviews: rows, meta: pageMeta(pagination, total) })
  },
})

/**
 * Only customers who actually bought and received the product may review it.
 * New reviews start as PENDING and appear publicly only after moderation.
 */
export const POST = route({
  auth: 'user',
  schema: reviewSchema,
  rateLimit: 'review',
  async handler({ body, session }) {
    const purchased = await prisma.orderItem.findFirst({
      where: {
        productId: body.productId,
        order: { userId: session!.id, status: 'DELIVERED' },
      },
      select: { orderId: true },
    })
    if (!purchased) {
      throw new ApiError(
        403,
        'PURCHASE_REQUIRED',
        'Only customers who received this product can review it',
      )
    }

    const existing = await prisma.review.findUnique({
      where: { productId_userId: { productId: body.productId, userId: session!.id } },
    })
    if (existing) throw new ApiError(409, 'ALREADY_REVIEWED', 'You have already reviewed this product')

    const review = await prisma.review.create({
      data: {
        productId: body.productId,
        userId: session!.id,
        orderId: purchased.orderId,
        rating: body.rating,
        title: body.title ?? null,
        comment: body.comment ?? null,
        status: 'PENDING',
        isVerifiedBuyer: true,
      },
    })

    return ok({ review: { id: review.id, status: review.status } }, { status: 201 })
  },
})
