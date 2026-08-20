import { NextResponse } from 'next/server'

import { storage } from '@/lib/storage'
import { toErrorResponse, ApiError } from '@/lib/api'

/**
 * Serves public product/category/brand media from the storage driver.
 *
 * Deliberately narrow: only the `products/`, `categories/`, `brands/` and
 * `promotions/` prefixes are reachable. `prescriptions/` is excluded here and
 * served exclusively by the authorised, audit-logged prescription route.
 */
const PUBLIC_PREFIXES = ['products/', 'categories/', 'brands/', 'promotions/', 'logos/']

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  try {
    const { key: segments } = await context.params
    const key = segments.join('/')

    if (!PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      throw new ApiError(403, 'FORBIDDEN', 'This object is not publicly served')
    }

    const extension = key.split('.').pop()?.toLowerCase() ?? ''
    const contentType = CONTENT_TYPES[extension]
    if (!contentType) throw new ApiError(415, 'UNSUPPORTED_TYPE', 'Unsupported media type')

    const buffer = await storage().get(key)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-length': String(buffer.byteLength),
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof ApiError) return toErrorResponse(error)
    return toErrorResponse(new ApiError(404, 'NOT_FOUND', 'File not found'))
  }
}
