import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ResetPasswordForm } from '@/components/site/auth-forms'
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
    title: d.auth.resetTitle,
    description: d.auth.forgotSubtitle,
    pathWithoutLocale: '/reset-password',
    noIndex: true,
  })
}

export default function Page() {
  return (
    <div className="container-page py-12 lg:py-16">
      <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
