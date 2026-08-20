import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { promotionSchema } from '@/lib/validation'
import { audit } from '@/lib/audit'

export const PUT = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'promotions.manage' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: promotionSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof promotionSchema>

    const current = await prisma.promotion.findUnique({ where: { id: params.id } })
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Promotion not found')

    const updated = await prisma.promotion.update({
      where: { id: params.id },
      data: {
        title: data.title,
        subtitle: data.subtitle ?? null,
        imageKey: data.imageKey ?? null,
        linkUrl: data.linkUrl ?? null,
        placement: data.placement,
        badgeText: data.badgeText ?? null,
        bgColor: data.bgColor ?? null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        categoryId: data.categoryId,
        productId: data.productId,
      },
    })

    for (const [locale, value] of Object.entries(data.translations ?? {})) {
      if (!value?.title) continue
      await prisma.promotionTranslation.upsert({
        where: {
          promotionId_locale: { promotionId: params.id, locale: locale as 'mn' | 'en' | 'ru' },
        },
        create: {
          promotionId: params.id,
          locale: locale as 'mn' | 'en' | 'ru',
          title: value.title,
          subtitle: value.subtitle ?? null,
        },
        update: { title: value.title, subtitle: value.subtitle ?? null },
      })
    }

    await audit({
      actor: session,
      action: 'promotion.update',
      entity: 'Promotion',
      entityId: params.id,
      summary: updated.title,
      request,
    })

    return ok({ promotion: updated })
  },
})

export const DELETE = route<unknown, { id: string }>({
  auth: { permission: 'promotions.manage' },
  async handler({ params, session, request }) {
    await prisma.promotion.delete({ where: { id: params.id } })
    await audit({
      actor: session,
      action: 'promotion.delete',
      entity: 'Promotion',
      entityId: params.id,
      request,
    })
    return ok({ deleted: true })
  },
})
