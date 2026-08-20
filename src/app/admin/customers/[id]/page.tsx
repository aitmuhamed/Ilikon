import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileText, Lock, Mail, MapPin, Package, Phone } from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { CustomerStatusToggle } from '@/components/admin/misc-client'
import {
  Alert,
  Badge,
  Card,
  ORDER_STATUS_TONE,
  PRESCRIPTION_STATUS_TONE,
} from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate, formatDateTime, formatMnt, maskEmail, maskPhone } from '@/lib/utils'

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = (await getSession())!
  if (!can(session, 'customers.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const showContact = can(session, 'customers.viewContact')

  const customer = await prisma.user.findFirst({
    where: { id, isStaff: false, deletedAt: null },
    include: {
      addresses: { where: { deletedAt: null }, orderBy: { isDefault: 'desc' } },
      orders: {
        include: { _count: { select: { items: true } }, payment: { select: { method: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      prescriptions: {
        select: { id: true, code: true, status: true, createdAt: true, orderId: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      reviews: {
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })
  if (!customer) notFound()

  const stats = await prisma.order.aggregate({
    where: { userId: id, status: { not: 'CANCELLED' } },
    _sum: { total: true },
    _count: { _all: true },
    _avg: { total: true },
  })

  return (
    <>
      <AdminPageHeader
        title={customer.fullName}
        backHref="/admin/customers"
        subtitle={`${d.admin.customerSince}: ${formatDate(customer.createdAt, locale)}`}
        badge={
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={customer.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {customer.status === 'ACTIVE' ? d.common.active : d.common.disabled}
            </Badge>
            {customer.marketingOptIn ? <Badge tone="accent">{d.account.marketingOptIn}</Badge> : null}
          </div>
        }
        actions={
          can(session, 'customers.manage') ? (
            <CustomerStatusToggle
              customerId={customer.id}
              status={customer.status}
              name={customer.fullName}
            />
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.account.totalOrders}
          value={String(stats._count._all)}
          tone="brand"
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard label={d.account.totalSpent} value={formatMnt(stats._sum.total ?? 0, locale)} tone="success" />
        <StatCard
          label={d.admin.avgOrderValue}
          value={formatMnt(Math.round(stats._avg.total ?? 0), locale)}
        />
        <StatCard
          label={d.admin.prescriptions}
          value={String(customer.prescriptions.length)}
          tone={customer.prescriptions.length > 0 ? 'accent' : 'default'}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* Orders */}
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.account.orderHistory}</h2>
            {customer.orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {customer.orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 transition-colors hover:bg-brand-50/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900 tabular">{order.orderNumber}</p>
                        <p className="text-xs text-ink-500">
                          {formatDateTime(order.createdAt, locale)} · {order._count.items} {d.cart.items}
                          {order.payment ? ` · ${d.paymentMethod[order.payment.method]}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {order.requiresPrescription ? (
                          <Badge tone={order.prescriptionCleared ? 'success' : 'warning'}>
                            {d.product.prescriptionRequiredShort}
                          </Badge>
                        ) : null}
                        <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                          {d.orderStatus[order.status]}
                        </Badge>
                        <span className="w-24 text-right text-sm font-bold text-ink-900 tabular">
                          {formatMnt(order.total, locale)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Prescriptions */}
          {can(session, 'prescriptions.view') ? (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.prescriptions}</h2>
              {customer.prescriptions.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">{d.prescription.noPrescriptions}</p>
              ) : (
                <ul className="space-y-2">
                  {customer.prescriptions.map((prescription) => (
                    <li
                      key={prescription.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200 p-2.5"
                    >
                      <span className="text-xs font-semibold text-ink-900 tabular">
                        {prescription.code}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-ink-400">
                          {formatDate(prescription.createdAt, locale)}
                        </span>
                        <Badge tone={PRESCRIPTION_STATUS_TONE[prescription.status] ?? 'neutral'}>
                          {
                            d.prescription[
                              `status${prescription.status}` as keyof typeof d.prescription
                            ] as string
                          }
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-ink-400">{d.admin.prescriptionAccessNotice}</p>
            </Card>
          ) : null}

          {/* Reviews */}
          {customer.reviews.length > 0 ? (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.reviews}</h2>
              <ul className="space-y-2">
                {customer.reviews.map((review) => (
                  <li key={review.id} className="rounded-lg bg-ink-50 p-2.5">
                    <p className="text-xs font-medium text-ink-800">
                      {review.product.name} · {review.rating}★
                    </p>
                    {review.comment ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-600">{review.comment}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.footer.contact}</h2>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                <span className="tabular">
                  {showContact ? customer.phone : maskPhone(customer.phone)}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                <span className="min-w-0 truncate">
                  {showContact ? (customer.email ?? '—') : maskEmail(customer.email)}
                </span>
              </li>
            </ul>
            {!showContact ? (
              <Alert tone="info" className="mt-3">
                <span className="flex items-start gap-1.5 text-xs">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  {d.admin.contactMaskedNote}
                </span>
              </Alert>
            ) : null}
            <dl className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-400">{d.auth.loginSubmit}</dt>
                <dd className="text-ink-700">
                  {customer.lastLoginAt ? formatDateTime(customer.lastLoginAt, locale) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-400">{d.nav.language}</dt>
                <dd className="text-ink-700 uppercase">{customer.locale}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <MapPin className="h-4 w-4 text-ink-400" aria-hidden />
              {d.account.addresses}
            </h2>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-ink-400">{d.admin.emptyTable}</p>
            ) : (
              <ul className="space-y-2.5">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="rounded-lg border border-ink-200 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink-900">
                        {address.label || address.recipient}
                      </span>
                      {address.isDefault ? <Badge tone="brand">{d.account.defaultAddress}</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-600">
                      {showContact
                        ? `${address.district}, ${address.khoroo}, ${address.addressLine}`
                        : `${address.district}, •••`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
