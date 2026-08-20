import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Activity,
  Clock,
  FileCheck2,
  Mail,
  MapPin,
  Phone,
  Pill,
  ShieldCheck,
  Stethoscope,
  Truck,
  UserRound,
} from 'lucide-react'

import { Alert, Badge, Breadcrumbs, Card, SectionHeading } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSettings, localizedAddress } from '@/lib/settings'
import { prisma } from '@/lib/prisma'
import { buildMetadata, faqJsonLd, jsonLdScript } from '@/lib/seo'
import { formatMnt } from '@/lib/utils'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const settings = await getSettings()
  return buildMetadata({
    locale,
    title: d.about.title,
    description: d.about.aboutBody1.slice(0, 160),
    pathWithoutLocale: '/about',
    siteName: `${settings.pharmacyName} — ${settings.pharmacyTagline}`,
  })
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const settings = await getSettings()

  // Pharmacists are real staff records — the team list stays in step with the
  // people who actually hold the licence.
  const pharmacists = await prisma.user.findMany({
    where: {
      isStaff: true,
      deletedAt: null,
      status: 'ACTIVE',
      role: { key: 'pharmacist' },
    },
    select: { id: true, fullName: true, jobTitle: true, licenseNumber: true },
    orderBy: { createdAt: 'asc' },
  })

  const services = [
    { icon: Pill, title: d.about.service1, body: d.about.service1Desc },
    { icon: Stethoscope, title: d.about.service2, body: d.about.service2Desc },
    { icon: FileCheck2, title: d.about.service3, body: d.about.service3Desc },
    { icon: Activity, title: d.about.service4, body: d.about.service4Desc },
    { icon: Truck, title: d.about.service5, body: d.about.service5Desc },
    { icon: ShieldCheck, title: d.about.service6, body: d.about.service6Desc },
  ]

  const faqs = [
    { q: d.faq.q1, a: d.faq.a1 },
    { q: d.faq.q2, a: d.faq.a2 },
    { q: d.faq.q3, a: d.faq.a3 },
    { q: d.faq.q4, a: d.faq.a4 },
    { q: d.faq.q5, a: d.faq.a5 },
    { q: d.faq.q6, a: d.faq.a6 },
    { q: d.faq.q7, a: d.faq.a7 },
    { q: d.faq.q8, a: d.faq.a8 },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(d)) }}
      />

      {/* Hero */}
      <section className="border-b border-brand-100 bg-gradient-to-br from-brand-50 via-white to-accent-50/30">
        <div className="container-page py-10 lg:py-14">
          <Breadcrumbs
            className="mb-5"
            items={[{ label: d.common.home, href: `/${locale}` }, { label: d.about.title }]}
          />
          <div className="max-w-3xl">
            <Badge tone="brand" icon={<ShieldCheck className="h-3 w-3" />}>
              № {settings.licenseNumber}
            </Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              {d.about.heroTitle}
            </h1>
            <p className="mt-2 text-lg text-brand-700">{d.about.heroSubtitle}</p>
            <p className="mt-5 text-sm leading-relaxed text-ink-600">{d.about.aboutBody1}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">{d.about.aboutBody2}</p>
          </div>
        </div>
      </section>

      <div className="container-page space-y-14 py-12">
        {/* Services */}
        <section>
          <SectionHeading title={d.about.services} icon={<Pill className="h-5 w-5" />} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.title} className="card-hover">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <service.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">{service.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{service.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Pharmacists */}
        <section>
          <SectionHeading
            title={d.about.pharmacists}
            subtitle={d.about.pharmacistsBody}
            icon={<UserRound className="h-5 w-5" />}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pharmacists.map((pharmacist) => (
              <Card key={pharmacist.id} className="flex items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
                  {pharmacist.fullName.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{pharmacist.fullName}</p>
                  <p className="text-xs text-ink-500">{pharmacist.jobTitle ?? d.admin.role}</p>
                  {pharmacist.licenseNumber ? (
                    <p className="mt-1.5 text-[11px] text-ink-400">
                      {d.about.license}: <span className="tabular">{pharmacist.licenseNumber}</span>
                    </p>
                  ) : null}
                </div>
              </Card>
            ))}
            {pharmacists.length === 0 ? (
              <p className="text-sm text-ink-500">{d.common.noResults}</p>
            ) : null}
          </div>
          <Alert tone="brand" className="mt-4">
            {d.home.trustPharmacistDesc} — {d.prescription.safetyNotice}
          </Alert>
        </section>

        {/* Hours, location, contact */}
        <section id="contact">
          <SectionHeading title={d.about.contactTitle} icon={<Phone className="h-5 w-5" />} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Clock className="h-4 w-4 text-brand-600" aria-hidden />
                {d.about.workingHours}
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">{d.about.weekdays}</dt>
                  <dd className="font-medium text-ink-900 tabular">{settings.workingHoursWeekdays}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">{d.about.saturday}</dt>
                  <dd className="font-medium text-ink-900 tabular">{settings.workingHoursSaturday}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">{d.about.sunday}</dt>
                  <dd className="font-medium text-ink-900 tabular">{settings.workingHoursSunday}</dd>
                </div>
              </dl>
            </Card>

            <Card>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Phone className="h-4 w-4 text-brand-600" aria-hidden />
                {d.footer.contact}
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <a
                    href={`tel:${settings.phone.replace(/\s/g, '')}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {settings.phone}
                  </a>
                </li>
                {settings.phoneSecondary ? (
                  <li>
                    <a
                      href={`tel:${settings.phoneSecondary.replace(/\s/g, '')}`}
                      className="text-ink-600 hover:text-brand-700"
                    >
                      {settings.phoneSecondary}
                    </a>
                  </li>
                ) : null}
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-ink-400" aria-hidden />
                  <a href={`mailto:${settings.email}`} className="text-ink-600 hover:text-brand-700">
                    {settings.email}
                  </a>
                </li>
              </ul>
              <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-800">
                {d.chatbot.emergencyNotice}
              </p>
            </Card>

            <Card>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <MapPin className="h-4 w-4 text-brand-600" aria-hidden />
                {d.about.location}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">
                {localizedAddress(settings, locale)}
              </p>
              <p className="mt-2 text-xs text-ink-500">{d.about.locationBody}</p>
              <a href={settings.mapLink} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                <Button variant="outline" size="sm" fullWidth>
                  {d.about.getDirections}
                </Button>
              </a>
            </Card>
          </div>

          {/* Map */}
          {settings.mapEmbedUrl ? (
            <div className="mt-4 overflow-hidden rounded-card border border-ink-200">
              <iframe
                src={settings.mapEmbedUrl}
                title={d.about.mapTitle}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[320px] w-full border-0 sm:h-[400px]"
              />
            </div>
          ) : null}
        </section>

        {/* Delivery */}
        <section id="delivery">
          <SectionHeading
            title={d.about.deliveryInfo}
            subtitle={d.home.deliverySubtitle}
            icon={<Truck className="h-5 w-5" />}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-brand-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                {d.home.deliveryZone1}
              </p>
              <p className="mt-1.5 text-xl font-bold text-brand-700">
                {settings.deliveryEtaCentre}{' '}
                <span className="text-sm font-medium text-ink-500">
                  {locale === 'en' ? 'hours' : locale === 'ru' ? 'часа' : 'цаг'}
                </span>
              </p>
            </Card>
            <Card className="border-brand-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                {d.home.deliveryZone2}
              </p>
              <p className="mt-1.5 text-xl font-bold text-brand-700">
                {settings.deliveryEtaOuter}{' '}
                <span className="text-sm font-medium text-ink-500">
                  {locale === 'en' ? 'hours' : locale === 'ru' ? 'часа' : 'цаг'}
                </span>
              </p>
            </Card>
            <Card className="border-brand-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                {d.cart.deliveryFee}
              </p>
              <p className="mt-1.5 text-xl font-bold text-brand-700 tabular">
                {formatMnt(settings.deliveryFee, locale)}
              </p>
            </Card>
            <Card className="border-brand-200 bg-brand-50/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                {d.cart.freeDelivery}
              </p>
              <p className="mt-1.5 text-xl font-bold text-brand-700 tabular">
                {formatMnt(settings.freeDeliveryThreshold, locale)}
              </p>
              <p className="mt-1 text-xs text-brand-700/80">{d.home.deliveryFreeNote}</p>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <SectionHeading title={d.about.faq} />
          <div className="space-y-2.5">
            {faqs.map((item, index) => (
              <details
                key={index}
                className="group rounded-card border border-ink-200 bg-white px-5 py-4 shadow-card"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-ink-900 marker:content-none">
                  {item.q}
                  <span
                    className="shrink-0 text-lg text-brand-600 transition-transform group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <Alert tone="warning">{d.footer.disclaimer}</Alert>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/${locale}/products`}>
            <Button size="lg">{d.home.heroCtaPrimary}</Button>
          </Link>
          <Link href={`/${locale}/prescriptions/upload`}>
            <Button size="lg" variant="outline">
              {d.prescription.uploadTitle}
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}
