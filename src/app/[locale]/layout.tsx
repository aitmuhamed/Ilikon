import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Providers } from '@/components/providers'
import { Header, type HeaderUser } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { MobileTabBar } from '@/components/site/mobile-tab-bar'
import { ChatbotWidget } from '@/components/site/chatbot'
import { getDictionary } from '@/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/locale-types'
import { getSettings, localizedGreeting } from '@/lib/settings'
import { getCategoryTree } from '@/lib/products'
import { getSession } from '@/lib/auth'
import { cartBadgeCount } from '@/lib/cart'
import { unreadCount } from '@/lib/notifications'
import { pharmacyJsonLd, jsonLdScript } from '@/lib/seo'
import { absoluteUrl, alternateLanguages } from '@/lib/seo'
import { localizedAddress } from '@/lib/settings'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const d = getDictionary(locale)
  const settings = await getSettings()

  return {
    title: { default: d.meta.defaultTitle, template: `%s | ${settings.pharmacyName}` },
    description: settings.seoDescription || d.meta.defaultDescription,
    keywords: settings.seoKeywords.split(',').map((k) => k.trim()).filter(Boolean),
    alternates: { canonical: absoluteUrl(`/${locale}`), languages: alternateLanguages('/') },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  if (!isLocale(rawLocale)) notFound()
  const locale = rawLocale as Locale

  const d = getDictionary(locale)
  const [settings, categories, session] = await Promise.all([
    getSettings(),
    getCategoryTree(locale),
    getSession(),
  ])

  const [cartCount, notifications] = await Promise.all([
    cartBadgeCount(session?.id ?? null),
    session ? unreadCount(session.id, session.isStaff) : Promise.resolve(0),
  ])

  const headerUser: HeaderUser | null = session
    ? {
        id: session.id,
        fullName: session.fullName,
        isStaff: session.isStaff,
        hasAdminAccess: session.isStaff && session.permissions.length > 0,
        unreadNotifications: notifications,
      }
    : null

  const jsonLd = pharmacyJsonLd({
    name: settings.pharmacyName,
    tagline: settings.pharmacyTagline,
    phone: settings.phone,
    email: settings.email,
    address: localizedAddress(settings, locale),
    url: absoluteUrl(`/${locale}`),
    openingHours: {
      weekdays: settings.workingHoursWeekdays,
      saturday: settings.workingHoursSaturday,
      sunday: settings.workingHoursSunday,
    },
  })

  return (
    <Providers locale={locale} dictionary={d} cartCount={cartCount}>
      <script
        type="application/ld+json"
        // Escaped by `jsonLdScript`: the pharmacy name and address are
        // admin-editable, so this is not trusted markup.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          {d.common.home}
        </a>

        <Header
          categories={categories}
          user={headerUser}
          phone={settings.phone}
          workingHours={`${d.about.weekdays}: ${settings.workingHoursWeekdays}`}
          deliveryNote={`${d.home.deliveryZone1}: ${settings.deliveryEtaCentre} ${
            locale === 'en' ? 'hours' : locale === 'ru' ? 'часа' : 'цаг'
          }`}
        />

        <main id="main" className="flex-1">
          {children}
        </main>

        <Footer d={d} locale={locale} settings={settings} />
        <MobileTabBar />
        <ChatbotWidget
          enabled={settings.chatbotEnabled}
          greeting={localizedGreeting(settings, locale)}
        />
      </div>
    </Providers>
  )
}
