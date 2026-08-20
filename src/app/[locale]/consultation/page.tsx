import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

import { ConsultationClient } from '@/components/site/consultation-client'
import { Breadcrumbs } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { isLocale, type Locale } from '@/lib/locale-types'
import { getSettings, localizedDisclaimer } from '@/lib/settings'
import { absoluteUrl, alternateLanguages } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const d = getDictionary(locale)

  return {
    title: d.consultation.title,
    description: d.consultation.subtitle,
    alternates: {
      canonical: absoluteUrl(`/${locale}/consultation`),
      languages: alternateLanguages('/consultation'),
    },
    // A health questionnaire has no business in a search index.
    robots: { index: false, follow: true },
  }
}

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  if (!isLocale(rawLocale)) notFound()
  const locale = rawLocale as Locale

  const d = getDictionary(locale)
  const settings = await getSettings()

  const available =
    settings.consultationEnabled && settings.consultationLocales.includes(locale)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs
        items={[
          { label: d.common.home, href: `/${locale}` },
          { label: d.consultation.navLabel },
        ]}
      />

      <div className="mb-5 mt-4">
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">{d.consultation.navLabel}</h1>
        <p className="mt-1 text-sm text-ink-500">{d.consultation.subtitle}</p>
      </div>

      <ConsultationClient
        enabled={available}
        disclaimer={localizedDisclaimer(settings, locale)}
        emergencyNumber={settings.emergencyNumber}
        pharmacyPhone={settings.phone}
      />

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-400">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {d.consultation.privacyNote} {settings.licenseNumber}
      </p>
    </div>
  )
}
