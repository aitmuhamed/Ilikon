import Link from 'next/link'
import { Clock, Facebook, Instagram, Mail, MapPin, Phone, ShieldCheck, Youtube } from 'lucide-react'

import { Logo } from './header'
import type { Dictionary } from '@/i18n/types'
import type { Locale } from '@/lib/locale-types'
import type { PharmacySettings } from '@/lib/settings'
import { localizedAddress } from '@/lib/settings'

export function Footer({
  d,
  locale,
  settings,
}: {
  d: Dictionary
  locale: Locale
  settings: PharmacySettings
}) {
  const path = (p: string) => `/${locale}${p === '/' ? '' : p}`

  const quickLinks = [
    { href: '/', label: d.nav.home },
    { href: '/about', label: d.nav.pharmacy },
    { href: '/products', label: d.nav.products },
    { href: '/about', label: d.nav.about },
    { href: '/contact', label: d.nav.contact },
    { href: '/faq', label: d.nav.faq },
  ]

  const customerLinks = [
    { href: '/account', label: d.footer.myAccount },
    { href: '/account/orders', label: d.nav.orders },
    { href: '/account/wishlist', label: d.nav.wishlist },
    { href: '/about#delivery', label: d.footer.delivery },
    { href: '/prescriptions/upload', label: d.nav.prescriptionUpload },
  ]

  const socials = [
    { url: settings.socialFacebook, icon: Facebook, label: 'Facebook' },
    { url: settings.socialInstagram, icon: Instagram, label: 'Instagram' },
    { url: settings.socialYoutube, icon: Youtube, label: 'YouTube' },
  ].filter((s) => Boolean(s.url))

  return (
    <footer className="mt-16 border-t border-ink-200 bg-white">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              <Logo />
              <div>
                <p className="text-lg font-extrabold leading-none text-brand-700">
                  {settings.pharmacyName}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
                  {settings.pharmacyTagline}
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">{d.footer.tagline}</p>

            <div className="mt-5 inline-flex items-start gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              <p className="text-xs leading-relaxed text-brand-800">
                {d.footer.licenseNote}
                <span className="mt-0.5 block font-semibold">№ {settings.licenseNumber}</span>
              </p>
            </div>

            {socials.length > 0 ? (
              <div className="mt-5">
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
          </div>

          {/* Quick links */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-ink-900">{d.footer.quickLinks}</h3>
            <ul className="mt-3.5 space-y-2.5">
              {quickLinks.map((link, index) => (
                <li key={`${link.href}-${index}`}>
                  <Link
                    href={path(link.href)}
                    className="text-sm text-ink-500 transition-colors hover:text-brand-700"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-ink-900">{d.footer.customer}</h3>
            <ul className="mt-3.5 space-y-2.5">
              {customerLinks.map((link, index) => (
                <li key={`${link.href}-${index}`}>
                  <Link
                    href={path(link.href)}
                    className="text-sm text-ink-500 transition-colors hover:text-brand-700"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-4">
            <h3 className="text-sm font-semibold text-ink-900">{d.footer.contact}</h3>
            <ul className="mt-3.5 space-y-3">
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                <span className="text-sm text-ink-600">
                  <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="font-medium hover:text-brand-700">
                    {settings.phone}
                  </a>
                  {settings.phoneSecondary ? (
                    <>
                      {', '}
                      <a
                        href={`tel:${settings.phoneSecondary.replace(/\s/g, '')}`}
                        className="hover:text-brand-700"
                      >
                        {settings.phoneSecondary}
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
              <li className="flex gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                <a
                  href={`mailto:${settings.email}`}
                  className="text-sm text-ink-600 hover:text-brand-700"
                >
                  {settings.email}
                </a>
              </li>
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                <span className="text-sm leading-relaxed text-ink-600">
                  {localizedAddress(settings, locale)}
                </span>
              </li>
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                <span className="text-sm text-ink-600">
                  <span className="block">
                    {d.about.weekdays}: {settings.workingHoursWeekdays}
                  </span>
                  <span className="block">
                    {d.about.saturday}: {settings.workingHoursSaturday}
                  </span>
                  <span className="block">
                    {d.about.sunday}: {settings.workingHoursSunday}
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Safety disclaimer — required on every page of a pharmacy site. */}
        <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-amber-900">{d.footer.disclaimer}</p>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-6 sm:flex-row">
          <p className="text-xs text-ink-400">
            © {new Date().getFullYear()} {settings.pharmacyName} {settings.pharmacyTagline}. {d.footer.rights}.
          </p>
          <div className="flex items-center gap-4">
            <Link href={path('/terms')} className="text-xs text-ink-400 transition-colors hover:text-brand-700">
              {d.footer.terms}
            </Link>
            <Link href={path('/privacy')} className="text-xs text-ink-400 transition-colors hover:text-brand-700">
              {d.footer.privacy}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
