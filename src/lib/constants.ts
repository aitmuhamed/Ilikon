/**
 * Values shared between server and browser code. Nothing here is secret.
 */

export const CSRF_COOKIE_NAME = 'ilikon_csrf'
export const CHAT_SESSION_KEY = 'ilikon_chat_session'
/** httpOnly continuation key for an in-progress AI consultation. */
export const CONSULTATION_COOKIE = 'ilikon_consultation'
export const ANALYTICS_SESSION_KEY = 'ilikon_analytics_session'

/** Ulaanbaatar districts, used by the checkout address step. */
export const UB_DISTRICTS = [
  'Багануур',
  'Багахангай',
  'Баянгол',
  'Баянзүрх',
  'Налайх',
  'Сонгинохайрхан',
  'Сүхбаатар',
  'Хан-Уул',
  'Чингэлтэй',
] as const

export type District = (typeof UB_DISTRICTS)[number]

/** Category slugs the home page uses for its themed shelves. */
export const HOME_SHELVES = {
  vitamins: ['vitamin', 'darhlaa-demjih'],
  health: ['ariun-tsevriin-buteegdehuun', 'aris-archilgaa', 'goo-saihan'],
  devices: ['eruul-mendiin-heregsel', 'daralt-hemjigch', 'termometr', 'anhny-tuslamts'],
} as const

export const ORDER_STATUS_SEQUENCE = [
  'NEW',
  'CONFIRMING',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
] as const

export const MAX_CART_QUANTITY = 99
export const PRESCRIPTION_MAX_MB = 10

export const SORT_OPTIONS = [
  'popular',
  'newest',
  'price_asc',
  'price_desc',
  'discount',
  'rating',
  'name',
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]

/**
 * Fallback emergency number for safety notices. The consultation agent reads
 * the configured `emergencyNumber` setting instead of this constant (§27).
 */
export const EMERGENCY_NUMBER = '103'
