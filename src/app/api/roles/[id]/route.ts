import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { rolePermissionsSchema } from '@/lib/validation'
import { PERMISSION_KEYS, ROLE_KEYS } from '@/lib/rbac'
import { audit } from '@/lib/audit'

/**
 * Granular permission assignment.
 *
 * Only `staff.roles` holders can reach this. The super-admin role is immutable
 * — it always holds every permission, including ones added by a later release,
 * which is what guarantees the system can never be locked out of itself.
 */
export const PATCH = route<Record<string, unknown>, { id: string }>({
  auth: { permission: 'staff.roles' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: rolePermissionsSchema as any,
  async handler({ body, params, session, request }) {
    const data = body as unknown as import('zod').infer<typeof rolePermissionsSchema>

    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: { permissions: { include: { permission: true } } },
    })
    if (!role) throw new ApiError(404, 'NOT_FOUND', 'Role not found')

    if (role.key === ROLE_KEYS.SUPER_ADMIN) {
      throw new ApiError(
        409,
        'IMMUTABLE_ROLE',
        'The super admin role always holds every permission and cannot be edited',
      )
    }
    if (role.key === ROLE_KEYS.CUSTOMER) {
      throw new ApiError(409, 'IMMUTABLE_ROLE', 'The customer role has no admin permissions')
    }

    const requested = [...new Set(data.permissionKeys)].filter((key) =>
      PERMISSION_KEYS.includes(key),
    )

    const permissions = await prisma.permission.findMany({
      where: { key: { in: requested } },
      select: { id: true, key: true },
    })

    const before = role.permissions.map((rp) => rp.permission.key).sort()

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: params.id } }),
      prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: params.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      }),
    ])

    const after = permissions.map((p) => p.key).sort()

    await audit({
      actor: session,
      action: 'role.permissions_update',
      entity: 'Role',
      entityId: params.id,
      summary: `${role.name}: ${before.length} → ${after.length} permissions`,
      changes: {
        added: after.filter((key) => !before.includes(key)),
        removed: before.filter((key) => !after.includes(key)),
      },
      request,
    })

    return ok({ permissionKeys: after })
  },
})

export const GET = route<unknown, { id: string }>({
  auth: { permission: 'staff.view' },
  async handler({ params }) {
    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    })
    if (!role) throw new ApiError(404, 'NOT_FOUND', 'Role not found')

    return ok({
      role: {
        id: role.id,
        key: role.key,
        name: role.name,
        nameMn: role.nameMn,
        description: role.description,
        isSystem: role.isSystem,
        userCount: role._count.users,
        permissionKeys:
          role.key === ROLE_KEYS.SUPER_ADMIN
            ? [...PERMISSION_KEYS]
            : role.permissions.map((rp) => rp.permission.key),
      },
    })
  },
})
