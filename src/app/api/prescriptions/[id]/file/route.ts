import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { ApiError, route } from '@/lib/api'
import { can } from '@/lib/auth'
import { storage } from '@/lib/storage'
import { audit } from '@/lib/audit'

/**
 * Streams a prescription file.
 *
 * This is the ONLY way to read a prescription. The object never sits behind a
 * public URL, access requires either ownership or the `prescriptions.view`
 * permission, and every single read is written to the audit log — including who
 * read it and from where.
 */
export const GET = route<unknown, { id: string }>({
  auth: 'user',
  rateLimit: false,
  async handler({ params, session, request }) {
    const prescription = await prisma.prescription.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        code: true,
        userId: true,
        fileKey: true,
        fileName: true,
        mimeType: true,
      },
    })
    if (!prescription) throw new ApiError(404, 'NOT_FOUND', 'Prescription not found')

    const isOwner = prescription.userId === session!.id
    const isAuthorisedStaff = can(session, 'prescriptions.view')

    if (!isOwner && !isAuthorisedStaff) {
      await audit({
        actor: session,
        action: 'prescription.file_access_denied',
        entity: 'Prescription',
        entityId: prescription.id,
        summary: `Denied access to ${prescription.code}`,
        request,
      })
      throw new ApiError(403, 'FORBIDDEN', 'Not allowed to view this prescription')
    }

    let buffer: Buffer
    try {
      buffer = await storage().get(prescription.fileKey)
    } catch {
      throw new ApiError(404, 'FILE_MISSING', 'Stored file could not be read')
    }

    await audit({
      actor: session,
      action: 'prescription.file_access',
      entity: 'Prescription',
      entityId: prescription.id,
      summary: `${isOwner ? 'Owner' : 'Staff'} viewed ${prescription.code}`,
      request,
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': prescription.mimeType,
        'content-length': String(buffer.byteLength),
        'content-disposition': `inline; filename="${encodeURIComponent(prescription.fileName)}"`,
        // Prescription images must never be cached by a shared proxy.
        'cache-control': 'private, no-store, max-age=0',
        'x-content-type-options': 'nosniff',
      },
    })
  },
})
