import { prisma } from '@/lib/prisma'
import { ApiError, ok, pageMeta, readPagination, route } from '@/lib/api'
import { prescriptionMetaSchema } from '@/lib/validation'
import { PRESCRIPTION_MIME_TYPES, UploadError, assertUpload, storage } from '@/lib/storage'
import { nextPrescriptionCode } from '@/lib/orders'
import { notifyStaff } from '@/lib/notifications'
import { audit } from '@/lib/audit'
import { can } from '@/lib/auth'
import { maskPhone } from '@/lib/utils'

/**
 * Prescription listing.
 *  • customers see their own prescriptions
 *  • staff need `prescriptions.view`; the file itself is still only reachable
 *    through /api/files, which logs every access
 */
export const GET = route({
  auth: 'user',
  async handler({ query, session }) {
    const pagination = readPagination(query, 20, 100)
    const isStaffView = query.get('scope') === 'admin'

    if (isStaffView && !can(session, 'prescriptions.view')) {
      throw new ApiError(403, 'FORBIDDEN', 'Missing permission: prescriptions.view')
    }

    const status = query.get('status')
    const where = {
      ...(isStaffView ? {} : { userId: session!.id }),
      ...(status && status !== 'all' ? { status: status as never } : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.prescription.count({ where }),
      prisma.prescription.findMany({
        where,
        include: {
          order: { select: { id: true, orderNumber: true, total: true, status: true } },
          user: { select: { id: true, fullName: true, phone: true } },
          reviews: {
            include: { reviewer: { select: { fullName: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    const showContact = !isStaffView || can(session, 'customers.viewContact')

    return ok({
      prescriptions: rows.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        fileName: row.fileName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        patientName: row.patientName,
        doctorName: row.doctorName,
        clinic: row.clinic,
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt,
        customerNote: row.customerNote,
        createdAt: row.createdAt,
        order: row.order,
        customer: {
          id: row.user.id,
          fullName: row.user.fullName,
          phone: showContact ? row.user.phone : maskPhone(row.user.phone),
        },
        reviews: row.reviews.map((review) => ({
          id: review.id,
          action: review.action,
          resultStatus: review.resultStatus,
          reason: review.reason,
          pharmacistNote: review.pharmacistNote,
          reviewer: review.reviewer.fullName,
          createdAt: review.createdAt,
        })),
      })),
      meta: pageMeta(pagination, total),
    })
  },
})

/**
 * Upload. Multipart only.
 *
 * The file is validated by sniffed magic bytes (not the declared content-type),
 * capped at 10 MB, and written to private storage. It is created in PENDING and
 * can only leave that state through a pharmacist review — there is no code path
 * that auto-approves a prescription.
 */
export const POST = route({
  auth: 'user',
  rateLimit: 'upload',
  async handler({ request, session }) {
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      throw new ApiError(415, 'EXPECTED_MULTIPART', 'Upload must be multipart/form-data')
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new ApiError(400, 'FILE_REQUIRED', 'No file was uploaded')

    const meta = prescriptionMetaSchema.parse({
      orderId: form.get('orderId') ?? '',
      patientName: form.get('patientName') ?? '',
      doctorName: form.get('doctorName') ?? '',
      clinic: form.get('clinic') ?? '',
      issuedAt: form.get('issuedAt') ?? '',
      expiresAt: form.get('expiresAt') ?? '',
      customerNote: form.get('customerNote') ?? '',
    })

    // An order can only have a prescription attached by its own customer.
    if (meta.orderId) {
      const order = await prisma.order.findFirst({
        where: { id: meta.orderId, userId: session!.id },
        select: { id: true },
      })
      if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found')
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let stored
    try {
      const { mimeType, safeName } = assertUpload(buffer, PRESCRIPTION_MIME_TYPES, file.name)
      stored = await storage().put({
        buffer,
        fileName: safeName,
        mimeType,
        folder: 'prescriptions',
      })
    } catch (error) {
      if (error instanceof UploadError) {
        const status = error.message === 'FILE_TOO_LARGE' ? 413 : 415
        throw new ApiError(status, error.message, error.message)
      }
      throw error
    }

    const prescription = await prisma.$transaction(async (tx) => {
      const code = await nextPrescriptionCode(tx)
      return tx.prescription.create({
        data: {
          code,
          userId: session!.id,
          orderId: meta.orderId ?? null,
          fileKey: stored.key,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          status: 'PENDING',
          patientName: meta.patientName ?? null,
          doctorName: meta.doctorName ?? null,
          clinic: meta.clinic ?? null,
          issuedAt: meta.issuedAt ? new Date(meta.issuedAt) : null,
          expiresAt: meta.expiresAt ? new Date(meta.expiresAt) : null,
          customerNote: meta.customerNote ?? null,
        },
      })
    })

    if (meta.orderId) {
      await prisma.orderEvent.create({
        data: {
          orderId: meta.orderId,
          title: 'Жор хавсаргагдлаа',
          message: `${prescription.code} — фармацевтын баталгаажуулалт хүлээж байна`,
          isSystem: true,
        },
      })
    }

    await notifyStaff({
      type: 'NEW_PRESCRIPTION',
      title: 'Шинэ жор шалгуулахаар ирлээ',
      body: `${prescription.code} — ${session!.fullName}${meta.orderId ? ' (захиалгад хавсаргасан)' : ''}`,
      linkUrl: '/admin/prescriptions',
    })

    await audit({
      actor: session,
      action: 'prescription.upload',
      entity: 'Prescription',
      entityId: prescription.id,
      summary: `${prescription.code} uploaded (${stored.mimeType}, ${stored.sizeBytes} bytes)`,
      request,
    })

    return ok(
      {
        prescription: {
          id: prescription.id,
          code: prescription.code,
          status: prescription.status,
          fileName: prescription.fileName,
        },
      },
      { status: 201 },
    )
  },
})
