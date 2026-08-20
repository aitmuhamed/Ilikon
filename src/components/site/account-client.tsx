'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, MapPin, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react'

import { Alert, Badge, Card, EmptyState } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Modal } from '@/components/ui/dialog'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field'
import { useCartCount, useI18n, useLocalePath } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { UB_DISTRICTS } from '@/lib/constants'
import { formatDateTime, normalizePhone } from '@/lib/utils'

// ─────────────────────────────── profile ──────────────────────────────────

export function ProfileForm({
  initial,
}: {
  initial: { fullName: string; phone: string; email: string | null; marketingOptIn: boolean }
}) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [form, setForm] = React.useState({
    fullName: initial.fullName,
    phone: initial.phone,
    email: initial.email ?? '',
    marketingOptIn: initial.marketingOptIn,
  })
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (form.fullName.trim().length < 2) next.fullName = d.validation.required
    if (normalizePhone(form.phone).length !== 8) next.phone = d.validation.invalidPhone
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) next.email = d.validation.invalidEmail
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    try {
      await apiFetch('/api/account', {
        method: 'PATCH',
        body: {
          fullName: form.fullName.trim(),
          phone: normalizePhone(form.phone),
          email: form.email.trim() || undefined,
          marketingOptIn: form.marketingOptIn,
          locale,
        },
      })
      toast.success(d.account.profileUpdated)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'PHONE_TAKEN') {
        setErrors({ phone: d.validation.phoneTaken })
      } else if (error instanceof ApiClientError && error.code === 'EMAIL_TAKEN') {
        setErrors({ email: d.validation.emailTaken })
      } else {
        toast.error(d.errors.generic)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-ink-900">{d.account.profile}</h2>
      <form onSubmit={submit} className="space-y-4">
        <Field label={d.checkout.fullName} required error={errors.fullName}>
          <Input
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            invalid={Boolean(errors.fullName)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={d.checkout.phone} required error={errors.phone}>
            <Input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              invalid={Boolean(errors.phone)}
              inputMode="tel"
            />
          </Field>
          <Field label={d.checkout.email} hint={d.common.optional} error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              invalid={Boolean(errors.email)}
            />
          </Field>
        </div>
        <Checkbox
          checked={form.marketingOptIn}
          onChange={(event) => setForm({ ...form, marketingOptIn: event.target.checked })}
          label={d.account.marketingOptIn}
          description={d.home.newsletterConsent}
        />
        <Button type="submit" loading={loading}>
          {d.common.save}
        </Button>
      </form>
    </Card>
  )
}

export function PasswordForm() {
  const { d } = useI18n()
  const toast = useToast()
  const [form, setForm] = React.useState({ currentPassword: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!form.currentPassword) next.currentPassword = d.validation.required
    if (form.password.length < 8 || !/[a-zа-яё]/i.test(form.password) || !/\d/.test(form.password)) {
      next.password = d.validation.passwordWeak
    }
    if (form.password !== form.confirmPassword) next.confirmPassword = d.validation.passwordMismatch
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    try {
      await apiFetch('/api/account', { method: 'PUT', body: form })
      toast.success(d.account.passwordChanged)
      setForm({ currentPassword: '', password: '', confirmPassword: '' })
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'INVALID_PASSWORD') {
        setErrors({ currentPassword: d.auth.invalidCredentials })
      } else {
        toast.error(d.errors.generic)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-ink-900">{d.account.changePassword}</h2>
      <form onSubmit={submit} className="space-y-4">
        <Field label={d.account.currentPassword} required error={errors.currentPassword}>
          <Input
            type="password"
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
            invalid={Boolean(errors.currentPassword)}
            autoComplete="current-password"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={d.account.newPassword} required error={errors.password}>
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              invalid={Boolean(errors.password)}
              autoComplete="new-password"
            />
          </Field>
          <Field label={d.account.confirmPassword} required error={errors.confirmPassword}>
            <Input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
              invalid={Boolean(errors.confirmPassword)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <Button type="submit" variant="outline" loading={loading}>
          {d.account.changePassword}
        </Button>
      </form>
    </Card>
  )
}

// ─────────────────────────────── addresses ────────────────────────────────

export interface AddressRow {
  id: string
  label: string | null
  recipient: string
  phone: string
  district: string
  khoroo: string
  addressLine: string
  instructions: string | null
  isDefault: boolean
}

export function AddressManager({ initial }: { initial: AddressRow[] }) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [addresses, setAddresses] = React.useState(initial)
  const [editing, setEditing] = React.useState<AddressRow | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<AddressRow | null>(null)
  const [saving, setSaving] = React.useState(false)

  const blank: AddressRow = {
    id: '',
    label: '',
    recipient: '',
    phone: '',
    district: '',
    khoroo: '',
    addressLine: '',
    instructions: '',
    isDefault: addresses.length === 0,
  }
  const [form, setForm] = React.useState<AddressRow>(blank)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  function open(target: AddressRow | 'new') {
    setForm(target === 'new' ? blank : target)
    setErrors({})
    setEditing(target)
  }

  async function save() {
    const next: Record<string, string> = {}
    if (form.recipient.trim().length < 2) next.recipient = d.validation.required
    if (normalizePhone(form.phone).length !== 8) next.phone = d.validation.invalidPhone
    if (!form.district) next.district = d.validation.selectOption
    if (!form.khoroo.trim()) next.khoroo = d.validation.required
    if (form.addressLine.trim().length < 4) next.addressLine = d.validation.required
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      const payload = {
        label: form.label || undefined,
        recipient: form.recipient.trim(),
        phone: normalizePhone(form.phone),
        district: form.district,
        khoroo: form.khoroo.trim(),
        addressLine: form.addressLine.trim(),
        instructions: form.instructions || undefined,
        isDefault: form.isDefault,
      }

      const result =
        editing === 'new'
          ? await apiFetch<{ address: AddressRow }>('/api/addresses', { method: 'POST', body: payload })
          : await apiFetch<{ address: AddressRow }>(`/api/addresses/${form.id}`, {
              method: 'PUT',
              body: payload,
            })

      setAddresses((current) =>
        editing === 'new'
          ? [...current.map((a) => ({ ...a, isDefault: form.isDefault ? false : a.isDefault })), result.address]
          : current.map((a) =>
              a.id === result.address.id
                ? result.address
                : { ...a, isDefault: form.isDefault ? false : a.isDefault },
            ),
      )
      toast.success(d.admin.saved)
      setEditing(null)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setSaving(false)
    }
  }

  async function remove(address: AddressRow) {
    try {
      await apiFetch(`/api/addresses/${address.id}`, { method: 'DELETE' })
      setAddresses((current) => current.filter((a) => a.id !== address.id))
      toast.success(d.admin.deleted)
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-900">{d.account.addresses}</h2>
        <Button size="sm" variant="outline" onClick={() => open('new')}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {d.account.addAddress}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title={d.account.addresses}
          body={d.checkout.addressPlaceholder}
          action={
            <Button size="sm" onClick={() => open('new')}>
              {d.account.addAddress}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-xl border border-ink-200 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900">
                      {address.label || address.recipient}
                    </span>
                    {address.isDefault ? (
                      <Badge tone="brand">{d.account.defaultAddress}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-ink-600">
                    {address.district}, {address.khoroo}, {address.addressLine}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {address.recipient} · {address.phone}
                  </p>
                  {address.instructions ? (
                    <p className="mt-1 text-xs italic text-ink-400">{address.instructions}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => open(address)}>
                    {d.common.edit}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(address)}
                    className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-red-50 hover:text-danger"
                    aria-label={d.common.delete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? d.account.addAddress : d.account.editAddress}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)} disabled={saving}>
              {d.common.cancel}
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              {d.common.save}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={d.account.addressLabel} hint={d.common.optional}>
            <Input
              value={form.label ?? ''}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder="Гэр / Ажил"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={d.account.recipient} required error={errors.recipient}>
              <Input
                value={form.recipient}
                onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                invalid={Boolean(errors.recipient)}
              />
            </Field>
            <Field label={d.checkout.phone} required error={errors.phone}>
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                invalid={Boolean(errors.phone)}
                inputMode="tel"
              />
            </Field>
            <Field label={d.checkout.district} required error={errors.district}>
              <Select
                value={form.district}
                onChange={(event) => setForm({ ...form, district: event.target.value })}
                invalid={Boolean(errors.district)}
              >
                <option value="">{d.checkout.districtPlaceholder}</option>
                {UB_DISTRICTS.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={d.checkout.khoroo} required error={errors.khoroo}>
              <Input
                value={form.khoroo}
                onChange={(event) => setForm({ ...form, khoroo: event.target.value })}
                invalid={Boolean(errors.khoroo)}
              />
            </Field>
          </div>
          <Field label={d.checkout.addressLine} required error={errors.addressLine}>
            <Input
              value={form.addressLine}
              onChange={(event) => setForm({ ...form, addressLine: event.target.value })}
              placeholder={d.checkout.addressPlaceholder}
              invalid={Boolean(errors.addressLine)}
            />
          </Field>
          <Field label={d.checkout.instructions} hint={d.common.optional}>
            <Textarea
              rows={2}
              value={form.instructions ?? ''}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              placeholder={d.checkout.instructionsPlaceholder}
            />
          </Field>
          <Checkbox
            checked={form.isDefault}
            onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
            label={d.account.setDefault}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title={d.admin.confirmDelete}
        body={deleteTarget ? `${deleteTarget.district}, ${deleteTarget.addressLine}` : undefined}
        confirmLabel={d.common.delete}
        cancelLabel={d.common.cancel}
      />
    </Card>
  )
}

// ───────────────────────────── order actions ──────────────────────────────

export function OrderActions({
  orderId,
  status,
  canCancel,
}: {
  orderId: string
  status: string
  canCancel: boolean
}) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const localePath = useLocalePath()
  const cartBadge = useCartCount()

  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function cancel() {
    if (reason.trim().length < 3) {
      toast.warning(d.validation.required)
      return
    }
    setBusy(true)
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, { method: 'POST', body: { reason: reason.trim() } })
      toast.success(d.admin.orderCancelled)
      setConfirmCancel(false)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'NOT_CANCELLABLE') {
        toast.error(d.errors.generic, d.orderStatus[status as keyof typeof d.orderStatus])
      } else {
        toast.error(d.errors.generic)
      }
    } finally {
      setBusy(false)
    }
  }

  async function reorder() {
    setBusy(true)
    try {
      const result = await apiFetch<{ added: number; skipped: string[]; cartCount: number }>(
        `/api/orders/${orderId}/reorder`,
        { method: 'POST' },
      )
      cartBadge.setCount(result.cartCount)
      if (result.added > 0) {
        toast.success(
          d.cart.added,
          result.skipped.length ? `${d.common.none}: ${result.skipped.join(', ')}` : undefined,
        )
        router.push(localePath('/cart'))
      } else {
        toast.warning(d.product.outOfStock, result.skipped.join(', '))
      }
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={reorder} loading={busy}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {d.account.reorder}
      </Button>
      {canCancel ? (
        <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmCancel(true)}>
          <XCircle className="h-3.5 w-3.5" aria-hidden />
          {d.admin.cancelOrder}
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        title={d.admin.cancelOrder}
        body={d.admin.confirmDeleteBody}
        confirmLabel={d.admin.cancelOrder}
        cancelLabel={d.common.cancel}
        loading={busy}
      >
        <Field label={d.admin.cancelReason} required>
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={d.admin.cancelReason}
          />
        </Field>
      </ConfirmDialog>
    </div>
  )
}

// ──────────────────────────── notifications ───────────────────────────────

export interface NotificationRow {
  id: string
  type: string
  title: string
  body: string
  linkUrl: string | null
  readAt: string | null
  createdAt: string
}

export function NotificationList({ initial }: { initial: NotificationRow[] }) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const [items, setItems] = React.useState(initial)
  const [busy, setBusy] = React.useState(false)

  const unread = items.filter((item) => !item.readAt).length

  async function markAll() {
    setBusy(true)
    try {
      await apiFetch('/api/notifications', { method: 'PATCH' })
      setItems((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
      )
      toast.success(d.account.markAllRead)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Bell className="h-6 w-6" />} title={d.account.noNotifications} />
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-900">
          {d.account.notifications}
          {unread > 0 ? <Badge tone="danger" className="ml-2">{unread}</Badge> : null}
        </h2>
        {unread > 0 ? (
          <Button size="sm" variant="ghost" onClick={markAll} loading={busy}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            {d.account.markAllRead}
          </Button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const typeLabel =
            d.notification[item.type as keyof typeof d.notification] ?? d.notification.SYSTEM
          const content = (
            <div
              className={
                item.readAt
                  ? 'rounded-xl border border-ink-200 p-3.5'
                  : 'rounded-xl border border-brand-200 bg-brand-50/50 p-3.5'
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.readAt ? 'neutral' : 'brand'}>{typeLabel}</Badge>
                    <span className="text-sm font-semibold text-ink-900">{item.title}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">{item.body}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-400">
                  {formatDateTime(item.createdAt, locale)}
                </span>
              </div>
            </div>
          )

          return (
            <li key={item.id}>
              {item.linkUrl ? (
                <Link
                  href={item.linkUrl.startsWith('/mn') || item.linkUrl.startsWith('/admin')
                    ? item.linkUrl
                    : `/${locale}${item.linkUrl}`}
                  className="block transition-colors hover:opacity-90"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          )
        })}
      </ul>

      <Alert tone="info" className="mt-4">
        {d.home.newsletterConsent}
      </Alert>
    </Card>
  )
}
