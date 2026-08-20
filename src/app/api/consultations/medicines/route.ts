import { ok, route } from '@/lib/api'
import { coerceLocale } from '@/lib/locale-types'
import { medicineLookupSchema } from '@/lib/validation'
import { findByBarcode, searchStockedMedicines } from '@/lib/consultation'

/**
 * Medicine lookup for the "what are you already taking" step (§6).
 *
 * Search and barcode both resolve against the pharmacy's own catalogue, so a
 * customer's entry is tied to a real product wherever possible — which is what
 * lets the interaction engine give a verdict instead of an UNKNOWN.
 */
export const GET = route({
  auth: 'public',
  schema: medicineLookupSchema,
  rateLimit: 'search',
  async handler({ body }) {
    const locale = coerceLocale(body.locale)

    if (body.barcode) {
      const match = await findByBarcode(body.barcode, locale)
      return ok({ items: match ? [{ ...match, packageSize: null }] : [] })
    }

    const items = await searchStockedMedicines(body.q ?? '', locale, 8)
    return ok({ items })
  },
})
