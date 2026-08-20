import { ApiError, notFound, ok, route } from '@/lib/api'
import { IMAGE_MIME_TYPES, UploadError, assertUpload, storage } from '@/lib/storage'
import { authorise, loadById, requireAnswerAccess } from '@/lib/consultation'
import { logStage } from '@/lib/consultation/audit'

/**
 * Photo of a medicine package, for the customer who does not know the name of
 * what they are taking (§6).
 *
 * Deliberately separate from the catalogue uploader, which requires staff
 * permission: this one authorises on *ownership of the consultation* instead,
 * and writes to its own folder. The returned key is stored on the medication
 * row and served only through the authorised file route — never as a public
 * bucket URL, because a photo of someone's medication is health data (§28).
 */
export const POST = route<unknown, { id: string }>({
  auth: 'public',
  rateLimit: 'upload',
  async handler({ params, request, session }) {
    const consultation = await loadById(params.id)
    if (!consultation) throw notFound('CONSULTATION_NOT_FOUND')

    const grant = await authorise({ consultation, session })
    requireAnswerAccess(grant)

    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      throw new ApiError(415, 'EXPECTED_MULTIPART', 'Upload must be multipart/form-data')
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new ApiError(400, 'FILE_REQUIRED', 'No file was uploaded')

    const buffer = Buffer.from(await file.arrayBuffer())

    try {
      // Validated by sniffed magic bytes, not by the declared content type.
      const { mimeType, safeName } = assertUpload(buffer, IMAGE_MIME_TYPES, file.name)
      const stored = await storage().put({
        buffer,
        fileName: safeName,
        mimeType,
        folder: 'consultations',
      })

      await logStage({
        consultationId: consultation.id,
        stage: 'answer_recorded',
        summary: `Medication package photo uploaded (${stored.sizeBytes} bytes)`,
        payload: { fileKey: stored.key },
      })

      // No URL is returned: the key is opaque to the browser and the file is
      // only ever rendered through the audit-logged file route.
      return ok({ fileKey: stored.key, sizeBytes: stored.sizeBytes })
    } catch (error) {
      if (error instanceof UploadError) {
        const status = error.message === 'FILE_TOO_LARGE' ? 413 : 415
        throw new ApiError(status, error.message, error.message)
      }
      throw error
    }
  },
})
