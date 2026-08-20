import { notFound } from 'next/navigation'

import { AdminPageHeader } from '@/components/admin/shell'
import { RolePermissionEditor, type RoleRow } from '@/components/admin/staff-client'
import { Alert } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, PERMISSION_KEYS, ROLE_KEYS } from '@/lib/rbac'

export default async function AdminRolesPage() {
  const session = (await getSession())!
  if (!can(session, 'staff.roles') && !can(session, 'staff.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)

  const roleRows = await prisma.role.findMany({
    include: {
      permissions: { include: { permission: { select: { key: true } } } },
      _count: { select: { users: true } },
    },
    orderBy: { key: 'asc' },
  })

  const roles: RoleRow[] = roleRows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    nameMn: row.nameMn,
    description: row.description,
    isSystem: row.isSystem,
    userCount: row._count.users,
    permissionKeys:
      row.key === ROLE_KEYS.SUPER_ADMIN
        ? [...PERMISSION_KEYS]
        : row.permissions.map((rolePermission) => rolePermission.permission.key),
  }))

  return (
    <>
      <AdminPageHeader
        title={d.admin.roles}
        subtitle={`${roles.length} ${d.admin.role.toLowerCase()} · ${PERMISSIONS.length} ${d.admin.permissionsCount}`}
      />

      <Alert tone="info" className="mb-4" title={d.admin.permissions}>
        {d.admin.verifyOnlyPharmacist}
      </Alert>

      <RolePermissionEditor
        roles={roles}
        permissions={PERMISSIONS}
        canEdit={can(session, 'staff.roles')}
      />
    </>
  )
}
