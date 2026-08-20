import { prisma } from '@/lib/prisma'
import { ok, route } from '@/lib/api'
import { addressSchema } from '@/lib/validation'

export const GET = route({
  auth: 'user',
  rateLimit: false,
  async handler({ session }) {
    const addresses = await prisma.address.findMany({
      where: { userId: session!.id, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return ok({ addresses })
  },
})

export const POST = route({
  auth: 'user',
  schema: addressSchema,
  async handler({ body, session }) {
    // Only one default per customer.
    if (body.isDefault) {
      await prisma.address.updateMany({
        where: { userId: session!.id },
        data: { isDefault: false },
      })
    }

    const address = await prisma.address.create({
      data: {
        userId: session!.id,
        label: body.label ?? null,
        recipient: body.recipient,
        phone: body.phone,
        city: body.city,
        district: body.district,
        khoroo: body.khoroo,
        addressLine: body.addressLine,
        instructions: body.instructions ?? null,
        isDefault: body.isDefault,
      },
    })

    return ok({ address }, { status: 201 })
  },
})
