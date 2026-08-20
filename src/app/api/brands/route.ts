import { prisma } from '@/lib/prisma'
import { ok, readPagination, pageMeta, route } from '@/lib/api'
import { brandSchema } from '@/lib/validation'
import { slugify } from '@/lib/utils'
import { audit } from '@/lib/audit'
import { sellableWhere } from '@/lib/products'
import { mediaUrl } from '@/lib/storage'

export const GET = route({
  auth: 'public',
  rateLimit: false,
  async handler({ query }) {
    const pagination = readPagination(query, 50, 200)
    const search = (query.get('q') ?? '').trim()
    const includeInactive = query.get('all') === '1'

    const where = {
      deletedAt: null,
      ...(includeInactive ? {} : { isActive: true }),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.brand.count({ where }),
      prisma.brand.findMany({
        where,
        include: { _count: { select: { products: { where: sellableWhere() } } } },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])

    return ok({
      brands: rows.map((brand) => ({
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
        country: brand.country,
        description: brand.description,
        website: brand.website,
        isActive: brand.isActive,
        logoUrl: mediaUrl(brand.logoKey),
        productCount: brand._count.products,
      })),
      meta: pageMeta(pagination, total),
    })
  },
})

export const POST = route({
  auth: { permission: 'brands.manage' },
  schema: brandSchema,
  async handler({ body, session, request }) {
    const slug = await uniqueSlug(body.slug || slugify(body.name))

    const brand = await prisma.brand.create({
      data: {
        name: body.name,
        slug,
        logoKey: body.logoKey ?? null,
        description: body.description ?? null,
        country: body.country ?? null,
        website: body.website ?? null,
        isActive: body.isActive,
      },
    })

    await audit({
      actor: session,
      action: 'brand.create',
      entity: 'Brand',
      entityId: brand.id,
      summary: brand.name,
      request,
    })

    return ok({ brand }, { status: 201 })
  },
})

async function uniqueSlug(base: string): Promise<string> {
  const candidate = base || 'brand'
  if (!(await prisma.brand.findUnique({ where: { slug: candidate } }))) return candidate
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const next = `${candidate}-${suffix}`
    // eslint-disable-next-line no-await-in-loop
    if (!(await prisma.brand.findUnique({ where: { slug: next } }))) return next
  }
  return `${candidate}-${Date.now()}`
}
