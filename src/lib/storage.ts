import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import path from 'node:path'

import { env } from './env'

/**
 * Storage abstraction.
 *
 * `local` writes to a directory outside `public/` so uploaded files are never
 * statically served — prescriptions in particular must only ever be reachable
 * through the authorised, audit-logged API route.
 *
 * `s3` targets any S3-compatible bucket (AWS, MinIO, R2). Prescription objects
 * must live in a private bucket; product media may live in a public one.
 */
export interface StoredFile {
  key: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export interface StorageDriver {
  put(input: {
    buffer: Buffer
    fileName: string
    mimeType: string
    folder: string
  }): Promise<StoredFile>
  get(key: string): Promise<Buffer>
  remove(key: string): Promise<void>
  /** Public URL, or null when the object must be streamed through the app. */
  publicUrl(key: string): string | null
}

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const PRESCRIPTION_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

export class UploadError extends Error {}

/**
 * Never trust a client-supplied filename or content-type. The extension is
 * derived from the sniffed magic bytes and the name is discarded from the key.
 */
export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null
  const hex = buffer.subarray(0, 12).toString('hex').toLowerCase()
  if (hex.startsWith('ffd8ff')) return 'image/jpeg'
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png'
  if (hex.startsWith('47494638')) return 'image/gif'
  if (hex.startsWith('25504446')) return 'application/pdf'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  return null
}

export function assertUpload(
  buffer: Buffer,
  allowed: readonly string[],
  declaredName: string,
): { mimeType: string; safeName: string } {
  if (buffer.byteLength === 0) throw new UploadError('EMPTY_FILE')
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new UploadError('FILE_TOO_LARGE')

  const sniffed = sniffMimeType(buffer)
  if (!sniffed || !allowed.includes(sniffed)) throw new UploadError('FILE_TYPE_INVALID')

  // Keep a display name, stripped of any path traversal or control characters.
  const safeName = path
    .basename(declaredName || 'upload')
    .replace(/[^\w.\-Ѐ-ӿ ]+/g, '_')
    .slice(0, 120)

  return { mimeType: sniffed, safeName }
}

function buildKey(folder: string, mimeType: string): string {
  const ext = EXTENSION_BY_MIME[mimeType] ?? 'bin'
  const stamp = new Date().toISOString().slice(0, 10)
  const random = randomBytes(16).toString('hex')
  return `${folder}/${stamp}/${random}.${ext}`
}

function assertSafeKey(key: string): void {
  if (!/^[a-z0-9][a-z0-9/_\-.]*$/i.test(key) || key.includes('..')) {
    throw new UploadError('INVALID_KEY')
  }
}

// ───────────────────────────── local driver ───────────────────────────────

class LocalDriver implements StorageDriver {
  private root(): string {
    return path.resolve(process.cwd(), env().LOCAL_STORAGE_DIR)
  }

  async put(input: { buffer: Buffer; fileName: string; mimeType: string; folder: string }) {
    const key = buildKey(input.folder, input.mimeType)
    const target = path.join(this.root(), key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, input.buffer)
    return {
      key,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
    }
  }

  async get(key: string) {
    assertSafeKey(key)
    const target = path.join(this.root(), key)
    // Defence in depth: confirm the resolved path stays inside the root.
    if (!path.resolve(target).startsWith(path.resolve(this.root()))) {
      throw new UploadError('INVALID_KEY')
    }
    return readFile(target)
  }

  async remove(key: string) {
    assertSafeKey(key)
    await unlink(path.join(this.root(), key)).catch(() => undefined)
  }

  publicUrl(): string | null {
    return null // always streamed through /api/files/[...key]
  }
}

// ─────────────────────────────── s3 driver ────────────────────────────────

/**
 * Minimal SigV4 S3 client. Implemented with fetch rather than the AWS SDK to
 * keep the dependency surface (and cold start) small — the platform only needs
 * PUT / GET / DELETE object.
 */
class S3Driver implements StorageDriver {
  private cfg() {
    const e = env()
    if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY || !e.S3_ENDPOINT) {
      throw new UploadError('S3_NOT_CONFIGURED')
    }
    return e
  }

  private async sign(
    method: string,
    key: string,
    body: Buffer | undefined,
    contentType?: string,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const e = this.cfg()
    const url = new URL(`${e.S3_ENDPOINT.replace(/\/$/, '')}/${e.S3_BUCKET}/${key}`)
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const service = 's3'
    const region = e.S3_REGION || 'auto'
    const payloadHash = createHash('sha256')
      .update(body ?? Buffer.alloc(0))
      .digest('hex')

    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    }
    if (contentType) headers['content-type'] = contentType

    const signedHeaders = Object.keys(headers).sort().join(';')
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((h) => `${h}:${headers[h]}\n`)
      .join('')
    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    const scope = `${dateStamp}/${region}/${service}/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')

    const { createHmac } = await import('node:crypto')
    const hmac = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest()
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${e.S3_SECRET_ACCESS_KEY}`, dateStamp), region), service), 'aws4_request')
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

    headers.authorization = `AWS4-HMAC-SHA256 Credential=${e.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    return { url: url.toString(), headers }
  }

  async put(input: { buffer: Buffer; fileName: string; mimeType: string; folder: string }) {
    const key = buildKey(input.folder, input.mimeType)
    const { url, headers } = await this.sign('PUT', key, input.buffer, input.mimeType)
    const res = await fetch(url, { method: 'PUT', headers, body: new Uint8Array(input.buffer) })
    if (!res.ok) throw new UploadError(`S3_PUT_FAILED_${res.status}`)
    return {
      key,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
    }
  }

  async get(key: string) {
    assertSafeKey(key)
    const { url, headers } = await this.sign('GET', key, undefined)
    const res = await fetch(url, { headers })
    if (!res.ok) throw new UploadError(`S3_GET_FAILED_${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async remove(key: string) {
    assertSafeKey(key)
    const { url, headers } = await this.sign('DELETE', key, undefined)
    await fetch(url, { method: 'DELETE', headers }).catch(() => undefined)
  }

  publicUrl(key: string): string | null {
    const base = env().S3_PUBLIC_BASE_URL
    return base ? `${base.replace(/\/$/, '')}/${key}` : null
  }
}

let driver: StorageDriver | null = null

export function storage(): StorageDriver {
  if (!driver) driver = env().STORAGE_DRIVER === 's3' ? new S3Driver() : new LocalDriver()
  return driver
}

/**
 * Resolves a stored key to something an `<img src>` can use.
 * Seed data and admin-entered URLs may already be absolute — pass those through.
 */
export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null
  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) return key
  try {
    return storage().publicUrl(key) ?? `/api/files/${key}`
  } catch {
    return `/api/files/${key}`
  }
}
