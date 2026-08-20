import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { ConsultationResultPanel } from '@/components/site/consultation-client'
import { Alert, Card } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSession } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { loadById, loadStoredResult } from '@/lib/consultation'
import { formatDateTime } from '@/lib/utils'

/**
 * One past consultation. Ownership is checked against the session directly —
 * the anonymous continuation cookie is not accepted here, because this page
 * lives behind the account shell.
 */
export default async function AccountConsultationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const resolved = await params
  const locale = coerceLocale(resolved.locale)
  const d = getDictionary(locale)
  const session = (await getSession())!

  const consultation = await loadById(resolved.id)
  if (!consultation || consultation.userId !== session.id) notFound()

  const settings = await getSettings()
  const result = await loadStoredResult({ consultation, settings })

  return (
    <div>
      <Link
        href={`/${locale}/account/consultations`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> {d.consultation.history.title}
      </Link>

      <p className="mb-3 text-xs text-ink-500">
        {d.consultation.result.code}: <strong className="text-ink-700">{consultation.code}</strong> ·{' '}
        {formatDateTime(consultation.createdAt, locale)}
      </p>

      {consultation.purgedAt ? (
        <Card>
          <Alert tone="info" title={d.consultation.history.purged}>
            {d.admin.purgedNotice}
          </Alert>
        </Card>
      ) : result ? (
        <ConsultationResultPanel
          result={result}
          emergencyNumber={settings.emergencyNumber}
          pharmacyPhone={settings.phone}
          newConsultationHref={`/${locale}/consultation`}
        />
      ) : (
        <Card>
          <Alert tone="warning">{d.consultation.errors.generic}</Alert>
        </Card>
      )}
    </div>
  )
}
