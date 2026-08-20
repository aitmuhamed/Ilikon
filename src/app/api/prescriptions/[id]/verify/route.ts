import type { PrescriptionStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { prescriptionVerifySchema } from '@/lib/validation'
import { setPrescriptionCleared } from '@/lib/orders'
import { notifyCustomer } from '@/lib/notifications'
import { audit } from '@/lib/audit'
import { ROLE_KEYS } from '@/lib/rbac'

/**
 * Pharmacist verification.
 *
 * Guarded by the `prescriptions.verify` permission, which only the pharmacist
 * and super-admin roles carry by default. Every decision writes an immutable
 * `PrescriptionReview` row recording who decided what, when, and why — nothing
 * here can be triggered automatically or by the customer.
 */

const RESULT_BY_ACTION: Record<string, PrescriptionStatus> = {
  APPROVE: 'VERIFIED',
  REJECT: 'REJECTED',
  REQUEST_CLARIFICATION: 'CLARIFICATION_REQUESTED',
}

export const PATCH = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'prescriptions.verify' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: prescriptionVerifySchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof prescriptionVerifySchema>

    const prescription = await prisma.prescription.findUnique({
      where: { id: params.id },
      include: { order: { select: { id: true, orderNumber: true } } },
    })
    if (!prescription) throw new ApiError(404, 'NOT_FOUND', 'Prescription not found')

    // Defence in depth: the permission check above is the gate, but the
    // pharmacist licence is what makes the decision valid.
    const reviewer = await prisma.user.findUniqueOrThrow({
      where: { id: session!.id },
      include: { role: { select: { key: true } } },
    })
    const isPharmacist =
      reviewer.role?.key === ROLE_KEYS.PHARMACIST || reviewer.role?.key === ROLE_KEYS.SUPER_ADMIN
    if (!isPharmacist) {
      throw new ApiError(
        403,
        'PHARMACIST_REQUIRED',
        'Only an authorised pharmacist can verify a prescription',
      )
    }

    if (data.action === 'NOTE') {
      const review = await prisma.prescriptionReview.create({
        data: {
          prescriptionId: params.id,
          reviewerId: session!.id,
          action: 'NOTE',
          resultStatus: prescription.status,
          pharmacistNote: data.pharmacistNote ?? null,
        },
      })
      await audit({
        actor: session,
        action: 'prescription.note',
        entity: 'Prescription',
        entityId: params.id,
        summary: prescription.code,
        request,
      })
      return ok({ status: prescription.status, reviewId: review.id })
    }

    const resultStatus = RESULT_BY_ACTION[data.action]!

    const [updated] = await prisma.$transaction([
      prisma.prescription.update({
        where: { id: params.id },
        data: { status: resultStatus },
      }),
      prisma.prescriptionReview.create({
        data: {
          prescriptionId: params.id,
          reviewerId: session!.id,
          action: data.action,
          resultStatus,
          reason: data.reason ?? null,
          pharmacistNote: data.pharmacistNote ?? null,
        },
      }),
    ])

    // Fulfilment gate on the attached order.
    if (prescription.orderId) {
      await setPrescriptionCleared(
        prescription.orderId,
        resultStatus === 'VERIFIED',
        session!,
        data.pharmacistNote ?? data.reason ?? undefined,
      )
    }

    const notification =
      resultStatus === 'VERIFIED'
        ? {
            type: 'PRESCRIPTION_APPROVED' as const,
            title: 'Жор баталгаажлаа',
            body: `${prescription.code} жор баталгаажлаа. Захиалга бэлтгэгдэж эхэлнэ.`,
          }
        : resultStatus === 'REJECTED'
          ? {
              type: 'PRESCRIPTION_REJECTED' as const,
              title: 'Жор татгалзагдлаа',
              body: `${prescription.code}: ${data.reason ?? 'Шалтгаан заагаагүй'}`,
            }
          : {
              type: 'PRESCRIPTION_CLARIFICATION' as const,
              title: 'Жорын тодруулга шаардлагатай',
              body: `${prescription.code}: ${data.reason ?? 'Нэмэлт мэдээлэл шаардлагатай'}`,
            }

    await notifyCustomer({
      userId: prescription.userId,
      ...notification,
      linkUrl: '/account/prescriptions',
    })

    await audit({
      actor: session,
      action: `prescription.${data.action.toLowerCase()}`,
      entity: 'Prescription',
      entityId: params.id,
      summary: `${prescription.code} → ${resultStatus}${
        prescription.order ? ` (order ${prescription.order.orderNumber})` : ''
      }`,
      changes: { reason: data.reason ?? null, note: data.pharmacistNote ?? null },
      request,
    })

    return ok({ status: updated.status })
  },
})
