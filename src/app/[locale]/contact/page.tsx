import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, ShieldAlert } from 'lucide-react'

import { Alert, Breadcrumbs, Card, SectionHeading } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSettings, localizedAddress } from '@/lib/settings'
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
    title: d.nav.contact,
    description: d.about.contactTitle,
    pathWithoutLocale: '/contact',
  })
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const settings = await getSettings()

  const socials = [
    { url: settings.socialFacebook, icon: Facebook, label: 'Facebook' },
    { url: settings.socialInstagram, icon: Instagram, label: 'Instagram' },
  ].filter((social) => Boolean(social.url))

  return (
    <div className="container-page py-6 lg:py-10">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: d.common.home, href: `/${locale}` }, { label: d.nav.contact }]}
      />

      <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{d.about.contactTitle}</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        {settings.pharmacyName} — {settings.pharmacyTagline}
      </p>

      {/* Emergency notice first: it is the most important thing on this page. */}
      <Alert tone="danger" className="mt-6" title={d.chatbot.emergencyNotice}>
        {d.chatbot.safetyRedirect}
      </Alert>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="block">
          <Card className="card-hover h-full">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Phone className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-ink-900">{d.common.phone}</h2>
            <p className="mt-1 text-lg font-bold text-brand-700">{settings.phone}</p>
            {settings.phoneSecondary ? (
              <p className="text-sm text-ink-500">{settings.phoneSecondary}</p>
            ) : null}
            <p className="mt-2 text-xs text-ink-400">{settings.workingHoursWeekdays}</p>
          </Card>
        </a>

        <a href={`mailto:${settings.email}`} className="block">
          <Card className="card-hover h-full">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Mail className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-ink-900">{d.common.email}</h2>
            <p className="mt-1 break-all text-sm font-semibold text-accent-700">{settings.email}</p>
            <p className="mt-2 text-xs text-ink-400">{d.about.contactTitle}</p>
          </Card>
        </a>

        <a href={settings.mapLink} target="_blank" rel="noopener noreferrer" className="block">
          <Card className="card-hover h-full">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <MapPin className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-ink-900">{d.about.location}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              {localizedAddress(settings, locale)}
            </p>
            <p className="mt-2 text-xs font-semibold text-brand-700">{d.about.getDirections} →</p>
          </Card>
        </a>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title={d.about.workingHours} icon={<Clock className="h-5 w-5" />} />
          <Card>
            <dl className="space-y-3">
              <div className="flex items-center justify-between gap-4 border-b border-ink-100 pb-3">
                <dt className="text-sm text-ink-600">{d.about.weekdays}</dt>
                <dd className="text-sm font-semibold text-ink-900 tabular">
                  {settings.workingHoursWeekdays}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-ink-100 pb-3">
                <dt className="text-sm text-ink-600">{d.about.saturday}</dt>
                <dd className="text-sm font-semibold text-ink-900 tabular">
                  {settings.workingHoursSaturday}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-ink-600">{d.about.sunday}</dt>
                <dd className="text-sm font-semibold text-ink-900 tabular">
                  {settings.workingHoursSunday}
                </dd>
              </div>
            </dl>

            {socials.length > 0 ? (
              <div className="mt-5 border-t border-ink-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {d.footer.social}
                </p>
                <div className="flex gap-2">
                  {socials.map((social) => (
                    <a
                      key={social.label}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <social.icon className="h-4 w-4" aria-hidden />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div>
          <SectionHeading title={d.chatbot.name} icon={<MessageCircle className="h-5 w-5" />} />
          <Card className="flex h-full flex-col">
            <p className="text-sm leading-relaxed text-ink-600">{d.chatbot.greeting}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-ink-600">
              <li>• {d.chatbot.suggestion1}</li>
              <li>• {d.chatbot.suggestion2}</li>
              <li>• {d.chatbot.suggestion3}</li>
              <li>• {d.chatbot.suggestion4}</li>
            </ul>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p className="text-[11px] leading-relaxed text-amber-900">{d.chatbot.disclaimer}</p>
            </div>
            <div className="mt-auto pt-4">
              <Link href={`/${locale}/faq`}>
                <Button variant="outline" size="sm" fullWidth>
                  {d.nav.faq}
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {settings.mapEmbedUrl ? (
        <div className="mt-10 overflow-hidden rounded-card border border-ink-200">
          <iframe
            src={settings.mapEmbedUrl}
            title={d.about.mapTitle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-[320px] w-full border-0 sm:h-[420px]"
          />
        </div>
      ) : null}
    </div>
  )
}
