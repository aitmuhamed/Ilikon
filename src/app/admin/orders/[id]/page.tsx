import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, FileText, MapPin, Package, Store, Truck, User } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/shell'
import {
  ContactCustomerButton,
  DeliveryStatusControl,
  OrderWorkflow,
  PaymentStatusControl,
  PrintTimestamp,
} from '@/components/admin/order-client'
import {
  Alert,
  Badge,
  Card,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  PRESCRIPTION_STATUS_TONE,
} from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { getOrderForStaff } from '@/lib/orders'
import { getSettings, localizedAddress } from '@/lib/settings'
import { prisma } from '@/lib/prisma'
import { mediaUrl } from '@/lib/storage'
import { formatDateTime, formatMnt, maskEmail, maskPhone } from '@/lib/utils'

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = (await getSession())!
  if (!can(session, 'orders.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)

  const order = await getOrderForStaff(id)
  if (!order) notFound()

  const settings = await getSettings()
  const showContact = can(session, 'customers.viewContact')

  const couriers = can(session, 'delivery.manage')
    ? await prisma.user.findMany({
        where: { isStaff: true, deletedAt: null, status: 'ACTIVE', role: { key: 'delivery_staff' } },
        select: { id: true, fullName: true },
      })
    : []

  const isPickup = order.delivery?.method === 'PHARMACY_PICKUP'

  return (
    <>
      <div className="no-print">
        <AdminPageHeader
          title={order.orderNumber}
          backHref="/admin/orders"
          subtitle={`${formatDateTime(order.createdAt, locale)} · ${order.customerName}`}
          badge={
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                {d.orderStatus[order.status]}
              </Badge>
              {order.requiresPrescription ? (
                <Badge
                  tone={order.prescriptionCleared ? 'success' : 'warning'}
                  icon={<FileText className="h-3 w-3" />}
                >
                  {order.prescriptionCleared
                    ? d.prescription.statusVERIFIED
                    : d.prescription.awaitingVerification}
                </Badge>
              ) : null}
            </div>
          }
          actions={
            <>
              {showContact ? (
                <ContactCustomerButton phone={order.customerPhone} name={order.customerName} />
              ) : null}
              {can(session, 'prescriptions.view') && order.prescriptions.length > 0 ? (
                <Link href="/admin/prescriptions">
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4" aria-hidden />
                    {d.admin.prescriptions}
                  </Button>
                </Link>
              ) : null}
            </>
          }
        />
      </div>

      {/* Print header — only visible on paper */}
      <div className="hidden print:mb-6 print:block">
        <div className="flex items-start justify-between border-b-2 border-ink-900 pb-3">
          <div>
            <p className="text-xl font-extrabold">{settings.pharmacyName}</p>
            <p className="text-sm">{settings.pharmacyTagline}</p>
            <p className="mt-1 text-xs">{localizedAddress(settings, locale)}</p>
            <p className="text-xs">
              {settings.phone} · {settings.email}
            </p>
            <p className="text-xs">№ {settings.licenseNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{d.admin.invoiceTitle}</p>
            <p className="text-sm tabular">{order.orderNumber}</p>
            <p className="text-xs">{formatDateTime(order.createdAt, locale)}</p>
            <p className="text-xs">
              {d.common.print}: <PrintTimestamp locale={locale} />
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          {/* Items */}
          <Card className="print-sheet">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.orderItems}</h2>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-[11px] uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3">{d.common.name}</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 text-right">{d.common.price}</th>
                    <th className="px-3 py-2 text-center">{d.common.quantity}</th>
                    <th className="py-2 pl-3 text-right">{d.cart.total}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50 print:hidden">
                            {mediaUrl(item.imageKey) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={mediaUrl(item.imageKey)!}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-4 w-4 text-ink-300" aria-hidden />
                            )}
                          </span>
                          <span className="min-w-0">
                            {item.product?.slug ? (
                              <Link
                                href={`/${locale}/products/${item.product.slug}`}
                                className="line-clamp-2 font-medium text-ink-900 hover:text-brand-700"
                              >
                                {item.name}
                              </Link>
                            ) : (
                              <span className="line-clamp-2 font-medium text-ink-900">{item.name}</span>
                            )}
                            {item.prescriptionRequired ? (
                              <Badge tone="rx" className="mt-0.5">
                                {d.product.prescriptionRequiredShort}
                              </Badge>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-500 tabular">{item.sku}</td>
                      <td className="px-3 py-2.5 text-right tabular">
                        {formatMnt(item.unitPrice, locale)}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular">{item.quantity}</td>
                      <td className="py-2.5 pl-3 text-right font-semibold tabular">
                        {formatMnt(item.lineTotal, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-ink-200 pt-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">{d.cart.subtotal}</dt>
                <dd className="tabular">{formatMnt(order.subtotal, locale)}</dd>
              </div>
              {order.discountTotal > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">
                    {d.cart.discount}
                    {order.couponCode ? ` (${order.couponCode})` : ''}
                  </dt>
                  <dd className="font-semibold text-success tabular">
                    −{formatMnt(order.discountTotal, locale)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">{d.cart.deliveryFee}</dt>
                <dd className="tabular">{formatMnt(order.deliveryFee, locale)}</dd>
              </div>
              {order.taxTotal > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">{d.admin.taxRate}</dt>
                  <dd className="tabular">{formatMnt(order.taxTotal, locale)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-ink-200 pt-2">
                <dt className="font-bold text-ink-900">{d.cart.total}</dt>
                <dd className="text-lg font-extrabold text-ink-900 tabular">
                  {formatMnt(order.total, locale)}
                </dd>
              </div>
            </dl>

            <p className="mt-4 hidden text-[10px] leading-relaxed text-ink-500 print:block">
              {d.footer.disclaimer}
            </p>
          </Card>

          {/* Prescriptions */}
          {order.prescriptions.length > 0 && can(session, 'prescriptions.view') ? (
            <Card className="no-print">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
                <FileText className="h-4 w-4 text-accent-600" aria-hidden />
                {d.admin.prescriptions}
              </h2>
              <Alert tone="info" className="mb-3">
                {d.admin.prescriptionAccessNotice}
              </Alert>
              <ul className="space-y-2.5">
                {order.prescriptions.map((prescription) => (
                  <li key={prescription.id} className="rounded-xl border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-900 tabular">
                        {prescription.code}
                      </span>
                      <Badge tone={PRESCRIPTION_STATUS_TONE[prescription.status] ?? 'neutral'}>
                        {
                          d.prescription[
                            `status${prescription.status}` as keyof typeof d.prescription
                          ] as string
                        }
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {prescription.doctorName ?? '—'} · {prescription.clinic ?? '—'} ·{' '}
                      {formatDateTime(prescription.createdAt, locale)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={`/api/prescriptions/${prescription.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline">
                          {d.admin.viewFile}
                        </Button>
                      </a>
                      {can(session, 'prescriptions.verify') ? (
                        <Link href="/admin/prescriptions">
                          <Button size="sm" variant="accent">
                            {d.admin.approve} / {d.admin.reject}
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Timeline */}
          <Card className="no-print">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Clock className="h-4 w-4 text-brand-600" aria-hidden />
              {d.admin.orderTimeline}
            </h2>
            <ol className="relative space-y-4 border-l border-ink-200 pl-5">
              {order.events.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white"
                    aria-hidden
                  />
                  <p className="text-sm font-medium text-ink-900">{event.title}</p>
                  {event.message ? <p className="mt-0.5 text-xs text-ink-600">{event.message}</p> : null}
                  <p className="mt-0.5 text-xs text-ink-400">
                    {formatDateTime(event.createdAt, locale)}
                    {event.actor ? ` · ${event.actor.fullName}` : ` · ${d.admin.title}`}
                  </p>
                </li>
              ))}
            </ol>
          </Card>

          {/* Internal notes */}
          {can(session, 'orders.note') ? (
            <Card className="no-print">
              <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.internalNotes}</h2>
              {order.notes.length === 0 ? (
                <p className="text-sm text-ink-400">{d.admin.emptyTable}</p>
              ) : (
                <ul className="space-y-2.5">
                  {order.notes.map((note) => (
                    <li key={note.id} className="rounded-xl bg-ink-50 p-3">
                      <p className="text-sm text-ink-800">{note.body}</p>
                      <p className="mt-1 text-xs text-ink-400">
                        {note.author?.fullName ?? '—'} · {formatDateTime(note.createdAt, locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {can(session, 'orders.update') || can(session, 'orders.cancel') || can(session, 'orders.note') ? (
            <div className="no-print">
              <OrderWorkflow
                orderId={order.id}
                status={order.status}
                requiresPrescription={order.requiresPrescription}
                prescriptionCleared={order.prescriptionCleared}
                canUpdate={can(session, 'orders.update')}
                canCancel={can(session, 'orders.cancel')}
                canNote={can(session, 'orders.note')}
                couriers={couriers}
                deliveryId={order.delivery?.id ?? null}
                courierId={order.delivery?.courierId ?? null}
                canAssignCourier={can(session, 'delivery.manage')}
              />
            </div>
          ) : null}

          {/* Customer */}
          <Card className="print-sheet">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <User className="h-4 w-4 text-brand-600" aria-hidden />
              {d.admin.customer}
            </h2>
            <dl className="space-y-2 text-sm">
              <Row label={d.common.name} value={order.customerName} />
              <Row
                label={d.common.phone}
                value={showContact ? order.customerPhone : maskPhone(order.customerPhone)}
              />
              <Row
                label={d.common.email}
                value={showContact ? (order.customerEmail ?? '—') : maskEmail(order.customerEmail)}
              />
            </dl>
            {!showContact ? (
              <p className="mt-2 text-[11px] text-ink-400">{d.admin.contactMaskedNote}</p>
            ) : null}
            {order.user && can(session, 'customers.view') ? (
              <Link
                href={`/admin/customers/${order.user.id}`}
                className="mt-3 block text-xs font-medium text-brand-700 hover:underline no-print"
              >
                {d.admin.customerActivity} →
              </Link>
            ) : null}
            {order.customerNote ? (
              <div className="mt-3 rounded-lg bg-amber-50 p-2.5">
                <p className="text-[11px] font-semibold text-amber-900">{d.checkout.customerNote}</p>
                <p className="mt-0.5 text-xs text-amber-900/90">{order.customerNote}</p>
              </div>
            ) : null}
          </Card>

          {/* Delivery */}
          <Card className="print-sheet">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              {isPickup ? (
                <Store className="h-4 w-4 text-brand-600" aria-hidden />
              ) : (
                <Truck className="h-4 w-4 text-brand-600" aria-hidden />
              )}
              {d.admin.deliveryInfo}
            </h2>
            <dl className="space-y-2 text-sm">
              <Row label={d.checkout.deliveryMethod} value={d.deliveryMethod[order.delivery!.method]} />
              <Row label={d.common.status} value={d.deliveryStatus[order.delivery!.status]} />
              {!isPickup ? (
                <>
                  <Row label={d.account.recipient} value={order.delivery?.recipient ?? '—'} />
                  <Row
                    label={d.common.phone}
                    value={
                      showContact
                        ? (order.delivery?.phone ?? '—')
                        : maskPhone(order.delivery?.phone ?? '')
                    }
                  />
                  <div className="flex gap-2 border-t border-ink-100 pt-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                    <p className="text-xs leading-relaxed text-ink-700">
                      {showContact
                        ? [
                            order.delivery?.district,
                            order.delivery?.khoroo,
                            order.delivery?.addressLine,
                          ]
                            .filter(Boolean)
                            .join(', ')
                        : '•••'}
                    </p>
                  </div>
                  {order.delivery?.instructions ? (
                    <p className="text-xs italic text-ink-500">{order.delivery.instructions}</p>
                  ) : null}
                </>
              ) : (
                <Row label={d.common.address} value={localizedAddress(settings, locale)} />
              )}
              {order.delivery?.courier ? (
                <Row label={d.admin.courier} value={order.delivery.courier.fullName} />
              ) : null}
            </dl>

            {(can(session, 'delivery.manage') ||
              (can(session, 'delivery.own') && order.delivery?.courierId === session.id)) &&
            order.delivery ? (
              <div className="mt-3 no-print">
                <DeliveryStatusControl deliveryId={order.delivery.id} status={order.delivery.status} />
              </div>
            ) : null}
          </Card>

          {/* Payment */}
          <Card className="print-sheet">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.paymentInfo}</h2>
            <dl className="space-y-2 text-sm">
              <Row label={d.checkout.paymentMethod} value={d.paymentMethod[order.payment!.method]} />
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-500">{d.common.status}</dt>
                <dd>
                  <Badge tone={PAYMENT_STATUS_TONE[order.payment!.status] ?? 'neutral'}>
                    {d.paymentStatus[order.payment!.status]}
                  </Badge>
                </dd>
              </div>
              <Row label={d.cart.total} value={formatMnt(order.payment!.amount, locale)} />
              {order.payment?.providerRef ? (
                <Row label="Ref" value={order.payment.providerRef} />
              ) : null}
              {order.payment?.paidAt ? (
                <Row label={d.common.date} value={formatDateTime(order.payment.paidAt, locale)} />
              ) : null}
            </dl>

            {can(session, 'payments.manage') && order.payment ? (
              <div className="mt-3 border-t border-ink-100 pt-3 no-print">
                <PaymentStatusControl
                  paymentId={order.payment.id}
                  status={order.payment.status}
                  method={order.payment.method}
                />
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink-900">{value}</dd>
    </div>
  )
}
