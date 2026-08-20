import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'

import './globals.css'
import { publicEnv } from '@/lib/env'
import { LOCALE_META, coerceLocale } from '@/lib/locale-types'

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: 'Иликон — Уужим Эмийн Сан',
    template: '%s | Иликон — Уужим Эмийн Сан',
  },
  description:
    'Иликон Уужим Эмийн Сан — эм, витамин, эрүүл мэндийн хэрэгсэл онлайнаар захиалж, Улаанбаатар хотод хүргүүлээрэй.',
  applicationName: 'Иликон',
  authors: [{ name: 'Иликон Уужим Эмийн Сан' }],
  formatDetection: { telephone: true, address: false, email: false },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg' }],
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#158055',
}

/**
 * The root layout only establishes the document shell. `lang` comes from the
 * `x-locale` header the middleware attaches, so it is correct on the locale
 * routes and on the locale-free `/admin` tree alike.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = coerceLocale((await headers()).get('x-locale'))

  return (
    <html lang={LOCALE_META[locale].htmlLang} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
