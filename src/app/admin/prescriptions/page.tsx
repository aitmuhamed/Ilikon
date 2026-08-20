import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { FilterPills } from '@/components/admin/table'
import { PrescriptionQueue, type PrescriptionRow } from '@/components/admin/prescription-client'
import { Alert, Spinner } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE_KEYS } from '@/lib/rbac'
import { formatNumber, maskPhone } from '@/lib/utils'

export default async function AdminPrescriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'prescriptions.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams
  const status = query.status && query.status !== 'pending' ? query.status : undefined

  // Default view is the work queue: anything awaiting a decision.
  const where =
    status && status !== 'all'
      ? { status: status as never }
      : status === 'all'
        ? {}
        : { status: { in: ['PENDING', 'CLARIFICATION_REQUESTED'] as never[] } }

  const [rows, counts] = await Promise.all([
    prisma.prescription.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            requiresPrescription: true,
            items: { select: { name: true, quantity: true, prescriptionRequired: true } },
          },
        },
        reviews: {
          include: { reviewer: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    }),
    prisma.prescription.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const countFor = (value: string) =>
    value === 'all'
      ? counts.reduce((sum, row) => sum + row._count._all, 0)
      : (counts.find((row) => row.status === value)?._count._all ?? 0)

  const pendingTotal = countFor('PENDING') + countFor('CLARIFICATION_REQUESTED')
  const showContact = can(session, 'customers.viewContact')
  const canVerify = can(session, 'prescriptions.verify')

  const prescriptions: PrescriptionRow[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    patientName: row.patientName,
    doctorName: row.doctorName,
    clinic: row.clinic,
    issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    customerNote: row.customerNote,
    createdAt: row.createdAt.toISOString(),
    customer: {
      id: row.user.id,
      fullName: row.user.fullName,
      phone: showContact ? row.user.phone : maskPhone(row.user.phone),
    },
    order: row.order,
    reviews: row.reviews.map((review) => ({
      id: review.id,
      action: review.action,
      resultStatus: review.resultStatus,
      reason: review.reason,
      pharmacistNote: review.pharmacistNote,
      reviewer: review.reviewer.fullName,
      createdAt: review.createdAt.toISOString(),
    })),
  }))

  return (
    <>
      <AdminPageHeader
        title={d.admin.prescriptions}
        subtitle={`${pendingTotal} ${d.admin.pendingPrescriptions}`}
      />

      {!canVerify ? (
        <Alert tone="info" className="mb-4" title={d.admin.verifyOnlyPharmacist}>
          {session.roleKey === ROLE_KEYS.PHARMACIST
            ? d.errors.forbiddenBody
            : `${d.admin.role}: ${session.roleName ?? '—'} — ${d.errors.forbiddenBody}`}
        </Alert>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.admin.pendingPrescriptions}
          value={formatNumber(countFor('PENDING'), locale)}
          tone="warning"
        />
        <StatCard
          label={d.prescription.statusCLARIFICATION_REQUESTED}
          value={formatNumber(countFor('CLARIFICATION_REQUESTED'), locale)}
          tone="accent"
        />
        <StatCard
          label={d.admin.verifiedPrescriptions}
          value={formatNumber(countFor('VERIFIED'), locale)}
          tone="success"
        />
        <StatCard
          label={d.admin.rejectedPrescriptions}
          value={formatNumber(countFor('REJECTED'), locale)}
          tone="danger"
        />
      </div>

      <Suspense fallback={<Spinner />}>
        <FilterPills
          className="mb-4"
          paramName="status"
          options={[
            { value: 'pending', label: d.admin.pendingPrescriptions, count: pendingTotal },
            { value: 'all', label: d.common.all, count: countFor('all') },
            { value: 'PENDING', label: d.prescription.statusPENDING, count: countFor('PENDING') },
            {
              value: 'CLARIFICATION_REQUESTED',
              label: d.prescription.statusCLARIFICATION_REQUESTED,
              count: countFor('CLARIFICATION_REQUESTED'),
            },
            { value: 'VERIFIED', label: d.prescription.statusVERIFIED, count: countFor('VERIFIED') },
            { value: 'REJECTED', label: d.prescription.statusREJECTED, count: countFor('REJECTED') },
          ]}
        />
      </Suspense>

      <PrescriptionQueue
        prescriptions={prescriptions}
        canVerify={canVerify}
        reviewerName={session.fullName}
      />
    </>
  )
}
