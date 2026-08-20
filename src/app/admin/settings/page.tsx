import { notFound } from 'next/navigation'

import { AdminPageHeader } from '@/components/admin/shell'
import { SettingsForm } from '@/components/admin/settings-client'
import { getDictionary } from '@/i18n'
import { coerceLocale } from '@/lib/locale-types'
import { can, getSession } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { paymentProviderStatus } from '@/lib/payments'
import { isLlmConfigured } from '@/lib/chatbot'

export default async function AdminSettingsPage() {
  const session = (await getSession())!
  if (!can(session, 'settings.view')) notFound()

  const locale = coerceLocale(session.locale)
  const d = getDictionary(locale)
  const settings = await getSettings()

  return (
    <>
      <AdminPageHeader title={d.admin.settings} subtitle={settings.pharmacyName} />
      <SettingsForm
        initial={settings}
        integrations={{
          payments: paymentProviderStatus(),
          chatbotLlm: isLlmConfigured(),
        }}
        canEdit={can(session, 'settings.manage')}
      />
    </>
  )
}
