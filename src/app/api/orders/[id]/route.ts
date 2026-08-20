import { ApiError, ok, route } from '@/lib/api'
import { can } from '@/lib/auth'
import { getOrderForCustomer, getOrderForStaff } from '@/lib/orders'
import { mediaUrl } from '@/lib/storage'

export const GET = route<unknown, { id: string }>({
  auth: 'user',
  async handler({ params, session }) {
    const isStaff = can(session, 'orders.view')

    const order = isStaff
      ? await getOrderForStaff(params.id)
      : await getOrderForCustomer(params.id, session!.id)

    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found')

    // A customer may only ever see their own order, even if a staff-scoped
    // lookup would have found it.
    if (!isStaff && order.userId !== session!.id) {
      throw new ApiError(404, 'NOT_FOUND', 'Order not found')
    }

    return ok({
      order: {
        ...order,
        items: order.items.map((item) => ({ ...item, imageUrl: mediaUrl(item.imageKey) })),
        // Prescription file keys are never sent to the browser; the file is
        // fetched through the authorised /api/files route by id.
        prescriptions: order.prescriptions.map((prescription) => ({
          id: prescription.id,
          code: prescription.code,
          status: prescription.status,
          fileName: prescription.fileName,
          mimeType: prescription.mimeType,
          createdAt: prescription.createdAt,
          reviews: prescription.reviews.map((review) => ({
            id: review.id,
            action: review.action,
            resultStatus: review.resultStatus,
            reason: review.reason,
            pharmacistNote: review.pharmacistNote,
            reviewer: review.reviewer.fullName,
            createdAt: review.createdAt,
          })),
        })),
        notes: isStaff ? order.notes : [],
      },
    })
  },
})
