import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { addressSchema } from '@/lib/validation'

/** A customer can only ever touch their own addresses. */
async function assertOwned(id: string, userId: string) {
  const address = await prisma.address.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  })
  if (!address) throw new ApiError(404, 'NOT_FOUND', 'Address not found')
}

export const PUT = route<Record<string, unknown>, { id: string }>({
  auth: 'user',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: addressSchema as any,
  async handler({ body, params, session }) {
    const data = body as unknown as import('zod').infer<typeof addressSchema>
    await assertOwned(params.id, session!.id)

    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: session!.id, id: { not: params.id } },
        data: { isDefault: false },
      })
    }

    const address = await prisma.address.update({
      where: { id: params.id },
      data: {
        label: data.label ?? null,
        recipient: data.recipient,
        phone: data.phone,
        city: data.city,
        district: data.district,
        khoroo: data.khoroo,
        addressLine: data.addressLine,
        instructions: data.instructions ?? null,
        isDefault: data.isDefault,
      },
    })

    return ok({ address })
  },
})

export const DELETE = route<unknown, { id: string }>({
  auth: 'user',
  async handler({ params, session }) {
    await assertOwned(params.id, session!.id)
    // Soft delete: past orders reference the address snapshot, not this row,
    // but keeping it preserves the customer's own history view.
    await prisma.address.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isDefault: false },
    })
    return ok({ deleted: true })
  },
})
