import type { Metadata } from 'next'

import { AddressManager } from '@/components/site/account-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
    title: d.account.addresses,
    description: d.account.addresses,
    pathWithoutLocale: '/account/addresses',
    noIndex: true,
  })
}

export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const session = (await getSession())!

  const addresses = await prisma.address.findMany({
    where: { userId: session.id, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-ink-900">{d.account.addresses}</h1>
      <AddressManager
        initial={addresses.map((address) => ({
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
      />
    </div>
  )
}
