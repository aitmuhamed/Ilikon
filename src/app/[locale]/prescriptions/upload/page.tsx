import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { Breadcrumbs, Spinner } from '@/components/ui/primitives'
import { PrescriptionUploadForm } from '@/components/site/prescription-upload'
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
    title: d.prescription.uploadTitle,
    description: d.prescription.uploadSubtitle,
    pathWithoutLocale: '/prescriptions/upload',
    noIndex: true, // never index a page that handles health documents
  })
}

export default async function PrescriptionUploadPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)

  // Uploading requires an account: a prescription must be attributable to a
  // named patient record before a pharmacist can act on it.
  const session = await getSession()
  if (!session) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/prescriptions/upload`)}`,
    )
  }

  const orders = await prisma.order.findMany({
    where: {
      userId: session.id,
      status: { in: ['NEW', 'CONFIRMING', 'PREPARING'] },
    },
    select: { id: true, orderNumber: true, requiresPrescription: true },
    orderBy: [{ requiresPrescription: 'desc' }, { createdAt: 'desc' }],
    take: 20,
  })

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: d.common.home, href: `/${locale}` },
          { label: d.prescription.title },
          { label: d.prescription.uploadTitle },
        ]}
      />

      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-bold text-ink-900">{d.prescription.uploadTitle}</h1>
        <p className="mb-6 text-sm text-ink-500">{d.prescription.uploadSubtitle}</p>

        <Suspense fallback={<div className="flex justify-center py-16"><Spinner /></div>}>
          <PrescriptionUploadForm orders={orders} />
        </Suspense>
      </div>
    </div>
  )
}
