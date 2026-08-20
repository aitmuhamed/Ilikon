import { prisma } from '@/lib/prisma'
import { ok, route } from '@/lib/api'
import { orderNoteSchema } from '@/lib/validation'
import { audit } from '@/lib/audit'

/** Internal staff notes. Never exposed on the customer order view. */
export const POST = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'orders.note' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: orderNoteSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof orderNoteSchema>

    const note = await prisma.orderNote.create({
      data: {
        orderId: params.id,
        authorId: session!.id,
        body: data.body,
        isInternal: true,
      },
      include: { author: { select: { fullName: true } } },
    })

    await audit({
      actor: session,
      action: 'order.note_add',
      entity: 'Order',
      entityId: params.id,
      request,
    })

    return ok({
      note: {
        id: note.id,
        body: note.body,
        author: note.author?.fullName ?? '—',
        createdAt: note.createdAt,
      },
    }, { status: 201 })
  },
})
