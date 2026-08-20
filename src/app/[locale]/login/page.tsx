import type { Metadata } from 'next'
import { Suspense } from 'react'

import { LoginForm } from '@/components/site/auth-forms'
import { Spinner } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
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
    title: d.auth.loginTitle,
    description: d.auth.loginSubtitle,
    pathWithoutLocale: '/login',
    noIndex: true,
  })
}

export default function Page() {
  return (
    <div className="container-page py-12 lg:py-16">
      <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
