import { ApiError, ok, route } from '@/lib/api'
import { IMAGE_MIME_TYPES, UploadError, assertUpload, mediaUrl, storage } from '@/lib/storage'
import { audit } from '@/lib/audit'

const ALLOWED_FOLDERS = ['products', 'categories', 'brands', 'promotions', 'logos'] as const

/**
 * Admin image upload for catalogue media.
 * Files are validated by sniffed magic bytes, not by the declared type.
 */
export const POST = route({
  auth: { permission: 'products.update' },
  rateLimit: 'upload',
  async handler({ request, session }) {
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      throw new ApiError(415, 'EXPECTED_MULTIPART', 'Upload must be multipart/form-data')
    }

    const form = await request.formData()
    const file = form.get('file')
    const folderInput = String(form.get('folder') ?? 'products')

    if (!(file instanceof File)) throw new ApiError(400, 'FILE_REQUIRED', 'No file was uploaded')
    if (!(ALLOWED_FOLDERS as readonly string[]).includes(folderInput)) {
      throw new ApiError(400, 'INVALID_FOLDER', 'Unknown upload folder')
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    try {
      const { mimeType, safeName } = assertUpload(buffer, IMAGE_MIME_TYPES, file.name)
      const stored = await storage().put({
        buffer,
        fileName: safeName,
        mimeType,
        folder: folderInput,
      })

      await audit({
        actor: session,
        action: 'media.upload',
        entity: 'Media',
        entityId: stored.key,
        summary: `${folderInput}/${safeName} (${stored.sizeBytes} bytes)`,
        request,
      })

      return ok({ fileKey: stored.key, url: mediaUrl(stored.key), sizeBytes: stored.sizeBytes })
    } catch (error) {
      if (error instanceof UploadError) {
        const status = error.message === 'FILE_TOO_LARGE' ? 413 : 415
        throw new ApiError(status, error.message, error.message)
      }
      throw error
    }
  },
})
