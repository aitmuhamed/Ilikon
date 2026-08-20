import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Upload } from 'lucide-react'

import { Alert, Badge, Card, EmptyState, PRESCRIPTION_STATUS_TONE } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildMetadata } from '@/lib/seo'
import { formatDate, formatDateTime } from '@/lib/utils'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.prescription.myPrescriptions,
    description: d.prescription.uploadSubtitle,
    pathWithoutLocale: '/account/prescriptions',
    noIndex: true,
  })
}

export default async function MyPrescriptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const session = (await getSession())!

  const prescriptions = await prisma.prescription.findMany({
    where: { userId: session.id },
    include: {
      order: { select: { id: true, orderNumber: true, status: true } },
      reviews: {
        include: { reviewer: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">{d.prescription.myPrescriptions}</h1>
        <Link href={`/${locale}/prescriptions/upload`}>
          <Button size="sm">
            <Upload className="h-3.5 w-3.5" aria-hidden />
            {d.prescription.uploadTitle}
          </Button>
        </Link>
      </div>

      <Alert tone="info">{d.prescription.privacyNotice}</Alert>

      {prescriptions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={d.prescription.noPrescriptions}
            body={d.prescription.uploadSubtitle}
            action={
              <Link href={`/${locale}/prescriptions/upload`}>
                <Button size="sm">{d.prescription.uploadTitle}</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {prescriptions.map((prescription) => (
            <li key={prescription.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink-900 tabular">{prescription.code}</span>
                      <Badge tone={PRESCRIPTION_STATUS_TONE[prescription.status] ?? 'neutral'}>
                        {
                          d.prescription[
                            `status${prescription.status}` as keyof typeof d.prescription
                          ] as string
                        }
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {prescription.fileName} · {formatDateTime(prescription.createdAt, locale)}
                    </p>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                      {prescription.doctorName ? (
                        <div className="flex gap-1.5">
                          <dt className="text-ink-400">{d.prescription.doctorName}:</dt>
                          <dd className="text-ink-700">{prescription.doctorName}</dd>
                        </div>
                      ) : null}
                      {prescription.clinic ? (
                        <div className="flex gap-1.5">
                          <dt className="text-ink-400">{d.prescription.clinic}:</dt>
                          <dd className="text-ink-700">{prescription.clinic}</dd>
                        </div>
                      ) : null}
                      {prescription.issuedAt ? (
                        <div className="flex gap-1.5">
                          <dt className="text-ink-400">{d.prescription.issuedAt}:</dt>
                          <dd className="text-ink-700">{formatDate(prescription.issuedAt, locale)}</dd>
                        </div>
                      ) : null}
                      {prescription.expiresAt ? (
                        <div className="flex gap-1.5">
                          <dt className="text-ink-400">{d.prescription.expiresAt}:</dt>
                          <dd className="text-ink-700">{formatDate(prescription.expiresAt, locale)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {prescription.order ? (
                      <Link
                        href={`/${locale}/account/orders/${prescription.order.id}`}
                        className="text-xs font-semibold text-brand-700 hover:underline tabular"
                      >
                        {prescription.order.orderNumber} →
                      </Link>
                    ) : (
                      <span className="text-xs text-ink-400">{d.prescription.noOrder}</span>
                    )}
                    <a
                      href={`/api/prescriptions/${prescription.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline">
                        {d.admin.viewFile}
                      </Button>
                    </a>
                  </div>
                </div>

                {prescription.reviews.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                    <p className="text-xs font-semibold text-ink-700">{d.admin.reviewHistory}</p>
                    {prescription.reviews.map((review) => (
                      <div key={review.id} className="rounded-lg bg-ink-50 p-2.5 text-xs">
                        <p className="font-medium text-ink-800">
                          {
                            d.prescription[
                              `status${review.resultStatus}` as keyof typeof d.prescription
                            ] as string
                          }{' '}
                          · {review.reviewer.fullName} · {formatDateTime(review.createdAt, locale)}
                        </p>
                        {review.reason ? (
                          <p className="mt-1 text-ink-600">
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
                  <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-warning">
                    {d.prescription.awaitingVerification}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
