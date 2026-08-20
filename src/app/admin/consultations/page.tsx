import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  Phone,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'

import { AdminPageHeader, StatCard } from '@/components/admin/shell'
import { ConsultationConfigCard } from '@/components/admin/consultation-client'
import { Alert, Badge, Card, EmptyState } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { isLlmConfigured } from '@/lib/consultation'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { symptomLabel, type TriageLevelKey } from '@/lib/consultation/types'

const TRIAGE_TONE: Record<TriageLevelKey, 'danger' | 'warning' | 'brand' | 'success'> = {
  EMERGENCY: 'danger',
  URGENT_MEDICAL_REVIEW: 'warning',
  PHARMACIST_CONSULTATION: 'brand',
  SELF_CARE: 'success',
}

const STATUS_TONE: Record<string, 'neutral' | 'brand' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  IN_PROGRESS: 'brand',
  ASSESSED: 'success',
  PHARMACIST_REVIEW: 'warning',
  REVIEWED: 'success',
  ABANDONED: 'neutral',
}

/** Admin dashboard for AI consultations (§22). */
export default async function AdminConsultationsPage() {
  const session = (await getSession())!
  if (!can(session, 'consultations.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const settings = await getSettings()

  const [
    consultations,
    total,
    completed,
    emergency,
    pharmacistReferrals,
    otcGuidance,
    durations,
    symptomGroups,
    categoryGroups,
    knowledge,
  ] = await Promise.all([
    prisma.consultation.findMany({
      where: { status: { not: 'DRAFT' } },
      include: {
        user: { select: { id: true, fullName: true } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { pharmacist: { select: { fullName: true } } },
        },
        _count: { select: { redFlags: true, recommendations: true } },
      },
      orderBy: [{ handedOffAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    }),
    prisma.consultation.count({ where: { status: { not: 'DRAFT' } } }),
    prisma.consultation.count({ where: { assessedAt: { not: null } } }),
    prisma.consultation.count({ where: { triageLevel: 'EMERGENCY' } }),
    prisma.consultation.count({
      where: { OR: [{ triageLevel: 'PHARMACIST_CONSULTATION' }, { handedOffAt: { not: null } }] },
    }),
    prisma.consultation.count({ where: { recommendationType: 'OTC_GUIDANCE' } }),
    prisma.consultation.findMany({
      where: { assessedAt: { not: null } },
      select: { startedAt: true, assessedAt: true },
      take: 300,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.consultation.groupBy({
      by: ['primarySymptom'],
      where: { primarySymptom: { not: null } },
      _count: { primarySymptom: true },
      orderBy: { _count: { primarySymptom: 'desc' } },
      take: 6,
    }),
    prisma.consultationRecommendation.groupBy({
      by: ['categoryName'],
      where: { categoryName: { not: null }, status: { not: 'BLOCKED' } },
      _count: { categoryName: true },
      orderBy: { _count: { categoryName: 'desc' } },
      take: 6,
    }),
    Promise.all([
      prisma.otcGuideline.count({ where: { isActive: true } }),
      prisma.contraindicationRule.count({ where: { isActive: true } }),
      prisma.interactionRule.count({ where: { isActive: true } }),
      prisma.knowledgeSource.count({ where: { isActive: true } }),
    ]),
  ])

  const avgMinutes = (() => {
    const spans = durations
      .filter((row) => row.assessedAt)
      .map((row) => (row.assessedAt!.getTime() - row.startedAt.getTime()) / 60_000)
      .filter((minutes) => minutes >= 0 && minutes < 120)
    if (spans.length === 0) return 0
    return Math.round((spans.reduce((sum, value) => sum + value, 0) / spans.length) * 10) / 10
  })()

  const [guidelineCount, contraCount, interactionCount, sourceCount] = knowledge

  return (
    <>
      <AdminPageHeader title={d.admin.consultations} subtitle={d.admin.consultationsSubtitle} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={d.admin.totalConsultations}
          value={formatNumber(total, locale)}
          tone="brand"
          icon={<Stethoscope className="h-4 w-4" />}
        />
        <StatCard
          label={d.admin.completedConsultations}
          value={formatNumber(completed, locale)}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label={d.admin.emergencyReferrals}
          value={formatNumber(emergency, locale)}
          tone={emergency > 0 ? 'danger' : 'default'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label={d.admin.pharmacistReferrals}
          value={formatNumber(pharmacistReferrals, locale)}
          tone={pharmacistReferrals > 0 ? 'warning' : 'default'}
          icon={<Phone className="h-4 w-4" />}
        />
        <StatCard
          label={d.admin.otcGuidance}
          value={formatNumber(otcGuidance, locale)}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label={d.admin.avgConsultationMinutes}
          value={formatNumber(avgMinutes, locale)}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.commonSymptoms}</h2>
          {symptomGroups.length === 0 ? (
            <p className="text-sm text-ink-500">{d.admin.noConsultations}</p>
          ) : (
            <ul className="space-y-2">
              {symptomGroups.map((group) => (
                <li key={group.primarySymptom} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{symptomLabel(group.primarySymptom, locale)}</span>
                  <span className="font-semibold tabular text-ink-900">
                    {group._count.primarySymptom}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.commonCategories}</h2>
          {categoryGroups.length === 0 ? (
            <p className="text-sm text-ink-500">{d.admin.noConsultations}</p>
          ) : (
            <ul className="space-y-2">
              {categoryGroups.map((group) => (
                <li key={group.categoryName} className="flex items-center justify-between text-sm">
                  <span className="truncate text-ink-700">{group.categoryName}</span>
                  <span className="font-semibold tabular text-ink-900">
                    {group._count.categoryName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
            <BookOpen className="h-4 w-4 text-brand-600" />
            {d.admin.knowledgeBase}
          </h2>
          <dl className="space-y-2 text-sm">
            {[
              { label: d.admin.guidelines, value: guidelineCount },
              { label: d.admin.contraindicationRules, value: contraCount },
              { label: d.admin.interactionRules, value: interactionCount },
              { label: d.admin.knowledgeSources, value: sourceCount },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <dt className="text-ink-600">{row.label}</dt>
                <dd className="font-semibold tabular text-ink-900">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
            <Brain className="h-3.5 w-3.5" />
            {isLlmConfigured() ? settings.consultationLlmEnabled
              ? `${d.admin.llmModel}: ${process.env.CONSULTATION_MODEL || 'claude-opus-5'}`
              : d.admin.aiDeterministic
              : d.admin.aiDeterministic}
          </p>
        </Card>
      </div>

      <ConsultationConfigCard
        settings={{
          consultationEnabled: settings.consultationEnabled,
          consultationLlmEnabled: settings.consultationLlmEnabled,
          consultationMaxProducts: settings.consultationMaxProducts,
          consultationMinExpiryDays: settings.consultationMinExpiryDays,
          consultationRetentionDays: settings.consultationRetentionDays,
          consultationEscalationLevel: settings.consultationEscalationLevel,
          consultationLocales: settings.consultationLocales,
          consultationSystemPromptExtra: settings.consultationSystemPromptExtra,
          consultationDisclaimerMn: settings.consultationDisclaimerMn,
          consultationDisclaimerEn: settings.consultationDisclaimerEn,
          consultationDisclaimerRu: settings.consultationDisclaimerRu,
          emergencyNumber: settings.emergencyNumber,
          emergencyNote: settings.emergencyNote,
        }}
        canConfigure={can(session, 'consultations.configure')}
        canEditSafety={can(session, 'consultations.safety')}
      />

      <Card className="mt-5 p-0" padded={false}>
        <div className="border-b border-ink-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-900">{d.admin.consultations}</h2>
        </div>

        {consultations.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Stethoscope className="h-6 w-6" />}
              title={d.admin.noConsultations}
              body={d.admin.consultationsSubtitle}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">{d.admin.customers}</th>
                  <th className="px-4 py-2.5 font-semibold">{d.admin.symptomColumn}</th>
                  <th className="px-4 py-2.5 font-semibold">{d.admin.riskLevel}</th>
                  <th className="px-4 py-2.5 font-semibold">{d.admin.aiResult}</th>
                  <th className="px-4 py-2.5 font-semibold">{d.admin.pharmacistColumn}</th>
                  <th className="px-4 py-2.5 font-semibold">{d.common.status}</th>
                  <th className="px-4 py-2.5 font-semibold">{d.common.date}</th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((row) => {
                  const review = row.reviews[0]
                  return (
                    <tr key={row.id} className="border-b border-ink-50 last:border-0 hover:bg-brand-50/40">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/consultations/${row.id}`}
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          {row.user?.fullName ?? row.code}
                        </Link>
                        <p className="text-xs text-ink-400">{row.code}</p>
                      </td>
                      <td className="px-4 py-2.5 text-ink-700">
                        {symptomLabel(row.primarySymptom, locale) || '—'}
                        {row.severity !== null && (
                          <span className="ml-1 text-xs text-ink-400">{row.severity}/10</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {row._count.redFlags > 0 ? (
                          <Badge tone="danger">
                            {row._count.redFlags} {d.admin.redFlagsLabel}
                          </Badge>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.triageLevel ? (
                          <Badge tone={TRIAGE_TONE[row.triageLevel as TriageLevelKey]}>
                            {d.consultation.triage[row.triageLevel as TriageLevelKey]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                        <p className="mt-0.5 text-xs text-ink-400">
                          {row._count.recommendations} {d.admin.productsConsidered.toLowerCase()}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        {review ? (
                          <span className="text-xs text-ink-700">
                            {review.pharmacist.fullName}
                            <span className="block text-ink-400">{review.action}</span>
                          </span>
                        ) : row.handedOffAt ? (
                          <Badge tone="warning">{d.admin.pharmacistReferrals}</Badge>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink-500">
                        {formatDateTime(row.createdAt, locale)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Alert tone="info" className="mt-5" title={d.admin.purgedNotice}>
        {d.consultation.privacyNote}
      </Alert>
    </>
  )
}
