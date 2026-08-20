import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { staffSchema } from '@/lib/validation'
import { hashPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'

export const GET = route({
  auth: { permission: 'staff.view' },
  async handler() {
    const staff = await prisma.user.findMany({
      where: { isStaff: true, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        jobTitle: true,
        licenseNumber: true,
        notes: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, key: true, name: true, nameMn: true } },
        _count: { select: { prescriptionReviews: true, assignedDeliveries: true } },
      },
      orderBy: [{ role: { key: 'asc' } }, { fullName: 'asc' }],
    })

    const roles = await prisma.role.findMany({
      where: { isStaff: true },
      select: {
        id: true,
        key: true,
        name: true,
        nameMn: true,
        description: true,
        isSystem: true,
        _count: { select: { users: true, permissions: true } },
      },
      orderBy: { key: 'asc' },
    })

    return ok({ staff, roles })
  },
})

export const POST = route({
  auth: { permission: 'staff.manage' },
  schema: staffSchema,
  async handler({ body, session, request }) {
    if (!body.password) {
      throw new ApiError(400, 'PASSWORD_REQUIRED', 'A password is required for a new staff account')
    }

    const phoneTaken = await prisma.user.findUnique({ where: { phone: body.phone } })
    if (phoneTaken) throw new ApiError(409, 'PHONE_TAKEN', 'This phone number is already registered')

    if (body.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email: body.email } })
      if (emailTaken) throw new ApiError(409, 'EMAIL_TAKEN', 'This email is already registered')
    }

    const role = await prisma.role.findFirst({ where: { id: body.roleId, isStaff: true } })
    if (!role) throw new ApiError(400, 'INVALID_ROLE', 'Unknown staff role')

    const user = await prisma.user.create({
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email ?? null,
        passwordHash: await hashPassword(body.password),
        isStaff: true,
        roleId: role.id,
        jobTitle: body.jobTitle ?? null,
        licenseNumber: body.licenseNumber ?? null,
        status: body.status,
        notes: body.notes ?? null,
      },
      select: { id: true, fullName: true },
    })

    await audit({
      actor: session,
      action: 'staff.create',
      entity: 'User',
      entityId: user.id,
      summary: `${user.fullName} as ${role.name}`,
      request,
    })

    return ok({ staff: user }, { status: 201 })
  },
})
