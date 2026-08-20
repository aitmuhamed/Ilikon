import Link from 'next/link'
import { Stethoscope } from 'lucide-react'

import { Badge, Card, EmptyState } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/utils'
import { symptomLabel, type TriageLevelKey } from '@/lib/consultation/types'

/** Badge tone per triage level. `BadgeTone` is internal to the design system,
 * so the literal union is spelled out here. */
const TRIAGE_TONE: Record<TriageLevelKey, 'danger' | 'warning' | 'brand' | 'success'> = {
  EMERGENCY: 'danger',
  URGENT_MEDICAL_REVIEW: 'warning',
  PHARMACIST_CONSULTATION: 'brand',
  SELF_CARE: 'success',
}

/** The customer's own consultation history (§2). */
export default async function AccountConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const session = (await getSession())!

  const consultations = await prisma.consultation.findMany({
    where: { userId: session.id, status: { not: 'DRAFT' } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      id: true,
      code: true,
      locale: true,
      status: true,
      triageLevel: true,
      primarySymptom: true,
      createdAt: true,
      purgedAt: true,
      handedOffAt: true,
      _count: { select: { recommendations: true, reviews: true } },
    },
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink-900">{d.consultation.history.title}</h1>
        <Link
          href={`/${locale}/consultation`}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          <Stethoscope className="h-4 w-4" /> {d.consultation.history.startNew}
        </Link>
      </div>

      {consultations.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-6 w-6" />}
          title={d.consultation.history.empty}
          body={d.consultation.subtitle}
        />
      ) : (
        <ul className="space-y-3">
          {consultations.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink-900">
                      {symptomLabel(row.primarySymptom, locale) || row.code}
                    </span>
                    {row.triageLevel && (
                      <Badge tone={TRIAGE_TONE[row.triageLevel as TriageLevelKey]}>
                        {d.consultation.triage[row.triageLevel as TriageLevelKey]}
                      </Badge>
                    )}
                    {row.handedOffAt && (
                      <Badge tone="accent">{d.consultation.result.askPharmacist}</Badge>
                    )}
                    {row._count.reviews > 0 && (
                      <Badge tone="success">{d.admin.pharmacistColumn}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {row.code} · {formatDateTime(row.createdAt, locale)}
                  </p>
                  {row.purgedAt && (
                    <p className="mt-1 text-xs text-ink-400">{d.consultation.history.purged}</p>
                  )}
                </div>

                <Link
                  href={`/${locale}/account/consultations/${row.id}`}
                  className="shrink-0 rounded-lg border border-ink-200 px-3.5 py-2 text-xs font-semibold text-ink-700 transition hover:border-brand-400 hover:text-brand-700"
                >
                  {d.consultation.history.view}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
