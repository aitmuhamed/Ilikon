import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Breadcrumbs } from '@/components/ui/primitives'
import { CheckoutClient } from '@/components/site/checkout-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getCartSummary } from '@/lib/cart'
import { getSession } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { availablePaymentMethods } from '@/lib/payments'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.checkout.title,
    description: d.checkout.orderSummary,
    pathWithoutLocale: '/checkout',
    noIndex: true,
  })
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)

  const session = await getSession()
  const cart = await getCartSummary(session?.id ?? null, locale)

  // Nothing to check out — send them back rather than showing an empty form.
  if (cart.lines.length === 0 || cart.unitCount === 0) {
    redirect(`/${locale}/cart`)
  }

  const settings = await getSettings()
  const secrets = env()

  const [user, addresses] = await Promise.all([
    session
      ? prisma.user.findUnique({
          where: { id: session.id },
          select: { fullName: true, phone: true, email: true },
        })
      : Promise.resolve(null),
    session
      ? prisma.address.findMany({
          where: { userId: session.id, deletedAt: null },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: d.common.home, href: `/${locale}` },
          { label: d.cart.title, href: `/${locale}/cart` },
          { label: d.checkout.title },
        ]}
      />

      <h1 className="mb-6 text-2xl font-bold text-ink-900">{d.checkout.title}</h1>

      <CheckoutClient
        cart={cart}
        user={user}
        addresses={addresses.map((address) => ({
          id: address.id,
          label: address.label,
          recipient: address.recipient,
          phone: address.phone,
          district: address.district,
          khoroo: address.khoroo,
          addressLine: address.addressLine,
          instructions: address.instructions,
          isDefault: address.isDefault,
        }))}
        paymentMethods={availablePaymentMethods(settings)}
        bankDetails={{
          bank: secrets.BANK_TRANSFER_BANK,
          account: secrets.BANK_TRANSFER_ACCOUNT,
          holder: secrets.BANK_TRANSFER_HOLDER,
        }}
        deliveryFee={settings.deliveryFee}
        freeDeliveryThreshold={settings.freeDeliveryThreshold}
      />
    </div>
  )
}
