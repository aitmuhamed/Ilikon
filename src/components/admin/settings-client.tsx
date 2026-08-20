'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Lock, Save, X } from 'lucide-react'

import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Field, Input, Switch, Textarea } from '@/components/ui/field'
import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/client-api'
import { LOCALE_META, type Locale } from '@/lib/locale-types'
import { cn } from '@/lib/utils'
import type { PharmacySettings } from '@/lib/settings-defaults'

type Tab = 'general' | 'delivery' | 'payment' | 'notification' | 'chatbot' | 'social' | 'seo' | 'inventory'

/**
 * Pharmacy settings.
 *
 * Only non-secret operational values are editable here. Gateway credentials and
 * API keys live in server environment variables; this screen shows whether each
 * integration is configured, never the key itself.
 */
export function SettingsForm({
  initial,
  integrations,
  canEdit,
}: {
  initial: PharmacySettings
  integrations: { payments: { method: string; configured: boolean }[]; chatbotLlm: boolean }
  canEdit: boolean
}) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [values, setValues] = React.useState<PharmacySettings>(initial)
  const [tab, setTab] = React.useState<Tab>('general')
  const [saving, setSaving] = React.useState(false)

  function set<K extends keyof PharmacySettings>(key: K, value: PharmacySettings[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const dirty = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  )

  async function save() {
    setSaving(true)
    try {
      await apiFetch('/api/settings', { method: 'PATCH', body: values })
      toast.success(d.admin.settingsSaved)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setSaving(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: d.admin.generalSettings },
    { key: 'delivery', label: d.admin.deliverySettings },
    { key: 'payment', label: d.admin.paymentSettings },
    { key: 'inventory', label: d.admin.inventory },
    { key: 'notification', label: d.admin.notificationSettings },
    { key: 'chatbot', label: d.admin.chatbotSettings },
    { key: 'social', label: d.admin.socialLinks },
    { key: 'seo', label: d.admin.seoSettings },
  ]

  return (
    <>
      <Alert tone="warning" className="mb-4" title={d.admin.secretsNote}>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {integrations.payments.map((integration) => (
            <Badge
              key={integration.method}
              tone={integration.configured ? 'success' : 'neutral'}
              icon={
                integration.configured ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />
              }
            >
              {d.paymentMethod[integration.method as keyof typeof d.paymentMethod]}
            </Badge>
          ))}
          <Badge
            tone={integrations.chatbotLlm ? 'success' : 'neutral'}
            icon={integrations.chatbotLlm ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          >
            {integrations.chatbotLlm ? d.admin.chatbotLlmOn : d.admin.chatbotLlmOff}
          </Badge>
        </div>
      </Alert>

      <div className="mb-4 flex overflow-x-auto rounded-xl border border-ink-200 bg-white p-1 no-scrollbar">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
              tab === item.key ? 'bg-brand-500 text-white' : 'text-ink-600 hover:bg-ink-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          {tab === 'general' ? (
            <Card className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={d.admin.pharmacyName} required>
                  <Input
                    value={values.pharmacyName}
                    onChange={(event) => set('pharmacyName', event.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label={d.meta.siteTagline}>
                  <Input
                    value={values.pharmacyTagline}
                    onChange={(event) => set('pharmacyTagline', event.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label={d.about.license}>
                  <Input
                    value={values.licenseNumber}
                    onChange={(event) => set('licenseNumber', event.target.value)}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={d.admin.currency}>
                  <Input
                    value={values.currency}
                    onChange={(event) => set('currency', event.target.value)}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={d.common.phone} required>
                  <Input
                    value={values.phone}
                    onChange={(event) => set('phone', event.target.value)}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={`${d.common.phone} 2`} hint={d.common.optional}>
                  <Input
                    value={values.phoneSecondary}
                    onChange={(event) => set('phoneSecondary', event.target.value)}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={d.common.email} required className="sm:col-span-2">
                  <Input
                    type="email"
                    value={values.email}
                    onChange={(event) => set('email', event.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
              </div>

              <div className="space-y-4 border-t border-ink-100 pt-4">
                <h4 className="text-sm font-semibold text-ink-900">{d.common.address}</h4>
                {(
                  [
                    ['addressMn', 'mn'],
                    ['addressEn', 'en'],
                    ['addressRu', 'ru'],
                  ] as [keyof PharmacySettings, Locale][]
                ).map(([key, code]) => (
                  <Field key={key} label={`${d.common.address} — ${LOCALE_META[code].nativeLabel}`}>
                    <Textarea
                      rows={2}
                      value={values[key] as string}
                      onChange={(event) => set(key, event.target.value as never)}
                      disabled={!canEdit}
                    />
                  </Field>
                ))}
              </div>

              <div className="grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-3">
                <Field label={d.about.weekdays}>
                  <Input
                    value={values.workingHoursWeekdays}
                    onChange={(event) => set('workingHoursWeekdays', event.target.value)}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={d.about.saturday}>
                  <Input
                    value={values.workingHoursSaturday}
                    onChange={(event) => set('workingHoursSaturday', event.target.value)}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={d.about.sunday}>
                  <Input
                    value={values.workingHoursSunday}
                    onChange={(event) => set('workingHoursSunday', event.target.value)}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
              </div>

              <div className="grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
                <Field label={d.about.mapTitle} hint="embed URL">
                  <Input
                    value={values.mapEmbedUrl}
                    onChange={(event) => set('mapEmbedUrl', event.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label={d.about.getDirections} hint="link">
                  <Input
                    value={values.mapLink}
                    onChange={(event) => set('mapLink', event.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
              </div>
            </Card>
          ) : null}

          {tab === 'delivery' ? (
            <Card className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`${d.admin.deliveryFee} (₮)`}>
                  <Input
                    type="number"
                    min={0}
                    value={values.deliveryFee}
                    onChange={(event) => set('deliveryFee', Number(event.target.value))}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={`${d.admin.freeDeliveryThreshold} (₮)`}>
                  <Input
                    type="number"
                    min={0}
                    value={values.freeDeliveryThreshold}
                    onChange={(event) => set('freeDeliveryThreshold', Number(event.target.value))}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={`${d.home.deliveryZone1} (h)`}>
                  <Input
                    value={values.deliveryEtaCentre}
                    onChange={(event) => set('deliveryEtaCentre', event.target.value)}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={`${d.home.deliveryZone2} (h)`}>
                  <Input
                    value={values.deliveryEtaOuter}
                    onChange={(event) => set('deliveryEtaOuter', event.target.value)}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
              </div>

              <div className="space-y-3 border-t border-ink-100 pt-4">
                <h4 className="text-sm font-semibold text-ink-900">{d.admin.taxSettings}</h4>
                <Field label={`${d.admin.taxRate} (%)`}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={values.taxRatePct}
                    onChange={(event) => set('taxRatePct', Number(event.target.value))}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Switch
                  checked={values.taxIncludedInPrice}
                  onChange={(value) => set('taxIncludedInPrice', value)}
                  label={d.admin.taxIncluded}
                  disabled={!canEdit}
                />
              </div>
            </Card>
          ) : null}

          {tab === 'payment' ? (
            <Card className="space-y-3">
              <Switch
                checked={values.paymentCashEnabled}
                onChange={(value) => set('paymentCashEnabled', value)}
                label={d.checkout.cashOnDelivery}
                description={d.checkout.cashOnDeliveryDesc}
                disabled={!canEdit}
              />
              <Switch
                checked={values.paymentBankEnabled}
                onChange={(value) => set('paymentBankEnabled', value)}
                label={d.checkout.bankTransfer}
                description={d.checkout.bankTransferDesc}
                disabled={!canEdit}
              />
              <Switch
                checked={values.paymentCardEnabled}
                onChange={(value) => set('paymentCardEnabled', value)}
                label={d.checkout.card}
                description={d.checkout.cardDesc}
                disabled={!canEdit}
              />
              <Switch
                checked={values.paymentQpayEnabled}
                onChange={(value) => set('paymentQpayEnabled', value)}
                label={d.checkout.qpay}
                description={d.checkout.qpayDesc}
                disabled={!canEdit}
              />

              <Alert tone="info" className="mt-2">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <p className="text-xs">{d.admin.secretsNote}</p>
                </div>
              </Alert>
            </Card>
          ) : null}

          {tab === 'inventory' ? (
            <Card className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={d.admin.lowStockThreshold}>
                  <Input
                    type="number"
                    min={0}
                    value={values.lowStockThreshold}
                    onChange={(event) => set('lowStockThreshold', Number(event.target.value))}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
                <Field label={`${d.admin.expiringAlert} (${d.admin.daysLeft})`}>
                  <Input
                    type="number"
                    min={1}
                    value={values.expiryWarningDays}
                    onChange={(event) => set('expiryWarningDays', Number(event.target.value))}
                    disabled={!canEdit}
                    className="tabular"
                  />
                </Field>
              </div>
              <Alert tone="warning">{d.validation.expiredProduct}</Alert>
            </Card>
          ) : null}

          {tab === 'notification' ? (
            <Card className="space-y-3">
              <Switch
                checked={values.notifyOnNewOrder}
                onChange={(value) => set('notifyOnNewOrder', value)}
                label={d.notification.NEW_ORDER}
                disabled={!canEdit}
              />
              <Switch
                checked={values.notifyOnLowStock}
                onChange={(value) => set('notifyOnLowStock', value)}
                label={d.notification.LOW_STOCK}
                disabled={!canEdit}
              />
              <Switch
                checked={values.notifyOnExpiring}
                onChange={(value) => set('notifyOnExpiring', value)}
                label={d.notification.EXPIRING_PRODUCT}
                disabled={!canEdit}
              />
              <Switch
                checked={values.notifyOnNewPrescription}
                onChange={(value) => set('notifyOnNewPrescription', value)}
                label={d.notification.NEW_PRESCRIPTION}
                disabled={!canEdit}
              />
              <Alert tone="info" className="mt-2">
                {d.admin.marketingConsentNote}
              </Alert>
            </Card>
          ) : null}

          {tab === 'chatbot' ? (
            <Card className="space-y-4">
              <Switch
                checked={values.chatbotEnabled}
                onChange={(value) => set('chatbotEnabled', value)}
                label={d.admin.chatbotEnabled}
                description={d.chatbot.subtitle}
                disabled={!canEdit}
              />

              <div className="space-y-4 border-t border-ink-100 pt-4">
                <h4 className="text-sm font-semibold text-ink-900">{d.admin.chatbotGreeting}</h4>
                {(
                  [
                    ['chatbotGreetingMn', 'mn'],
                    ['chatbotGreetingEn', 'en'],
                    ['chatbotGreetingRu', 'ru'],
                  ] as [keyof PharmacySettings, Locale][]
                ).map(([key, code]) => (
                  <Field key={key} label={LOCALE_META[code].nativeLabel}>
                    <Textarea
                      rows={3}
                      value={values[key] as string}
                      onChange={(event) => set(key, event.target.value as never)}
                      disabled={!canEdit}
                    />
                  </Field>
                ))}
              </div>

              <Alert tone="warning" title={d.chatbot.disclaimer}>
                {d.admin.chatbotLlmStatus}:{' '}
                {integrations.chatbotLlm ? d.admin.chatbotLlmOn : d.admin.chatbotLlmOff}
              </Alert>
            </Card>
          ) : null}

          {tab === 'social' ? (
            <Card className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Facebook">
                  <Input
                    value={values.socialFacebook}
                    onChange={(event) => set('socialFacebook', event.target.value)}
                    disabled={!canEdit}
                    placeholder="https://facebook.com/…"
                  />
                </Field>
                <Field label="Instagram">
                  <Input
                    value={values.socialInstagram}
                    onChange={(event) => set('socialInstagram', event.target.value)}
                    disabled={!canEdit}
                    placeholder="https://instagram.com/…"
                  />
                </Field>
                <Field label="X / Twitter">
                  <Input
                    value={values.socialTwitter}
                    onChange={(event) => set('socialTwitter', event.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="YouTube">
                  <Input
                    value={values.socialYoutube}
                    onChange={(event) => set('socialYoutube', event.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
              </div>
              <p className="text-xs text-ink-400">{d.footer.social}</p>
            </Card>
          ) : null}

          {tab === 'seo' ? (
            <Card className="space-y-4">
              <Field label={d.admin.metaTitle}>
                <Input
                  value={values.seoTitle}
                  onChange={(event) => set('seoTitle', event.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label={d.admin.metaDescription}>
                <Textarea
                  rows={3}
                  value={values.seoDescription}
                  onChange={(event) => set('seoDescription', event.target.value)}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="Keywords" hint="comma separated">
                <Textarea
                  rows={2}
                  value={values.seoKeywords}
                  onChange={(event) => set('seoKeywords', event.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            </Card>
          ) : null}
        </div>

        {/* Save panel */}
        <div>
          <Card className="lg:sticky lg:top-24">
            <h3 className="text-sm font-semibold text-ink-900">{d.admin.settings}</h3>
            <p className="mt-1 text-xs text-ink-500">
              {dirty ? d.common.save : d.admin.settingsSaved}
            </p>

            {canEdit ? (
              <div className="mt-4 space-y-2">
                <Button fullWidth onClick={save} loading={saving} disabled={!dirty}>
                  <Save className="h-4 w-4" aria-hidden />
                  {d.common.save}
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setValues(initial)}
                  disabled={!dirty || saving}
                >
                  {d.common.reset}
                </Button>
              </div>
            ) : (
              <Alert tone="info" className="mt-4">
                {d.errors.forbiddenBody}
              </Alert>
            )}

            <div className="mt-4 space-y-1.5 border-t border-ink-100 pt-4 text-[11px]">
              <p className="flex justify-between gap-2">
                <span className="text-ink-400">{d.admin.deliveryFee}</span>
                <span className="font-semibold text-ink-800 tabular">{values.deliveryFee}₮</span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-ink-400">{d.admin.freeDeliveryThreshold}</span>
                <span className="font-semibold text-ink-800 tabular">
                  {values.freeDeliveryThreshold}₮
                </span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-ink-400">{d.admin.chatbotEnabled}</span>
                <span className="font-semibold text-ink-800">
                  {values.chatbotEnabled ? d.common.yes : d.common.no}
                </span>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
