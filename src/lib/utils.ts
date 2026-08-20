import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** MNT has no circulating subunit — amounts are whole tögrög. */
export function formatMnt(amount: number, locale = 'mn'): string {
  const n = new Intl.NumberFormat(locale === 'mn' ? 'mn-MN' : locale === 'ru' ? 'ru-RU' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount))
  return `${n}₮`
}

export function formatNumber(n: number, locale = 'mn'): string {
  return new Intl.NumberFormat(locale === 'mn' ? 'mn-MN' : locale === 'ru' ? 'ru-RU' : 'en-US').format(n)
}

export function formatDate(date: Date | string | null | undefined, locale = 'mn'): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale === 'mn' ? 'mn-MN' : locale === 'ru' ? 'ru-RU' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function formatDateTime(date: Date | string | null | undefined, locale = 'mn'): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale === 'mn' ? 'mn-MN' : locale === 'ru' ? 'ru-RU' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function discountPercent(price: number, discountPrice?: number | null): number | null {
  if (!discountPrice || discountPrice >= price || price <= 0) return null
  return Math.round(((price - discountPrice) / price) * 100)
}

export function effectivePrice(price: number, discountPrice?: number | null): number {
  return discountPrice && discountPrice > 0 && discountPrice < price ? discountPrice : price
}

/**
 * URL-safe slug that keeps Cyrillic readable by transliterating it, so
 * `/products/paracetamol` style URLs stay ASCII and SEO friendly.
 */
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', ө: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ү: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
}

export function truncate(text: string, max = 140): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** Mongolian mobile numbers are 8 digits; also accept +976 prefixed input. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.startsWith('976') && digits.length === 11) return digits.slice(3)
  return digits
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return '••••'
  return `${phone.slice(0, 2)}••••${phone.slice(-2)}`
}

export function maskEmail(email?: string | null): string {
  if (!email) return '—'
  const [user, domain] = email.split('@')
  if (!domain) return '•••'
  return `${user.slice(0, 2)}•••@${domain}`
}
