import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { categorySchema } from '@/lib/validation'
import { audit, diffChanges } from '@/lib/audit'

export const PUT = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'categories.manage' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: categorySchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof categorySchema>

    const current = await prisma.category.findUnique({ where: { id: params.id } })
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Category not found')

    if (data.parentId === params.id) {
      throw new ApiError(400, 'SELF_PARENT', 'A category cannot be its own parent')
    }
    // Prevent a cycle: the chosen parent must not sit below this category.
    if (data.parentId) {
      let cursor = await prisma.category.findUnique({
        where: { id: data.parentId },
        select: { id: true, parentId: true },
      })
      let depth = 0
      while (cursor?.parentId && depth < 20) {
        if (cursor.parentId === params.id) {
          throw new ApiError(400, 'CYCLIC_PARENT', 'That would create a category loop')
        }
        // eslint-disable-next-line no-await-in-loop
        cursor = await prisma.category.findUnique({
          where: { id: cursor.parentId },
          select: { id: true, parentId: true },
        })
        depth += 1
      }
    }

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: {
        name: data.name,
        slug: data.slug || current.slug,
        parentId: data.parentId,
        imageKey: data.imageKey ?? null,
        icon: data.icon ?? null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
      },
    })

    for (const [locale, value] of Object.entries(data.translations ?? {})) {
      if (!value?.name) continue
      await prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: params.id, locale: locale as 'mn' | 'en' | 'ru' } },
        create: {
          categoryId: params.id,
          locale: locale as 'mn' | 'en' | 'ru',
          name: value.name,
          description: value.description ?? null,
        },
        update: { name: value.name, description: value.description ?? null },
      })
    }

    await audit({
      actor: session,
      action: 'category.update',
      entity: 'Category',
      entityId: params.id,
      summary: updated.name,
      changes: diffChanges(
        current as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      ),
      request,
    })

    return ok({ category: updated })
  },
})

/** Archived rather than deleted when products or child categories reference it. */
export const DELETE = route<unknown, { id: string }>({
  auth: { permission: 'categories.manage' },
  async handler({ params, session, request }) {
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: { _count: { select: { products: true, children: true } } },
    })
    if (!category) throw new ApiError(404, 'NOT_FOUND', 'Category not found')

    const inUse = category._count.products > 0 || category._count.children > 0

    if (inUse) {
      await prisma.category.update({
        where: { id: params.id },
        data: { isActive: false, deletedAt: new Date() },
      })
    } else {
      await prisma.category.delete({ where: { id: params.id } })
    }

    await audit({
      actor: session,
      action: inUse ? 'category.archive' : 'category.delete',
      entity: 'Category',
      entityId: params.id,
      summary: `${category.name}${inUse ? ' — archived, still referenced' : ''}`,
      request,
    })

    return ok({ archived: inUse, deleted: !inUse })
  },
})
