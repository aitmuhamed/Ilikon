'use client'

import { CSRF_COOKIE_NAME } from './constants'

/**
 * Browser-side API client.
 *
 * Attaches the double-submit CSRF token to every mutating request and unwraps
 * the `{ ok, data | error }` envelope the route wrapper produces, so components
 * only deal with values and thrown `ApiClientError`s.
 */

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]!) : null
}

export async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: unknown
    formData?: FormData
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const method = options.method ?? (options.body || options.formData ? 'POST' : 'GET')
  const headers: Record<string, string> = {}

  if (method !== 'GET') {
    const csrf = readCookie(CSRF_COOKIE_NAME)
    if (csrf) headers['x-csrf-token'] = csrf
  }
  if (options.body !== undefined) headers['content-type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      credentials: 'same-origin',
      signal: options.signal,
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed')
  }

  let payload: unknown = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  const envelope = payload as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string; details?: unknown } }
    | null

  if (!response.ok || !envelope || envelope.ok === false) {
    const error = envelope && envelope.ok === false ? envelope.error : null
    throw new ApiClientError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? `Request failed with status ${response.status}`,
      error?.details,
    )
  }

  return envelope.data
}

/** Serialises a filter object into a query string, dropping empty values. */
export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}
