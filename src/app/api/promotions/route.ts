import { prisma } from '@/lib/prisma'
import { ok, route } from '@/lib/api'
import { promotionSchema } from '@/lib/validation'
import { mediaUrl } from '@/lib/storage'
import { audit } from '@/lib/audit'

export const GET = route({
  auth: { permission: 'promotions.view' },
  rateLimit: false,
  async handler() {
    const promotions = await prisma.promotion.findMany({
      include: {
        translations: true,
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
      orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }],
    })

    return ok({
      promotions: promotions.map((promotion) => ({
        ...promotion,
        imageUrl: mediaUrl(promotion.imageKey),
      })),
    })
  },
})

export const POST = route({
  auth: { permission: 'promotions.manage' },
  schema: promotionSchema,
  async handler({ body, session, request }) {
    const promotion = await prisma.promotion.create({
      data: {
        title: body.title,
        subtitle: body.subtitle ?? null,
        imageKey: body.imageKey ?? null,
        linkUrl: body.linkUrl ?? null,
        placement: body.placement,
        badgeText: body.badgeText ?? null,
        bgColor: body.bgColor ?? null,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        categoryId: body.categoryId,
        productId: body.productId,
        translations: {
          create: Object.entries(body.translations ?? {})
            .filter(([, value]) => value?.title)
            .map(([locale, value]) => ({
              locale: locale as 'mn' | 'en' | 'ru',
              title: value!.title!,
              subtitle: value!.subtitle ?? null,
            })),
        },
      },
    })

    await audit({
      actor: session,
      action: 'promotion.create',
      entity: 'Promotion',
      entityId: promotion.id,
      summary: promotion.title,
      request,
    })

    return ok({ promotion }, { status: 201 })
  },
})
