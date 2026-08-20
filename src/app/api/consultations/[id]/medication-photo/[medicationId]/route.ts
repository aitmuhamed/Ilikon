import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { ApiError, notFound, route } from '@/lib/api'
import { storage, sniffMimeType } from '@/lib/storage'
import { audit } from '@/lib/audit'
import { authorise, loadById } from '@/lib/consultation'

/**
 * Streams a medicine-package photo a customer uploaded during a consultation.
 *
 * A photo of someone's medication is health data, so it is handled exactly like
 * a prescription file: never behind a public URL (`consultations/` is not in the
 * public prefix list of `/api/files`), reachable only by the consultation's
 * owner or staff holding `consultations.view`, and every read — and every
 * refusal — is written to the audit log.
 */
export const GET = route<unknown, { id: string; medicationId: string }>({
  auth: 'public',
  rateLimit: false,
  async handler({ params, session, request }) {
    const consultation = await loadById(params.id)
    if (!consultation) throw notFound('CONSULTATION_NOT_FOUND')

    // Throws 404 for anyone who is neither the owner nor authorised staff.
    const grant = await authorise({ consultation, session })

    const medication = consultation.medications.find((row) => row.id === params.medicationId)
    if (!medication?.photoKey) throw notFound('PHOTO_NOT_FOUND')

    let buffer: Buffer
    try {
      buffer = await storage().get(medication.photoKey)
    } catch {
      throw new ApiError(404, 'FILE_MISSING', 'Stored file could not be read')
    }

    // Content type comes from the bytes, not from anything the client stored.
    const mimeType = sniffMimeType(buffer)
    if (!mimeType) throw new ApiError(415, 'UNSUPPORTED_TYPE', 'Unsupported media type')

    await audit({
      actor: session,
      action: 'consultation.medication_photo_access',
      entity: 'Consultation',
      entityId: consultation.id,
      summary: `${grant.role === 'staff' ? 'Staff' : 'Owner'} viewed a medication photo on ${consultation.code}`,
      request,
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': mimeType,
        'content-length': String(buffer.byteLength),
        'content-disposition': 'inline',
        // Health data must never be cached by a shared proxy.
        'cache-control': 'private, no-store, max-age=0',
        'x-content-type-options': 'nosniff',
      },
    })
  },
})
