'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Send, ShieldOff, UserCheck } from 'lucide-react'

import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field'
import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/client-api'

/** Enable / disable a customer account. */
export function CustomerStatusToggle({
  customerId,
  status,
  name,
}: {
  customerId: string
  status: string
  name: string
}) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const disabling = status === 'ACTIVE'

  async function apply() {
    setBusy(true)
    try {
      await apiFetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        body: { status: disabling ? 'DISABLED' : 'ACTIVE' },
      })
      toast.success(disabling ? d.admin.disableAccount : d.admin.enableAccount, name)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant={disabling ? 'ghost' : 'outline'}
        className={disabling ? 'text-danger' : undefined}
        onClick={() => setOpen(true)}
      >
        {disabling ? (
          <>
            <ShieldOff className="h-3.5 w-3.5" aria-hidden />
            {d.admin.disableAccount}
          </>
        ) : (
          <>
            <UserCheck className="h-3.5 w-3.5" aria-hidden />
            {d.admin.enableAccount}
          </>
        )}
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={apply}
        title={disabling ? d.admin.disableAccount : d.admin.enableAccount}
        body={`${name} — ${disabling ? d.auth.accountDisabled : d.common.active}`}
        confirmLabel={d.common.confirm}
        cancelLabel={d.common.cancel}
        tone={disabling ? 'danger' : 'primary'}
        loading={busy}
      />
    </>
  )
}

/**
 * Notification broadcast.
 *
 * Promotional sends default to respecting marketing consent, and the recipient
 * estimate shown to staff is the consented count — so the consequence of
 * unticking that box is visible before sending, not after.
 */
export function NotificationSender({
  optedInCount,
  totalCustomers,
  staffCount,
}: {
  optedInCount: number
  totalCustomers: number
  staffCount: number
}) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [form, setForm] = React.useState({
    audience: 'CUSTOMER' as 'CUSTOMER' | 'STAFF',
    type: 'PROMOTION' as 'PROMOTION' | 'SYSTEM',
    title: '',
    body: '',
    linkUrl: '',
    respectMarketingConsent: true,
  })
  const [busy, setBusy] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const estimated =
    form.audience === 'STAFF'
      ? staffCount
      : form.type === 'PROMOTION' && form.respectMarketingConsent
        ? optedInCount
        : totalCustomers

  async function send() {
    setBusy(true)
    try {
      const result = await apiFetch<{ recipients: number }>('/api/notifications', {
        method: 'POST',
        body: {
          audience: form.audience,
          type: form.type,
          title: form.title.trim(),
          body: form.body.trim(),
          linkUrl: form.linkUrl.trim() || undefined,
          respectMarketingConsent: form.respectMarketingConsent,
        },
      })
      toast.success(d.admin.notificationSent, `${result.recipients} ${d.admin.audience}`)
      setForm({ ...form, title: '', body: '', linkUrl: '' })
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
      setConfirmOpen(false)
    }
  }

  const valid = form.title.trim().length >= 2 && form.body.trim().length >= 2

  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Megaphone className="h-4 w-4 text-brand-600" aria-hidden />
        {d.admin.sendNotification}
      </h3>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={d.admin.audience}>
            <Select
              value={form.audience}
              onChange={(event) =>
                setForm({ ...form, audience: event.target.value as 'CUSTOMER' | 'STAFF' })
              }
            >
              <option value="CUSTOMER">{d.admin.audienceCustomers}</option>
              <option value="STAFF">{d.admin.audienceStaff}</option>
            </Select>
          </Field>
          <Field label={d.common.status}>
            <Select
              value={form.type}
              onChange={(event) =>
                setForm({ ...form, type: event.target.value as 'PROMOTION' | 'SYSTEM' })
              }
            >
              <option value="PROMOTION">{d.notification.PROMOTION}</option>
              <option value="SYSTEM">{d.notification.SYSTEM}</option>
            </Select>
          </Field>
        </div>

        <Field label={d.admin.notificationTitle} required>
          <Input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            maxLength={160}
          />
        </Field>

        <Field label={d.admin.notificationBody} required>
          <Textarea
            rows={4}
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
            maxLength={1000}
          />
        </Field>

        <Field label={d.admin.linkUrl} hint={d.common.optional}>
          <Input
            value={form.linkUrl}
            onChange={(event) => setForm({ ...form, linkUrl: event.target.value })}
            placeholder="/mn/categories/vitamin"
          />
        </Field>

        {form.audience === 'CUSTOMER' && form.type === 'PROMOTION' ? (
          <>
            <Checkbox
              checked={form.respectMarketingConsent}
              onChange={(event) =>
                setForm({ ...form, respectMarketingConsent: event.target.checked })
              }
              label={d.account.marketingOptIn}
              description={d.admin.marketingConsentNote}
            />
            {!form.respectMarketingConsent ? (
              <Alert tone="danger" title={d.admin.marketingConsentNote}>
                {d.home.newsletterConsent}
              </Alert>
            ) : null}
          </>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
          <span className="text-sm text-ink-600">
            {d.admin.audience}:{' '}
            <strong className="text-ink-900 tabular">{estimated}</strong>
            {form.audience === 'CUSTOMER' && form.type === 'PROMOTION' ? (
              <Badge tone={form.respectMarketingConsent ? 'success' : 'danger'} className="ml-2">
                {form.respectMarketingConsent ? d.account.marketingOptIn : d.common.all}
              </Badge>
            ) : null}
          </span>
          <Button onClick={() => setConfirmOpen(true)} disabled={!valid || busy}>
            <Send className="h-4 w-4" aria-hidden />
            {d.admin.sendNotification}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={send}
        title={d.admin.sendNotification}
        body={`${estimated} ${d.admin.audience} · ${form.title}`}
        confirmLabel={d.admin.sendNotification}
        cancelLabel={d.common.cancel}
        tone="primary"
        loading={busy}
      />
    </Card>
  )
}
