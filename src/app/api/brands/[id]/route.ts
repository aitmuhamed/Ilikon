import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { brandSchema } from '@/lib/validation'
import { audit, diffChanges } from '@/lib/audit'

export const PUT = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'brands.manage' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: brandSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof brandSchema>
    const current = await prisma.brand.findUnique({ where: { id: params.id } })
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Brand not found')

    const updated = await prisma.brand.update({
      where: { id: params.id },
      data: {
        name: data.name,
        slug: data.slug || current.slug,
        logoKey: data.logoKey ?? null,
        description: data.description ?? null,
        country: data.country ?? null,
        website: data.website ?? null,
        isActive: data.isActive,
      },
    })

    await audit({
      actor: session,
      action: 'brand.update',
      entity: 'Brand',
      entityId: params.id,
      summary: updated.name,
      changes: diffChanges(
        current as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      ),
      request,
    })

    return ok({ brand: updated })
  },
})

export const DELETE = route<unknown, { id: string }>({
  auth: { permission: 'brands.manage' },
  async handler({ params, session, request }) {
    const brand = await prisma.brand.findUnique({
      where: { id: params.id },
      include: { _count: { select: { products: true } } },
    })
    if (!brand) throw new ApiError(404, 'NOT_FOUND', 'Brand not found')

    const inUse = brand._count.products > 0
    if (inUse) {
      await prisma.brand.update({
        where: { id: params.id },
        data: { isActive: false, deletedAt: new Date() },
      })
    } else {
      await prisma.brand.delete({ where: { id: params.id } })
    }

    await audit({
      actor: session,
      action: inUse ? 'brand.archive' : 'brand.delete',
      entity: 'Brand',
      entityId: params.id,
      summary: brand.name,
      request,
    })

    return ok({ archived: inUse, deleted: !inUse })
  },
})
