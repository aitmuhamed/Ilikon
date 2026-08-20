import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { History, Lock } from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import {
  DataTable,
  FilterPills,
  TablePagination,
  TableSearch,
  Td,
  Th,
  Tr,
} from '@/components/admin/table'
import { Alert, Badge, Spinner } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDateTime, formatNumber, truncate } from '@/lib/utils'

const PER_PAGE = 40

/** Entities whose audit rows deserve visual emphasis. */
const SENSITIVE_ENTITIES = new Set(['Prescription', 'User', 'Role', 'Setting'])

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; entity?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'audit.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams

  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const search = (query.q ?? '').trim()
  const entity = query.entity && query.entity !== 'all' ? query.entity : undefined

  const where = {
    ...(entity ? { entity } : {}),
    ...(search
      ? {
          OR: [
            { action: { contains: search, mode: 'insensitive' as const } },
            { summary: { contains: search, mode: 'insensitive' as const } },
            { actorLabel: { contains: search, mode: 'insensitive' as const } },
            { entityId: { contains: search } },
          ],
        }
      : {}),
  }

  const [total, logs, entityCounts, prescriptionAccessCount] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.auditLog.groupBy({ by: ['entity'], _count: { _all: true } }),
    prisma.auditLog.count({ where: { action: { startsWith: 'prescription.file_access' } } }),
  ])

  const countFor = (value: string) =>
    value === 'all'
      ? entityCounts.reduce((sum, row) => sum + row._count._all, 0)
      : (entityCounts.find((row) => row.entity === value)?._count._all ?? 0)

  return (
    <>
      <AdminPageHeader
        title={d.admin.auditLog}
        subtitle={`${total} ${d.common.results}`}
      />

      <Alert tone="info" className="mb-4" title={d.admin.prescriptionAccessNotice}>
        {d.prescription.privacyNotice}
      </Alert>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.admin.auditLog}
          value={formatNumber(countFor('all'), locale)}
          tone="brand"
          icon={<History className="h-4 w-4" />}
        />
        <StatCard
          label={d.admin.prescriptions}
          value={formatNumber(prescriptionAccessCount, locale)}
          sub={d.admin.viewFile}
          tone="accent"
          icon={<Lock className="h-4 w-4" />}
        />
        <StatCard label={d.admin.products} value={formatNumber(countFor('Product'), locale)} />
        <StatCard label={d.admin.orders} value={formatNumber(countFor('Order'), locale)} />
      </div>

      <Suspense fallback={<Spinner />}>
        <div className="mb-4 space-y-3">
          <FilterPills
            paramName="entity"
            options={[
              { value: 'all', label: d.common.all, count: countFor('all') },
              { value: 'Prescription', label: d.admin.prescriptions, count: countFor('Prescription') },
              { value: 'Order', label: d.admin.orders, count: countFor('Order') },
              { value: 'Product', label: d.admin.products, count: countFor('Product') },
              { value: 'User', label: d.admin.staff, count: countFor('User') },
              { value: 'Setting', label: d.admin.settings, count: countFor('Setting') },
            ]}
          />
          <TableSearch placeholder={`${d.common.actions} / ${d.admin.reviewer}`} />
        </div>
      </Suspense>

      <DataTable
        isEmpty={logs.length === 0}
        empty={d.admin.emptyTable}
        head={
          <>
            <Th>{d.common.date}</Th>
            <Th>{d.admin.reviewer}</Th>
            <Th>{d.common.actions}</Th>
            <Th>Entity</Th>
            <Th>{d.admin.shortDescription}</Th>
            <Th>IP</Th>
          </>
        }
      >
        {logs.map((log) => (
          <Tr key={log.id}>
            <Td className="whitespace-nowrap text-xs text-ink-500 tabular">
              {formatDateTime(log.createdAt, locale)}
            </Td>
            <Td className="max-w-[180px] truncate text-xs">{log.actorLabel ?? '—'}</Td>
            <Td>
              <Badge
                tone={
                  log.action.includes('denied') || log.action.includes('failed')
                    ? 'danger'
                    : log.action.startsWith('prescription')
                      ? 'accent'
                      : log.action.includes('delete') || log.action.includes('archive')
                        ? 'warning'
                        : 'neutral'
                }
              >
                {log.action}
              </Badge>
            </Td>
            <Td>
              <span
                className={
                  SENSITIVE_ENTITIES.has(log.entity)
                    ? 'text-xs font-semibold text-accent-700'
                    : 'text-xs text-ink-600'
                }
              >
                {log.entity}
              </span>
              {log.entityId ? (
                <span className="block max-w-[120px] truncate text-[10px] text-ink-300 tabular">
                  {log.entityId}
                </span>
              ) : null}
            </Td>
            <Td className="max-w-[280px] text-xs text-ink-600">
              {log.summary ? truncate(log.summary, 90) : '—'}
            </Td>
            <Td className="text-xs text-ink-400 tabular">{log.ip ?? '—'}</Td>
          </Tr>
        ))}
      </DataTable>

      <Suspense fallback={null}>
        <TablePagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
          total={total}
        />
      </Suspense>
    </>
  )
}
