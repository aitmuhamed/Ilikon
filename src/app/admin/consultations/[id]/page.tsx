import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Brain, Clock, FileText, Pill, ShieldCheck, User } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/shell'
import { PharmacistReviewForm } from '@/components/admin/consultation-client'
import { Alert, Badge, Card } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'
import { buildHandoffPacket, loadById } from '@/lib/consultation'
import { formatDateTime, formatMnt } from '@/lib/utils'
import { redFlagLabel, symptomLabel, type TriageLevelKey } from '@/lib/consultation/types'

const TRIAGE_TONE: Record<TriageLevelKey, 'danger' | 'warning' | 'brand' | 'success'> = {
  EMERGENCY: 'danger',
  URGENT_MEDICAL_REVIEW: 'warning',
  PHARMACIST_CONSULTATION: 'brand',
  SELF_CARE: 'success',
}

const OUTCOME_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PASS: 'success',
  WARN: 'warning',
  BLOCK: 'danger',
  UNKNOWN: 'neutral',
}

/**
 * The complete consultation record (§22, §29).
 *
 * Everything an auditor needs on one page: what was asked, what was answered,
 * which red flags fired, which products were considered versus recommended,
 * every safety verdict with its reason code, the AI's own audit trail with the
 * model and prompt version, and the pharmacist's actions.
 *
 * Opening this page is itself audit-logged, because it means reading a
 * customer's health answers.
 */
export default async function AdminConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = (await getSession())!
  if (!can(session, 'consultations.view')) notFound()

  const { id } = await params
  const consultation = await loadById(id)
  if (!consultation) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const settings = await getSettings()

  await audit({
    actor: session,
    action: 'consultation.view',
    entity: 'Consultation',
    entityId: consultation.id,
    summary: `Opened consultation ${consultation.code} in the admin`,
  })

  const [packet, auditEntries] = await Promise.all([
    buildHandoffPacket(consultation),
    prisma.consultationAuditEntry.findMany({
      where: { consultationId: consultation.id },
      orderBy: { createdAt: 'asc' },
      take: 80,
    }),
  ])

  const shown = consultation.recommendations.filter(
    (row) => row.status !== 'BLOCKED' && row.rank <= Math.max(1, settings.consultationMaxProducts),
  )

  return (
    <>
      <Link
        href="/admin/consultations"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> {d.admin.consultations}
      </Link>

      <AdminPageHeader
        title={`${consultation.code} — ${symptomLabel(consultation.primarySymptom, locale) || d.admin.consultationDetail}`}
        subtitle={`${formatDateTime(consultation.createdAt, locale)} · ${consultation.locale.toUpperCase()}`}
      />

      {consultation.purgedAt && (
        <Alert tone="info" className="mb-4" title={d.admin.purgedNotice}>
          {formatDateTime(consultation.purgedAt, locale)}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── left column: the clinical picture ───────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          {/* AI outcome */}
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {consultation.triageLevel && (
                <Badge tone={TRIAGE_TONE[consultation.triageLevel as TriageLevelKey]}>
                  {d.consultation.triage[consultation.triageLevel as TriageLevelKey]}
                </Badge>
              )}
              <Badge tone="neutral">{consultation.status}</Badge>
              {consultation.recommendationType && (
                <Badge tone="outline">{consultation.recommendationType}</Badge>
              )}
              {consultation.llmUsed ? (
                <Badge tone="brand" icon={<Brain className="h-3 w-3" />}>
                  {consultation.aiModel}
                </Badge>
              ) : (
                <Badge tone="neutral">{d.admin.aiDeterministic}</Badge>
              )}
            </div>

            {consultation.triageReason && (
              <p className="mb-3 rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
                {consultation.triageReason}
              </p>
            )}

            <dl className="space-y-3 text-sm">
              {[
                { label: d.consultation.result.understood, value: consultation.aiUnderstood },
                { label: d.consultation.result.safety, value: consultation.aiSafetyAssessment },
                { label: d.consultation.result.nextStep, value: consultation.aiNextStep },
                { label: d.consultation.result.precautions, value: consultation.aiPrecautions },
                { label: d.consultation.result.seekCare, value: consultation.aiSeekCare },
              ]
                .filter((row) => row.value)
                .map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {row.label}
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-ink-800">{row.value}</dd>
                  </div>
                ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
              <span>
                {d.admin.promptVersionLabel}: {consultation.promptVersion ?? '—'}
              </span>
              <span>
                {d.admin.rulesVersionLabel}: {consultation.rulesVersion ?? '—'}
              </span>
            </div>
          </Card>

          {/* red flags */}
          {consultation.redFlags.length > 0 && (
            <Card className="border-rose-200 bg-rose-50/50">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-900">
                <AlertTriangle className="h-4 w-4" />
                {d.admin.redFlagsLabel}
              </h2>
              <ul className="space-y-1.5 text-sm">
                {consultation.redFlags.map((flag) => (
                  <li key={flag.id} className="flex flex-wrap items-center gap-2">
                    <Badge tone={flag.severity === 'EMERGENCY' ? 'danger' : 'warning'}>
                      {flag.severity}
                    </Badge>
                    <span className="text-rose-900">
                      {flag.label || redFlagLabel(flag.code, locale)}
                    </span>
                    <span className="text-xs text-rose-700/70">
                      {flag.source}
                      {flag.evidence ? ` · “${flag.evidence}”` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* recommendations */}
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Pill className="h-4 w-4 text-brand-600" />
              {d.admin.productsConsidered}
              <span className="text-xs font-normal text-ink-400">
                ({shown.length} {d.admin.productsRecommended.toLowerCase()} /{' '}
                {consultation.recommendations.length})
              </span>
            </h2>

            {consultation.recommendations.length === 0 ? (
              <p className="text-sm text-ink-500">{d.consultation.result.noProducts}</p>
            ) : (
              <ul className="space-y-2">
                {consultation.recommendations.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-ink-200 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink-900">{row.productName}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          tone={
                            row.status === 'SAFE_TO_SHOW'
                              ? 'success'
                              : row.status === 'BLOCKED'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {row.status}
                        </Badge>
                        <Badge tone="outline">{row.interactionStatus}</Badge>
                        {row.addedByPharmacist && (
                          <Badge tone="brand">{d.admin.pharmacistColumn}</Badge>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {[row.activeIngredients, row.strength, row.packageSize]
                        .filter(Boolean)
                        .join(' · ')}
                      {row.price !== null && ` · ${formatMnt(row.price, locale)}`}
                      {` · rank ${row.rank} · safety ${row.safetyScore} · relevance ${row.relevanceScore}`}
                    </p>
                    {row.reason && <p className="mt-1.5 text-xs text-ink-600">{row.reason}</p>}
                    {row.safetyNotes && (
                      <p className="mt-1 text-xs text-amber-800">{row.safetyNotes}</p>
                    )}
                    {row.blockedReason && (
                      <p className="mt-1 text-xs text-rose-700">{row.blockedReason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* safety checks */}
          {consultation.safetyChecks.length > 0 && (
            <Card>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                {d.admin.safetyChecksLabel}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-ink-500">
                      <th className="py-1.5 pr-3 font-semibold">{d.admin.products}</th>
                      <th className="py-1.5 pr-3 font-semibold">{d.common.status}</th>
                      <th className="py-1.5 pr-3 font-semibold">Code</th>
                      <th className="py-1.5 font-semibold">{d.common.details}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultation.safetyChecks.map((check) => (
                      <tr key={check.id} className="border-b border-ink-50 last:border-0">
                        <td className="py-1.5 pr-3 text-ink-700">{check.productName ?? '—'}</td>
                        <td className="py-1.5 pr-3">
                          <Badge tone={OUTCOME_TONE[check.outcome] ?? 'neutral'}>
                            {check.type} / {check.outcome}
                          </Badge>
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-[11px] text-ink-500">
                          {check.code}
                        </td>
                        <td className="py-1.5 text-ink-600">{check.detail ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* questions and answers */}
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <FileText className="h-4 w-4 text-brand-600" />
              {d.admin.questionsAnswered}
              <span className="text-xs font-normal text-ink-400">
                ({consultation.answers.length})
              </span>
            </h2>
            {consultation.answers.length === 0 ? (
              <p className="text-sm text-ink-500">{d.admin.purgedNotice}</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {consultation.answers.map((answer) => (
                  <li key={answer.id} className="border-b border-ink-50 pb-2 last:border-0">
                    <p className="text-ink-600">
                      {answer.questionText}
                      {answer.isRedFlagProbe && (
                        <Badge tone="warning" className="ml-2">
                          {d.admin.redFlagsLabel}
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 font-semibold text-ink-900">{answer.answerLabel ?? '—'}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* AI audit trail */}
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Clock className="h-4 w-4 text-brand-600" />
              {d.admin.auditTrail}
            </h2>
            <ol className="space-y-2 text-xs">
              {auditEntries.map((entry) => (
                <li key={entry.id} className="flex gap-3 border-b border-ink-50 pb-2 last:border-0">
                  <span className="w-32 shrink-0 font-mono text-[11px] text-ink-400">
                    {entry.stage}
                  </span>
                  <span className="min-w-0 flex-1 text-ink-700">
                    {entry.summary}
                    {entry.actorLabel && (
                      <span className="ml-1 text-ink-400">— {entry.actorLabel}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-ink-400">
                    {entry.latencyMs !== null ? `${entry.latencyMs}ms` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* ── right column: patient, handoff, review ──────────────────── */}
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <User className="h-4 w-4 text-brand-600" />
              {d.admin.handoffPacket}
            </h2>
            <dl className="space-y-2 text-sm">
              <Row label={d.common.name} value={packet.customer.name ?? '—'} />
              {can(session, 'customers.viewContact') && (
                <Row label={d.common.phone} value={packet.customer.phone ?? '—'} />
              )}
              <Row label={d.consultation.steps.BASICS} value={packet.patient.ageBand ?? '—'} />
              <Row label="Sex" value={packet.patient.sex ?? '—'} />
              <Row label="Pregnancy" value={packet.patient.pregnancy ?? '—'} />
              <Row
                label={d.admin.symptomColumn}
                value={`${packet.complaint.primarySymptomLabel}${
                  packet.complaint.secondarySymptoms.length
                    ? ` (+${packet.complaint.secondarySymptoms.join(', ')})`
                    : ''
                }`}
              />
              <Row
                label={d.consultation.steps.SYMPTOM_DETAILS}
                value={[
                  packet.complaint.onset,
                  packet.complaint.durationCourse,
                  packet.complaint.severity !== null ? `${packet.complaint.severity}/10` : null,
                  packet.complaint.worsening ? '↑' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <Row
                label={d.consultation.steps.MEDICAL_HISTORY}
                value={packet.medicalHistory.map((row) => row.code).join(', ') || '—'}
              />
              <Row
                label={d.consultation.steps.ALLERGIES}
                value={
                  packet.allergies
                    .map(
                      (row) =>
                        `${row.medication}${row.reaction ? ` (${row.reaction})` : ''}${
                          row.resolved ? '' : ' ⚠'
                        }`,
                    )
                    .join('; ') || '—'
                }
              />
              <Row
                label={d.consultation.steps.MEDICATIONS}
                value={
                  packet.currentMedications
                    .map(
                      (row) =>
                        `${row.name}${row.dose ? ` ${row.dose}` : ''}${row.resolved ? '' : ' ⚠'}`,
                    )
                    .join('; ') || '—'
                }
              />
            </dl>

            {packet.complaint.freeText && (
              <p className="mt-3 rounded-lg bg-ink-50 p-2.5 text-xs italic text-ink-700">
                “{packet.complaint.freeText}”
              </p>
            )}

            {/* Package photos the customer uploaded when they did not know the
                name. Served only by the authorised, audit-logged route. */}
            {consultation.medications.some((row) => row.photoKey) && (
              <div className="mt-3 border-t border-ink-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {d.consultation.meds.photo}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {consultation.medications
                    .filter((row) => row.photoKey)
                    .map((row) => (
                      <li key={row.id}>
                        <a
                          href={`/api/consultations/${consultation.id}/medication-photo/${row.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border border-ink-200 transition hover:border-brand-400"
                          title={row.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/consultations/${consultation.id}/medication-photo/${row.id}`}
                            alt={row.name}
                            className="h-20 w-20 object-cover"
                          />
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Card>

          {consultation.reviews.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink-900">
                {d.admin.pharmacistColumn}
              </h2>
              <ol className="space-y-3 text-sm">
                {consultation.reviews.map((review) => (
                  <li key={review.id} className="border-b border-ink-50 pb-3 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{review.action}</Badge>
                      <span className="text-xs text-ink-500">
                        {review.pharmacist.fullName} · {formatDateTime(review.createdAt, locale)}
                      </span>
                    </div>
                    {review.pharmacistRecommendation && (
                      <p className="mt-1.5 text-ink-800">{review.pharmacistRecommendation}</p>
                    )}
                    {review.reasonForChange && (
                      <p className="mt-1 text-xs text-ink-600">
                        <strong>{d.admin.reasonForChange}:</strong> {review.reasonForChange}
                      </p>
                    )}
                    {review.note && <p className="mt-1 text-xs text-ink-500">{review.note}</p>}
                    {review.triageOverride && (
                      <p className="mt-1 text-xs text-ink-600">
                        {d.admin.triageOverride}: {review.triageOverride}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <PharmacistReviewForm
            consultationId={consultation.id}
            canReview={can(session, 'consultations.review')}
            currentTriage={(consultation.triageLevel as TriageLevelKey | null) ?? null}
            recommendations={consultation.recommendations.map((row) => ({
              id: row.id,
              name: row.productName,
              status: row.status,
              addedByPharmacist: row.addedByPharmacist,
            }))}
          />
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-xs text-ink-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink-800">{value}</dd>
    </div>
  )
}
