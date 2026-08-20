import { prisma } from '@/lib/prisma'
import { ApiError, ok, pageMeta, readPagination, route } from '@/lib/api'
import { checkoutSchema } from '@/lib/validation'
import { resolveCart } from '@/lib/cart'
import { OrderError, createOrder } from '@/lib/orders'
import { StockError } from '@/lib/inventory'
import { can } from '@/lib/auth'
import { maskEmail, maskPhone } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import { getSettings } from '@/lib/settings'
import { availablePaymentMethods } from '@/lib/payments'

/**
 * Order list.
 *  • customers see only their own orders
 *  • staff with `orders.view` see everything, with contact details masked
 *    unless they also hold `customers.viewContact`
 */
export const GET = route({
  auth: 'user',
  async handler({ query, session }) {
    const pagination = readPagination(query, 20, 100)
    const isStaffView = query.get('scope') === 'admin'

    if (isStaffView && !can(session, 'orders.view')) {
      throw new ApiError(403, 'FORBIDDEN', 'Missing permission: orders.view')
    }

    const status = query.get('status')
    const search = (query.get('q') ?? '').trim()

    const where = {
      ...(isStaffView ? {} : { userId: session!.id }),
      ...(status && status !== 'all' ? { status: status as never } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' as const } },
              { customerName: { contains: search, mode: 'insensitive' as const } },
              { customerPhone: { contains: search } },
            ],
          }
        : {}),
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          items: { select: { id: true, name: true, quantity: true, lineTotal: true, imageKey: true } },
          payment: { select: { method: true, status: true } },
          delivery: { select: { method: true, status: true } },
          _count: { select: { items: true, prescriptions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    const showContact = !isStaffView || can(session, 'customers.viewContact')

    return ok({
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: order.customerName,
        customerPhone: showContact ? order.customerPhone : maskPhone(order.customerPhone),
        customerEmail: showContact ? order.customerEmail : maskEmail(order.customerEmail),
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        itemCount: order._count.items,
        prescriptionCount: order._count.prescriptions,
        requiresPrescription: order.requiresPrescription,
        prescriptionCleared: order.prescriptionCleared,
        paymentMethod: order.payment?.method ?? null,
        paymentStatus: order.payment?.status ?? null,
        deliveryMethod: order.delivery?.method ?? null,
        deliveryStatus: order.delivery?.status ?? null,
        items: order.items,
        createdAt: order.createdAt,
      })),
      meta: pageMeta(pagination, total),
    })
  },
})

/** Checkout. Guests may order; the cart is resolved from the session cookie. */
export const POST = route({
  auth: 'public',
  schema: checkoutSchema,
  rateLimit: 'order',
  skipCsrf: true,
  async handler({ body, session, request }) {
    const settings = await getSettings()
    if (!availablePaymentMethods(settings).includes(body.paymentMethod)) {
      throw new ApiError(400, 'PAYMENT_METHOD_DISABLED', 'This payment method is not available')
    }

    const cart = await resolveCart(session?.id ?? null, false)
    if (!cart) throw new ApiError(400, 'EMPTY_CART', 'Your cart is empty')

    void trackEvent({
      name: 'checkout_started',
      userId: session?.id ?? null,
      sessionId: request.headers.get('x-analytics-session'),
    })

    try {
      const result = await createOrder({
        cartId: cart.id,
        userId: session?.id ?? null,
        data: body,
      })

      void trackEvent({
        name: 'order_completed',
        userId: session?.id ?? null,
        value: result.total,
        metadata: { orderNumber: result.orderNumber },
      })

      return ok(result, { status: 201 })
    } catch (error) {
      if (error instanceof StockError) {
        const product = await prisma.product.findUnique({
          where: { id: error.productId },
          select: { name: true },
        })
        throw new ApiError(409, error.code, error.code, {
          productName: product?.name,
          available: error.available,
        })
      }
      if (error instanceof OrderError) {
        throw new ApiError(error.code === 'EMPTY_CART' ? 400 : 409, error.code, error.code, error.detail)
      }
      throw error
    }
  },
})
