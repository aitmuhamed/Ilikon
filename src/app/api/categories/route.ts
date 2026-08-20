import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { categorySchema } from '@/lib/validation'
import { getCategoryTree } from '@/lib/products'
import { coerceLocale } from '@/lib/locale-types'
import { slugify } from '@/lib/utils'
import { audit } from '@/lib/audit'

export const GET = route({
  auth: 'public',
  rateLimit: false,
  async handler({ query }) {
    const includeInactive = query.get('all') === '1'
    const tree = await getCategoryTree(coerceLocale(query.get('locale')), !includeInactive)
    return ok({ categories: tree })
  },
})

export const POST = route({
  auth: { permission: 'categories.manage' },
  schema: categorySchema,
  async handler({ body, session, request }) {
    const slug = await uniqueSlug(body.slug || slugify(body.name))

    if (body.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } })
      if (!parent) throw new ApiError(400, 'PARENT_NOT_FOUND', 'Parent category does not exist')
    }

    const category = await prisma.category.create({
      data: {
        name: body.name,
        slug,
        parentId: body.parentId,
        imageKey: body.imageKey ?? null,
        icon: body.icon ?? null,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
        isFeatured: body.isFeatured,
        metaTitle: body.metaTitle ?? null,
        metaDescription: body.metaDescription ?? null,
        translations: {
          create: Object.entries(body.translations ?? {})
            .filter(([, value]) => value?.name)
            .map(([locale, value]) => ({
              locale: locale as 'mn' | 'en' | 'ru',
              name: value!.name!,
              description: value!.description ?? null,
            })),
        },
      },
    })

    await audit({
      actor: session,
      action: 'category.create',
      entity: 'Category',
      entityId: category.id,
      summary: category.name,
      request,
    })

    return ok({ category }, { status: 201 })
  },
})

async function uniqueSlug(base: string): Promise<string> {
  const candidate = base || 'category'
  const existing = await prisma.category.findUnique({ where: { slug: candidate } })
  if (!existing) return candidate
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const next = `${candidate}-${suffix}`
    // eslint-disable-next-line no-await-in-loop
    if (!(await prisma.category.findUnique({ where: { slug: next } }))) return next
  }
  return `${candidate}-${Date.now()}`
}
