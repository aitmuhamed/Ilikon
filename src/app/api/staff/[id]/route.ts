import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { staffSchema } from '@/lib/validation'
import { hashPassword } from '@/lib/auth'
import { ROLE_KEYS } from '@/lib/rbac'
import { audit, diffChanges } from '@/lib/audit'

export const PUT = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'staff.manage' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: staffSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof staffSchema>

    const current = await prisma.user.findFirst({
      where: { id: params.id, isStaff: true, deletedAt: null },
      include: { role: true },
    })
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Staff member not found')

    if (data.phone !== current.phone) {
      const taken = await prisma.user.findUnique({ where: { phone: data.phone } })
      if (taken) throw new ApiError(409, 'PHONE_TAKEN', 'This phone number is already registered')
    }
    if (data.email && data.email !== current.email) {
      const taken = await prisma.user.findUnique({ where: { email: data.email } })
      if (taken) throw new ApiError(409, 'EMAIL_TAKEN', 'This email is already registered')
    }

    const role = await prisma.role.findFirst({ where: { id: data.roleId, isStaff: true } })
    if (!role) throw new ApiError(400, 'INVALID_ROLE', 'Unknown staff role')

    // Guard against locking everyone out of the system.
    if (
      current.role?.key === ROLE_KEYS.SUPER_ADMIN &&
      (role.key !== ROLE_KEYS.SUPER_ADMIN || data.status !== 'ACTIVE')
    ) {
      const remaining = await prisma.user.count({
        where: {
          isStaff: true,
          deletedAt: null,
          status: 'ACTIVE',
          role: { key: ROLE_KEYS.SUPER_ADMIN },
          id: { not: params.id },
        },
      })
      if (remaining === 0) {
        throw new ApiError(
          409,
          'LAST_SUPER_ADMIN',
          'At least one active super admin must remain',
        )
      }
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email ?? null,
        roleId: role.id,
        jobTitle: data.jobTitle ?? null,
        licenseNumber: data.licenseNumber ?? null,
        status: data.status,
        notes: data.notes ?? null,
        ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
      },
      select: { id: true, fullName: true, status: true, roleId: true },
    })

    await audit({
      actor: session,
      action: 'staff.update',
      entity: 'User',
      entityId: params.id,
      summary: `${updated.fullName} → ${role.name}${data.password ? ' (password reset)' : ''}`,
      changes: diffChanges(
        { ...current, passwordHash: 'x' } as unknown as Record<string, unknown>,
        { ...updated, passwordHash: data.password ? 'y' : 'x' } as unknown as Record<string, unknown>,
      ),
      request,
    })

    return ok({ staff: updated })
  },
})

/** Staff accounts are deactivated, never hard-deleted — they own audit rows. */
export const DELETE = route<unknown, { id: string }>({
  auth: { permission: 'staff.manage' },
  async handler({ params, session, request }) {
    const staff = await prisma.user.findFirst({
      where: { id: params.id, isStaff: true, deletedAt: null },
      include: { role: true },
    })
    if (!staff) throw new ApiError(404, 'NOT_FOUND', 'Staff member not found')
    if (staff.id === session!.id) {
      throw new ApiError(409, 'CANNOT_DISABLE_SELF', 'You cannot disable your own account')
    }

    if (staff.role?.key === ROLE_KEYS.SUPER_ADMIN) {
      const remaining = await prisma.user.count({
        where: {
          isStaff: true,
          deletedAt: null,
          status: 'ACTIVE',
          role: { key: ROLE_KEYS.SUPER_ADMIN },
          id: { not: params.id },
        },
      })
      if (remaining === 0) {
        throw new ApiError(409, 'LAST_SUPER_ADMIN', 'At least one active super admin must remain')
      }
    }

    await prisma.user.update({
      where: { id: params.id },
      data: { status: 'DISABLED', deletedAt: new Date() },
    })

    await audit({
      actor: session,
      action: 'staff.deactivate',
      entity: 'User',
      entityId: params.id,
      summary: staff.fullName,
      request,
    })

    return ok({ deactivated: true })
  },
})
