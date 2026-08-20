import { notFound } from 'next/navigation'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { StaffManager, type RoleRow, type StaffRow } from '@/components/admin/staff-client'
import { Alert } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSION_KEYS, ROLE_KEYS } from '@/lib/rbac'
import { formatNumber } from '@/lib/utils'

export default async function AdminStaffPage() {
  const session = (await getSession())!
  if (!can(session, 'staff.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)

  const [rows, roleRows] = await Promise.all([
    prisma.user.findMany({
      where: { isStaff: true, deletedAt: null },
      include: {
        role: { select: { id: true, key: true, name: true, nameMn: true } },
        _count: { select: { prescriptionReviews: true, assignedDeliveries: true } },
      },
      orderBy: [{ role: { key: 'asc' } }, { fullName: 'asc' }],
    }),
    prisma.role.findMany({
      where: { isStaff: true },
      include: {
        permissions: { include: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
      orderBy: { key: 'asc' },
    }),
  ])

  const staff: StaffRow[] = rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    status: row.status,
    jobTitle: row.jobTitle,
    licenseNumber: row.licenseNumber,
    notes: row.notes,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    role: row.role,
    reviewCount: row._count.prescriptionReviews,
    deliveryCount: row._count.assignedDeliveries,
  }))

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

  const pharmacists = staff.filter((member) => member.role?.key === ROLE_KEYS.PHARMACIST)
  const activeCount = staff.filter((member) => member.status === 'ACTIVE').length

  return (
    <>
      <AdminPageHeader title={d.admin.staff} subtitle={`${staff.length} ${d.common.results}`} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={d.admin.staff} value={formatNumber(staff.length, locale)} tone="brand" />
        <StatCard label={d.common.active} value={formatNumber(activeCount, locale)} tone="success" />
        <StatCard
          label={d.admin.reviewer}
          value={formatNumber(pharmacists.length, locale)}
          sub={d.admin.verifyOnlyPharmacist}
          tone={pharmacists.length === 0 ? 'danger' : 'accent'}
        />
        <StatCard label={d.admin.roles} value={formatNumber(roles.length, locale)} />
      </div>

      {pharmacists.filter((member) => member.status === 'ACTIVE').length === 0 ? (
        <Alert tone="danger" className="mb-4" title={d.admin.verifyOnlyPharmacist}>
          {d.prescription.safetyNotice}
        </Alert>
      ) : null}

      <StaffManager
        staff={staff}
        roles={roles}
        canManage={can(session, 'staff.manage')}
        currentUserId={session.id}
      />
    </>
  )
}
