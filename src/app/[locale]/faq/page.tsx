import type { Metadata } from 'next'
import Link from 'next/link'
import { HelpCircle, MessageCircle, Phone } from 'lucide-react'

import { Alert, Breadcrumbs, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { getSettings } from '@/lib/settings'
import { buildMetadata, faqJsonLd, jsonLdScript } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.about.faq,
    description: `${d.faq.q1} ${d.faq.q2} ${d.faq.q4}`.slice(0, 160),
    pathWithoutLocale: '/faq',
  })
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const settings = await getSettings()

  const groups = [
    {
      title: d.checkout.title,
      items: [
        { q: d.faq.q1, a: d.faq.a1 },
        { q: d.faq.q5, a: d.faq.a5 },
        { q: d.faq.q6, a: d.faq.a6 },
      ],
    },
    {
      title: d.footer.delivery,
      items: [
        { q: d.faq.q2, a: d.faq.a2 },
        { q: d.faq.q3, a: d.faq.a3 },
      ],
    },
    {
      title: d.prescription.title,
      items: [{ q: d.faq.q4, a: d.faq.a4 }],
    },
    {
      title: d.product.tabSafety,
      items: [
        { q: d.faq.q7, a: d.faq.a7 },
        { q: d.faq.q8, a: d.faq.a8 },
      ],
    },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(d)) }}
      />

      <div className="container-page py-6 lg:py-10">
        <Breadcrumbs
          className="mb-4"
          items={[{ label: d.common.home, href: `/${locale}` }, { label: d.about.faq }]}
        />

        <div className="mb-8 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <HelpCircle className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{d.about.faq}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {settings.pharmacyName} — {settings.pharmacyTagline}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.title}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-700">
                  {group.title}
                </h2>
                <div className="space-y-2.5">
                  {group.items.map((item, index) => (
                    <details
                      key={index}
                      className="group rounded-card border border-ink-200 bg-white px-5 py-4 shadow-card"
                      open={index === 0}
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
            ))}

            <Alert tone="warning">{d.footer.disclaimer}</Alert>
          </div>

          <aside className="space-y-4">
            <Card className="lg:sticky lg:top-32">
              <h2 className="text-sm font-semibold text-ink-900">{d.about.contactTitle}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{d.chatbot.disclaimer}</p>

              <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="mt-4 block">
                <Button fullWidth size="md">
                  <Phone className="h-4 w-4" aria-hidden />
                  {settings.phone}
                </Button>
              </a>

              <Link href={`/${locale}/contact`} className="mt-2 block">
                <Button variant="outline" fullWidth size="md">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {d.nav.contact}
                </Button>
              </Link>

              <p className="mt-3 text-center text-xs text-ink-400">{settings.workingHoursWeekdays}</p>

              <div className="mt-4 rounded-lg bg-red-50 p-3 text-center">
                <p className="text-xs font-semibold text-red-800">{d.chatbot.emergencyNotice}</p>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </>
  )
}
