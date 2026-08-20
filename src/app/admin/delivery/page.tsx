import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { MapPin, Phone, Store, Truck } from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { DeliveryStatusControl } from '@/components/admin/order-client'
import { FilterPills } from '@/components/admin/table'
import { Badge, Card, Spinner } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDateTime, formatMnt, formatNumber, maskPhone } from '@/lib/utils'

export default async function AdminDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; scope?: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'delivery.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const query = await searchParams

  const canManage = can(session, 'delivery.manage')
  const ownOnly = !canManage && can(session, 'delivery.own')
  const status = query.status && query.status !== 'active' ? query.status : undefined

  const where = {
    // A courier sees only their own assignments; a manager sees everything.
    ...(ownOnly ? { courierId: session.id } : {}),
    ...(status && status !== 'all'
      ? { status: status as never }
      : status === 'all'
        ? {}
        : { status: { in: ['PENDING', 'ASSIGNED', 'IN_TRANSIT'] as never[] } }),
  }

  const [deliveries, counts, couriers] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            customerName: true,
            requiresPrescription: true,
            prescriptionCleared: true,
            payment: { select: { method: true, status: true } },
            _count: { select: { items: true } },
          },
        },
        courier: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 60,
    }),
    prisma.delivery.groupBy({
      by: ['status'],
      where: ownOnly ? { courierId: session.id } : {},
      _count: { _all: true },
    }),
    canManage
      ? prisma.user.findMany({
          where: { isStaff: true, deletedAt: null, status: 'ACTIVE', role: { key: 'delivery_staff' } },
          select: { id: true, fullName: true, _count: { select: { assignedDeliveries: true } } },
        })
      : Promise.resolve([]),
  ])

  const countFor = (value: string) =>
    value === 'all'
      ? counts.reduce((sum, row) => sum + row._count._all, 0)
      : (counts.find((row) => row.status === value)?._count._all ?? 0)

  const showContact = can(session, 'customers.viewContact') || ownOnly

  return (
    <>
      <AdminPageHeader
        title={d.admin.delivery}
        subtitle={ownOnly ? d.admin.courier : `${countFor('all')} ${d.common.results}`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.deliveryStatus.PENDING}
          value={formatNumber(countFor('PENDING'), locale)}
          tone={countFor('PENDING') > 0 ? 'warning' : 'default'}
        />
        <StatCard label={d.deliveryStatus.ASSIGNED} value={formatNumber(countFor('ASSIGNED'), locale)} tone="accent" />
        <StatCard label={d.deliveryStatus.IN_TRANSIT} value={formatNumber(countFor('IN_TRANSIT'), locale)} tone="brand" />
        <StatCard label={d.deliveryStatus.DELIVERED} value={formatNumber(countFor('DELIVERED'), locale)} tone="success" />
      </div>

      {canManage && couriers.length > 0 ? (
        <Card className="mb-4">
          <h2 className="mb-2.5 text-sm font-semibold text-ink-900">{d.admin.courier}</h2>
          <div className="flex flex-wrap gap-2">
            {couriers.map((courier) => (
              <span
                key={courier.id}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                  {courier.fullName.slice(0, 1)}
                </span>
                <span className="font-medium text-ink-800">{courier.fullName}</span>
                <span className="text-ink-400 tabular">{courier._count.assignedDeliveries}</span>
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      <Suspense fallback={<Spinner />}>
        <FilterPills
          className="mb-4"
          paramName="status"
          options={[
            { value: 'active', label: d.common.active },
            { value: 'PENDING', label: d.deliveryStatus.PENDING, count: countFor('PENDING') },
            { value: 'ASSIGNED', label: d.deliveryStatus.ASSIGNED, count: countFor('ASSIGNED') },
            { value: 'IN_TRANSIT', label: d.deliveryStatus.IN_TRANSIT, count: countFor('IN_TRANSIT') },
            { value: 'DELIVERED', label: d.deliveryStatus.DELIVERED, count: countFor('DELIVERED') },
            { value: 'all', label: d.common.all, count: countFor('all') },
          ]}
        />
      </Suspense>

      {deliveries.length === 0 ? (
        <Card>
          <p className="py-12 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {deliveries.map((delivery) => {
            const isPickup = delivery.method === 'PHARMACY_PICKUP'
            const blocked =
              delivery.order.requiresPrescription && !delivery.order.prescriptionCleared

            return (
              <Card key={delivery.id}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/orders/${delivery.order.id}`}
                      className="text-sm font-bold text-ink-900 hover:text-brand-700 tabular"
                    >
                      {delivery.order.orderNumber}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {delivery.order.customerName} · {delivery.order._count.items} {d.cart.items} ·{' '}
                      {formatMnt(delivery.order.total, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={isPickup ? 'neutral' : 'brand'} icon={isPickup ? <Store className="h-3 w-3" /> : <Truck className="h-3 w-3" />}>
                      {d.deliveryMethod[delivery.method]}
                    </Badge>
                    <Badge
                      tone={
                        delivery.status === 'DELIVERED'
                          ? 'success'
                          : delivery.status === 'IN_TRANSIT'
                            ? 'accent'
                            : delivery.status === 'FAILED' || delivery.status === 'RETURNED'
                              ? 'danger'
                              : 'warning'
                      }
                    >
                      {d.deliveryStatus[delivery.status]}
                    </Badge>
                  </div>
                </div>

                <div className="py-3">
                  {blocked ? (
                    <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-900">
                      {d.prescription.awaitingVerification}
                    </p>
                  ) : null}

                  {!isPickup ? (
                    <div className="space-y-1.5 text-xs">
                      <p className="flex gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                        <span className="text-ink-700">
                          {showContact
                            ? [delivery.district, delivery.khoroo, delivery.addressLine]
                                .filter(Boolean)
                                .join(', ')
                            : `${delivery.district ?? ''} •••`}
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                        {showContact && delivery.phone ? (
                          <a href={`tel:${delivery.phone}`} className="text-brand-700 tabular hover:underline">
                            {delivery.phone}
                          </a>
                        ) : (
                          <span className="tabular">{maskPhone(delivery.phone ?? '')}</span>
                        )}
                      </p>
                      {delivery.instructions ? (
                        <p className="italic text-ink-500">{delivery.instructions}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-500">{d.checkout.pickupDesc}</p>
                  )}

                  <p className="mt-2 text-[11px] text-ink-400">
                    {delivery.courier ? `${d.admin.courier}: ${delivery.courier.fullName} · ` : ''}
                    {delivery.order.payment
                      ? `${d.paymentMethod[delivery.order.payment.method]} · ${
                          d.paymentStatus[delivery.order.payment.status]
                        } · `
                      : ''}
                    {formatDateTime(delivery.createdAt, locale)}
                  </p>
                </div>

                {canManage || (ownOnly && delivery.courierId === session.id) ? (
                  <div className="border-t border-ink-100 pt-3">
                    <DeliveryStatusControl deliveryId={delivery.id} status={delivery.status} compact />
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
