import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, FileText, Package, Phone, Truck } from 'lucide-react'

import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { buildMetadata } from '@/lib/seo'
import { formatMnt } from '@/lib/utils'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.checkout.successTitle,
    description: d.checkout.successBody,
    pathWithoutLocale: '/checkout/success',
    noIndex: true,
  })
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ order?: string; id?: string }>
}) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const { order: orderNumber, id } = await searchParams

  const session = await getSession()
  const settings = await getSettings()

  // Only the owning customer (or a guest with the exact order number) sees
  // details; everyone else gets the generic confirmation.
  const order =
    orderNumber || id
      ? await prisma.order.findFirst({
          where: {
            ...(id ? { id } : {}),
            ...(orderNumber ? { orderNumber } : {}),
            ...(session ? {} : {}),
          },
          include: {
            items: { select: { name: true, quantity: true, lineTotal: true, prescriptionRequired: true } },
            payment: { select: { method: true, status: true } },
            delivery: { select: { method: true, district: true, khoroo: true, addressLine: true } },
          },
        })
      : null

  const isOwner = order && (!order.userId || order.userId === session?.id)
  const visible = isOwner ? order : null

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <CheckCircle2 className="h-9 w-9" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-ink-900 sm:text-3xl">
            {d.checkout.successTitle}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{d.checkout.successBody}</p>

          {orderNumber ? (
            <div className="mt-5 inline-flex flex-col items-center rounded-xl border border-brand-200 bg-brand-50 px-6 py-3">
              <span className="text-xs font-medium uppercase tracking-wider text-brand-700">
                {d.checkout.orderNumber}
              </span>
              <span className="text-xl font-extrabold text-brand-900 tabular">{orderNumber}</span>
            </div>
          ) : null}
        </div>

        {visible ? (
          <>
            {visible.requiresPrescription ? (
              <Alert
                tone="warning"
                className="mt-7"
                title={d.checkout.prescriptionRequiredTitle}
                action={
                  <Link href={`/${locale}/prescriptions/upload?orderId=${visible.id}`}>
                    <Button variant="accent" size="sm">
                      <FileText className="h-4 w-4" aria-hidden />
                      {d.checkout.uploadPrescriptionNow}
                    </Button>
                  </Link>
                }
              >
                {d.checkout.prescriptionRequiredBody}
              </Alert>
            ) : null}

            <Card className="mt-6">
              <h2 className="mb-3 text-base font-semibold text-ink-900">{d.checkout.orderSummary}</h2>
              <ul className="space-y-2.5">
                {visible.items.map((item, index) => (
                  <li key={index} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-900">{item.name}</span>
                      <span className="text-xs text-ink-500 tabular">× {item.quantity}</span>
                      {item.prescriptionRequired ? (
                        <Badge tone="rx" className="ml-1.5">
                          {d.product.prescriptionRequiredShort}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-semibold text-ink-900 tabular">
                      {formatMnt(item.lineTotal, locale)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">{d.cart.subtotal}</dt>
                  <dd className="tabular">{formatMnt(visible.subtotal, locale)}</dd>
                </div>
                {visible.discountTotal > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">{d.cart.discount}</dt>
                    <dd className="font-semibold text-success tabular">
                      −{formatMnt(visible.discountTotal, locale)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">{d.cart.deliveryFee}</dt>
                  <dd className="tabular">
                    {visible.deliveryFee === 0 ? d.cart.freeDelivery : formatMnt(visible.deliveryFee, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-ink-100 pt-2">
                  <dt className="font-semibold text-ink-700">{d.cart.total}</dt>
                  <dd className="text-lg font-extrabold text-ink-900 tabular">
                    {formatMnt(visible.total, locale)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-2">
                <div className="flex gap-2.5">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-ink-900">{d.admin.deliveryInfo}</p>
                    <p className="text-ink-500">
                      {visible.delivery?.method === 'PHARMACY_PICKUP'
                        ? d.checkout.pickup
                        : [visible.delivery?.district, visible.delivery?.khoroo, visible.delivery?.addressLine]
                            .filter(Boolean)
                            .join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-ink-900">{d.admin.paymentInfo}</p>
                    <p className="text-ink-500">
                      {visible.payment
                        ? `${d.paymentMethod[visible.payment.method]} · ${d.paymentStatus[visible.payment.status]}`
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </>
        ) : null}

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {session ? (
            <Link href={visible ? `/${locale}/account/orders/${visible.id}` : `/${locale}/account/orders`}>
              <Button size="lg">{d.checkout.trackOrder}</Button>
            </Link>
          ) : (
            <Link href={`/${locale}/register`}>
              <Button size="lg">{d.nav.register}</Button>
            </Link>
          )}
          <Link href={`/${locale}/products`}>
            <Button variant="outline" size="lg">
              {d.cart.continueShopping}
            </Button>
          </Link>
        </div>

        <div className="mt-7 rounded-xl border border-ink-200 bg-white p-4 text-center">
          <p className="text-xs text-ink-500">{d.about.contactTitle}</p>
          <a
            href={`tel:${settings.phone.replace(/\s/g, '')}`}
            className="mt-1 inline-flex items-center gap-2 text-base font-bold text-brand-700 hover:underline"
          >
            <Phone className="h-4 w-4" aria-hidden />
            {settings.phone}
          </a>
          <p className="mt-1 text-xs text-ink-400">{settings.workingHoursWeekdays}</p>
        </div>
      </div>
    </div>
  )
}
