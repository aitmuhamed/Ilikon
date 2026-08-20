import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Package,
  Phone,
  Store,
  Truck,
} from 'lucide-react'

import {
  Alert,
  Badge,
  Breadcrumbs,
  Card,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  PRESCRIPTION_STATUS_TONE,
} from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { OrderActions } from '@/components/site/account-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { getOrderForCustomer } from '@/lib/orders'
import { getSettings } from '@/lib/settings'
import { mediaUrl } from '@/lib/storage'
import { ORDER_STATUS_SEQUENCE } from '@/lib/constants'
import { buildMetadata } from '@/lib/seo'
import { formatDateTime, formatMnt } from '@/lib/utils'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = coerceLocale(rawLocale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.account.orderDetails,
    description: d.account.orderDetails,
    pathWithoutLocale: '/account/orders',
    noIndex: true,
  })
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale: rawLocale, id } = await params
  const locale = coerceLocale(rawLocale)
  const d = getDictionary(locale)
  const session = (await getSession())!

  const order = await getOrderForCustomer(id, session.id)
  if (!order) notFound()

  const settings = await getSettings()
  const canCancel = ['NEW', 'CONFIRMING'].includes(order.status)
  const isPickup = order.delivery?.method === 'PHARMACY_PICKUP'

  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(
    order.status as (typeof ORDER_STATUS_SEQUENCE)[number],
  )

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: d.account.title, href: `/${locale}/account` },
          { label: d.account.orders, href: `/${locale}/account/orders` },
          { label: order.orderNumber },
        ]}
      />

      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink-900 tabular">{order.orderNumber}</h1>
              <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
                {d.orderStatus[order.status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-ink-500">{formatDateTime(order.createdAt, locale)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">{d.cart.total}</p>
            <p className="text-2xl font-extrabold text-ink-900 tabular">
              {formatMnt(order.total, locale)}
            </p>
          </div>
        </div>

        {order.status !== 'CANCELLED' ? (
          <ol className="mt-6 flex items-start">
            {ORDER_STATUS_SEQUENCE.map((step, index) => {
              const done = index <= currentIndex
              return (
                <li
                  key={step}
                  className={index < ORDER_STATUS_SEQUENCE.length - 1 ? 'flex flex-1 items-start' : 'flex items-start'}
                >
                  <div className="flex w-16 flex-col items-center sm:w-20">
                    {done ? (
                      <CheckCircle2 className="h-6 w-6 text-brand-600" aria-hidden />
                    ) : (
                      <Circle className="h-6 w-6 text-ink-300" aria-hidden />
                    )}
                    <span
                      className={`mt-1.5 text-center text-[10px] leading-tight sm:text-[11px] ${
                        done ? 'font-semibold text-brand-700' : 'text-ink-400'
                      }`}
                    >
                      {d.orderStatus[step]}
                    </span>
                  </div>
                  {index < ORDER_STATUS_SEQUENCE.length - 1 ? (
                    <span
                      className={`mt-3 h-0.5 flex-1 rounded-full ${
                        index < currentIndex ? 'bg-brand-400' : 'bg-ink-200'
                      }`}
                      aria-hidden
                    />
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : (
          <Alert tone="danger" className="mt-5" title={d.orderStatus.CANCELLED}>
            {order.cancelReason ?? '—'}
          </Alert>
        )}

        <div className="mt-5 border-t border-ink-100 pt-4">
          <OrderActions orderId={order.id} status={order.status} canCancel={canCancel} />
        </div>
      </Card>

      {/* Prescription */}
      {order.requiresPrescription ? (
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-900">
            <FileText className="h-4 w-4 text-accent-600" aria-hidden />
            {d.prescription.requiredForOrder}
          </h2>

          {order.prescriptions.length === 0 ? (
            <Alert
              tone="warning"
              action={
                <Link href={`/${locale}/prescriptions/upload?orderId=${order.id}`}>
                  <Button size="sm" variant="accent">
                    {d.prescription.uploadTitle}
                  </Button>
                </Link>
              }
            >
              {d.checkout.prescriptionRequiredBody}
            </Alert>
          ) : (
            <ul className="space-y-3">
              {order.prescriptions.map((prescription) => (
                <li key={prescription.id} className="rounded-xl border border-ink-200 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink-900 tabular">{prescription.code}</span>
                    <Badge tone={PRESCRIPTION_STATUS_TONE[prescription.status] ?? 'neutral'}>
                      {d.prescription[`status${prescription.status}` as keyof typeof d.prescription] as string}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {prescription.fileName} · {formatDateTime(prescription.createdAt, locale)}
                  </p>

                  {prescription.reviews.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                      {prescription.reviews.map((review) => (
                        <div key={review.id} className="text-xs">
                          <p className="font-medium text-ink-700">
                            {d.prescription.reviewedBy}: {review.reviewer.fullName} ·{' '}
                            {formatDateTime(review.createdAt, locale)}
                          </p>
                          {review.reason ? (
                            <p className="mt-0.5 text-ink-600">
                              {d.prescription.reason}: {review.reason}
                            </p>
                          ) : null}
                          {review.pharmacistNote ? (
                            <p className="mt-0.5 text-ink-600">
                              {d.prescription.pharmacistNote}: {review.pharmacistNote}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-warning">{d.prescription.awaitingVerification}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/api/prescriptions/${prescription.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline">
                        {d.admin.viewFile}
                      </Button>
                    </a>
                    {prescription.status === 'CLARIFICATION_REQUESTED' ||
                    prescription.status === 'REJECTED' ? (
                      <Link href={`/${locale}/prescriptions/upload?orderId=${order.id}`}>
                        <Button size="sm" variant="accent">
                          {d.prescription.uploadTitle}
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-ink-400">{d.prescription.safetyNotice}</p>
        </Card>
      ) : null}

      {/* Items */}
      <Card>
        <h2 className="mb-3 text-base font-semibold text-ink-900">{d.admin.orderItems}</h2>
        <ul className="divide-y divide-ink-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50">
                {mediaUrl(item.imageKey) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(item.imageKey)!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-ink-300" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                {item.product?.slug ? (
                  <Link
                    href={`/${locale}/products/${item.product.slug}`}
                    className="line-clamp-2 text-sm font-medium text-ink-900 hover:text-brand-700"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <span className="line-clamp-2 text-sm font-medium text-ink-900">{item.name}</span>
                )}
                <p className="mt-0.5 text-xs text-ink-500 tabular">
                  {item.sku} · {formatMnt(item.unitPrice, locale)} × {item.quantity}
                </p>
                {item.prescriptionRequired ? (
                  <Badge tone="rx" className="mt-1">
                    {d.product.prescriptionRequiredShort}
                  </Badge>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-bold text-ink-900 tabular">
                {formatMnt(item.lineTotal, locale)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
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
            <dd className="tabular">
              {order.deliveryFee === 0 ? d.cart.freeDelivery : formatMnt(order.deliveryFee, locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-ink-100 pt-2">
            <dt className="font-semibold text-ink-700">{d.cart.total}</dt>
            <dd className="text-lg font-extrabold text-ink-900 tabular">
              {formatMnt(order.total, locale)}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Delivery & payment */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-900">
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
            {isPickup ? (
              <>
                <Row label={d.common.address} value={settings.addressMn} />
                <Row label={d.footer.workingHours} value={settings.workingHoursWeekdays} />
              </>
            ) : (
              <>
                <Row label={d.account.recipient} value={order.delivery?.recipient ?? '—'} />
                <Row label={d.common.phone} value={order.delivery?.phone ?? '—'} />
                <Row
                  label={d.common.address}
                  value={[order.delivery?.district, order.delivery?.khoroo, order.delivery?.addressLine]
                    .filter(Boolean)
                    .join(', ')}
                />
                {order.delivery?.instructions ? (
                  <Row label={d.checkout.instructions} value={order.delivery.instructions} />
                ) : null}
              </>
            )}
            {order.delivery?.courier ? (
              <Row label={d.admin.courier} value={order.delivery.courier.fullName} />
            ) : null}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-900">
            <Building2 className="h-4 w-4 text-brand-600" aria-hidden />
            {d.admin.paymentInfo}
          </h2>
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
            {order.payment?.paidAt ? (
              <Row label={d.common.date} value={formatDateTime(order.payment.paidAt, locale)} />
            ) : null}
          </dl>

          {order.payment?.method === 'BANK_TRANSFER' && order.payment.status !== 'PAID' ? (
            <Alert tone="info" className="mt-3">
              {d.checkout.bankReference}: <strong className="tabular">{order.orderNumber}</strong>
            </Alert>
          ) : null}
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink-900">
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
              {event.message ? (
                <p className="mt-0.5 text-xs text-ink-600">{event.message}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-ink-400">
                {formatDateTime(event.createdAt, locale)}
                {event.actor ? ` · ${event.actor.fullName}` : ''}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">{d.about.contactTitle}</p>
        <a href={`tel:${settings.phone.replace(/\s/g, '')}`}>
          <Button variant="outline" size="sm">
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {settings.phone}
          </Button>
        </a>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value}</dd>
    </div>
  )
}
