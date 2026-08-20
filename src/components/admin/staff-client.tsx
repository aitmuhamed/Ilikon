'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Pencil, Plus, ShieldCheck, UserMinus, Users } from 'lucide-react'

import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Modal } from '@/components/ui/dialog'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field'
import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { formatDateTime, normalizePhone } from '@/lib/utils'

export interface StaffRow {
  id: string
  fullName: string
  phone: string
  email: string | null
  status: string
  jobTitle: string | null
  licenseNumber: string | null
  /** Loaded so an edit round-trips it instead of blanking it. */
  notes: string | null
  lastLoginAt: string | null
  createdAt: string
  role: { id: string; key: string; name: string; nameMn: string } | null
  reviewCount: number
  deliveryCount: number
}

export interface RoleRow {
  id: string
  key: string
  name: string
  nameMn: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissionKeys: string[]
}

export interface PermissionMeta {
  key: string
  group: string
  label: string
  labelMn: string
  description?: string
}

/**
 * Same rule as `passwordSchema` in `lib/validation.ts`. Kept in sync by hand
 * because that module is server-validated Zod; if the rule changes there, it
 * has to change here too or the form will submit passwords the API rejects.
 */
function isStrongEnough(password: string): boolean {
  return password.length >= 8 && /[a-zа-яё]/i.test(password) && /\d/.test(password)
}

/**
 * Field-level errors returned by the API's Zod layer as `VALIDATION_FAILED`.
 *
 * The API reports machine codes (`PASSWORD_WEAK`, `INVALID_PHONE`), so they are
 * translated here — showing the raw code to a pharmacist is not an error
 * message.
 */
function fieldErrorsFrom(
  details: unknown,
  translate: (code: string) => string,
): Record<string, string> {
  if (!Array.isArray(details)) return {}
  const errors: Record<string, string> = {}
  for (const issue of details) {
    if (typeof issue !== 'object' || issue === null) continue
    const record = issue as { path?: unknown; message?: unknown }
    if (typeof record.path === 'string' && typeof record.message === 'string') {
      // Only the leaf field name; nested paths are not rendered as fields.
      errors[record.path.split('.')[0]!] = translate(record.message)
    }
  }
  return errors
}

/** Staff directory with create / edit / deactivate. */
export function StaffManager({
  staff,
  roles,
  canManage,
  currentUserId,
}: {
  staff: StaffRow[]
  roles: RoleRow[]
  canManage: boolean
  currentUserId: string
}) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [form, setForm] = React.useState<
    | {
        id: string | null
        fullName: string
        phone: string
        email: string
        password: string
        roleId: string
        jobTitle: string
        licenseNumber: string
        status: 'ACTIVE' | 'DISABLED' | 'PENDING'
        notes: string
      }
    | null
  >(null)
  const [deactivateTarget, setDeactivateTarget] = React.useState<StaffRow | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  function open(row?: StaffRow) {
    setErrors({})
    setForm(
      row
        ? {
            id: row.id,
            fullName: row.fullName,
            phone: row.phone,
            email: row.email ?? '',
            password: '',
            roleId: row.role?.id ?? '',
            jobTitle: row.jobTitle ?? '',
            licenseNumber: row.licenseNumber ?? '',
            status: row.status as 'ACTIVE' | 'DISABLED' | 'PENDING',
            notes: row.notes ?? '',
          }
        : {
            id: null,
            fullName: '',
            phone: '',
            email: '',
            password: '',
            roleId: roles.find((role) => role.key === 'order_manager')?.id ?? roles[0]?.id ?? '',
            jobTitle: '',
            licenseNumber: '',
            status: 'ACTIVE',
            notes: '',
          },
    )
  }

  const selectedRole = roles.find((role) => role.id === form?.roleId)
  const needsLicence = selectedRole?.key === 'pharmacist'

  async function save() {
    if (!form) return
    const next: Record<string, string> = {}
    if (form.fullName.trim().length < 2) next.fullName = d.validation.required
    if (normalizePhone(form.phone).length !== 8) next.phone = d.validation.invalidPhone
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) next.email = d.validation.invalidEmail
    // Must mirror `passwordSchema` on the server exactly: at least 8
    // characters, containing a letter and a digit. Checking only the length
    // here let the form submit a password the API then rejected with a 422,
    // which surfaced as a vague toast and looked like a broken form.
    const passwordRequired = !form.id
    if (passwordRequired || form.password.length > 0) {
      if (!isStrongEnough(form.password)) next.password = d.validation.passwordWeak
    }
    if (!form.roleId) next.roleId = d.validation.selectOption
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: normalizePhone(form.phone),
        email: form.email.trim() || undefined,
        password: form.password || undefined,
        roleId: form.roleId,
        jobTitle: form.jobTitle.trim() || undefined,
        licenseNumber: form.licenseNumber.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      }

      if (form.id) {
        await apiFetch(`/api/staff/${form.id}`, { method: 'PUT', body: payload })
        toast.success(d.admin.saved)
      } else {
        await apiFetch('/api/staff', { method: 'POST', body: payload })
        toast.success(d.admin.created)
      }
      setForm(null)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError) {
        const map: Record<string, string> = {
          PHONE_TAKEN: d.validation.phoneTaken,
          EMAIL_TAKEN: d.validation.emailTaken,
          LAST_SUPER_ADMIN: d.errors.forbiddenBody,
          PASSWORD_REQUIRED: d.validation.required,
          INVALID_ROLE: d.validation.selectOption,
        }

        // Put the API's own field errors back on the fields. Without this a
        // rejected value only produced a generic toast, so there was no way to
        // tell *which* field the server objected to.
        if (error.code === 'VALIDATION_FAILED') {
          const codes: Record<string, string> = {
            PASSWORD_WEAK: d.validation.passwordWeak,
            PASSWORD_TOO_SHORT: d.validation.passwordWeak,
            INVALID_PHONE: d.validation.invalidPhone,
            INVALID_EMAIL: d.validation.invalidEmail,
          }
          const fieldErrors = fieldErrorsFrom(
            error.details,
            (code) => codes[code] ?? d.validation.required,
          )
          if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors)
        } else if (error.code === 'PHONE_TAKEN') {
          setErrors({ phone: d.validation.phoneTaken })
        } else if (error.code === 'EMAIL_TAKEN') {
          setErrors({ email: d.validation.emailTaken })
        }

        toast.error(map[error.code] ?? d.errors.generic, error.message)
      } else {
        toast.error(d.errors.network)
      }
    } finally {
      setBusy(false)
    }
  }

  async function deactivate(row: StaffRow) {
    setBusy(true)
    try {
      await apiFetch(`/api/staff/${row.id}`, { method: 'DELETE' })
      toast.success(d.admin.disableAccount)
      router.refresh()
    } catch (error) {
      toast.error(
        d.errors.generic,
        error instanceof ApiClientError && error.code === 'LAST_SUPER_ADMIN'
          ? d.errors.forbiddenBody
          : undefined,
      )
    } finally {
      setBusy(false)
      setDeactivateTarget(null)
    }
  }

  return (
    <>
      {canManage ? (
        <div className="mb-4">
          <Button size="sm" onClick={() => open()}>
            <Plus className="h-4 w-4" aria-hidden />
            {d.admin.newStaff}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {staff.map((member) => (
          <Card key={member.id}>
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {member.fullName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-ink-900">
                    {member.fullName}
                  </span>
                  {member.id === currentUserId ? <Badge tone="brand">{d.admin.signedInAs}</Badge> : null}
                  <Badge tone={member.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {member.status === 'ACTIVE' ? d.common.active : d.common.disabled}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {member.jobTitle ?? member.role?.nameMn ?? '—'}
                </p>
                <p className="mt-1 text-xs text-ink-400 tabular">
                  {member.phone}
                  {member.email ? ` · ${member.email}` : ''}
                </p>
                {member.licenseNumber ? (
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {d.admin.licenseNumber}: <span className="tabular">{member.licenseNumber}</span>
                  </p>
                ) : null}
              </div>
              <Badge tone="accent" className="shrink-0">
                {member.role?.nameMn ?? '—'}
              </Badge>
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-[11px]">
              <div>
                <dt className="text-ink-400">{d.admin.prescriptions}</dt>
                <dd className="font-semibold text-ink-800 tabular">{member.reviewCount}</dd>
              </div>
              <div>
                <dt className="text-ink-400">{d.admin.delivery}</dt>
                <dd className="font-semibold text-ink-800 tabular">{member.deliveryCount}</dd>
              </div>
              <div>
                <dt className="text-ink-400">{d.auth.loginSubmit}</dt>
                <dd className="font-semibold text-ink-800">
                  {member.lastLoginAt ? formatDateTime(member.lastLoginAt, locale).slice(0, 10) : '—'}
                </dd>
              </div>
            </dl>

            {canManage ? (
              <div className="mt-3 flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => open(member)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  {d.common.edit}
                </Button>
                {member.id !== currentUserId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setDeactivateTarget(member)}
                  >
                    <UserMinus className="h-3.5 w-3.5" aria-hidden />
                    {d.admin.disableAccount}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? d.admin.editStaff : d.admin.newStaff}
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setForm(null)} disabled={busy}>
              {d.common.cancel}
            </Button>
            <Button size="sm" onClick={save} loading={busy}>
              {d.common.save}
            </Button>
          </>
        }
      >
        {form ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={d.checkout.fullName} required error={errors.fullName}>
                <Input
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  invalid={Boolean(errors.fullName)}
                />
              </Field>
              <Field label={d.admin.role} required error={errors.roleId}>
                <Select
                  value={form.roleId}
                  onChange={(event) => setForm({ ...form, roleId: event.target.value })}
                  invalid={Boolean(errors.roleId)}
                >
                  <option value="">{d.validation.selectOption}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.nameMn} ({role.name})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={d.checkout.phone} required error={errors.phone}>
                <Input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  invalid={Boolean(errors.phone)}
                  inputMode="tel"
                  className="tabular"
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
              <Field label={d.admin.jobTitle} hint={d.common.optional}>
                <Input
                  value={form.jobTitle}
                  onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
                />
              </Field>
              <Field
                label={d.admin.licenseNumber}
                hint={needsLicence ? d.common.required : d.common.optional}
              >
                <Input
                  value={form.licenseNumber}
                  onChange={(event) => setForm({ ...form, licenseNumber: event.target.value })}
                  placeholder="ФА-2020/0000"
                  className="tabular"
                />
              </Field>
              <Field
                label={form.id ? d.account.newPassword : d.auth.password}
                required={!form.id}
                hint={form.id ? `${d.common.optional} — ${d.validation.passwordWeak}` : d.validation.passwordWeak}
                error={errors.password}
              >
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  invalid={Boolean(errors.password)}
                  autoComplete="new-password"
                />
              </Field>
              <Field label={d.admin.statusLabel}>
                <Select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as 'ACTIVE' | 'DISABLED' | 'PENDING' })
                  }
                >
                  <option value="ACTIVE">{d.common.active}</option>
                  <option value="DISABLED">{d.common.disabled}</option>
                  <option value="PENDING">PENDING</option>
                </Select>
              </Field>
            </div>

            {needsLicence ? (
              <Alert tone="warning" title={d.admin.verifyOnlyPharmacist}>
                {d.prescription.safetyNotice}
              </Alert>
            ) : null}

            {selectedRole ? (
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="text-xs font-semibold text-ink-800">{selectedRole.nameMn}</p>
                <p className="mt-0.5 text-xs text-ink-600">{selectedRole.description}</p>
                <p className="mt-1 text-[11px] text-ink-400 tabular">
                  {selectedRole.permissionKeys.length} {d.admin.permissionsCount}
                </p>
              </div>
            ) : null}

            <Field label={d.admin.internalNotes} hint={d.common.optional}>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </Field>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && deactivate(deactivateTarget)}
        title={d.admin.disableAccount}
        body={`${deactivateTarget?.fullName ?? ''} — ${d.admin.confirmDeleteBody}`}
        confirmLabel={d.admin.disableAccount}
        cancelLabel={d.common.cancel}
        loading={busy}
      />
    </>
  )
}

/**
 * Role permission editor.
 *
 * Super admin is intentionally read-only: it always holds every permission,
 * including ones added by a later release, which is what stops the system from
 * being locked out of itself.
 */
export function RolePermissionEditor({
  roles,
  permissions,
  canEdit,
}: {
  roles: RoleRow[]
  permissions: PermissionMeta[]
  canEdit: boolean
}) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [selectedRoleId, setSelectedRoleId] = React.useState(
    roles.find((role) => role.key !== 'super_admin' && role.key !== 'customer')?.id ?? roles[0]?.id ?? '',
  )
  const [granted, setGranted] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)

  const role = roles.find((item) => item.id === selectedRoleId)
  const immutable = role?.key === 'super_admin' || role?.key === 'customer'

  React.useEffect(() => {
    setGranted(new Set(role?.permissionKeys ?? []))
  }, [role])

  const groups = React.useMemo(() => {
    const map = new Map<string, PermissionMeta[]>()
    for (const permission of permissions) {
      map.set(permission.group, [...(map.get(permission.group) ?? []), permission])
    }
    return [...map.entries()]
  }, [permissions])

  function toggle(key: string) {
    setGranted((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleGroup(groupPermissions: PermissionMeta[]) {
    const allOn = groupPermissions.every((permission) => granted.has(permission.key))
    setGranted((current) => {
      const next = new Set(current)
      for (const permission of groupPermissions) {
        if (allOn) next.delete(permission.key)
        else next.add(permission.key)
      }
      return next
    })
  }

  async function save() {
    if (!role) return
    setBusy(true)
    try {
      await apiFetch(`/api/roles/${role.id}`, {
        method: 'PATCH',
        body: { permissionKeys: [...granted] },
      })
      toast.success(d.admin.permissionsSaved, role.nameMn)
      router.refresh()
    } catch (error) {
      toast.error(
        d.errors.generic,
        error instanceof ApiClientError && error.code === 'IMMUTABLE_ROLE' ? error.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  const dirty =
    role &&
    (granted.size !== role.permissionKeys.length ||
      role.permissionKeys.some((key) => !granted.has(key)))

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Role list */}
      <div className="space-y-2">
        {roles.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedRoleId(item.id)}
            className={
              item.id === selectedRoleId
                ? 'w-full rounded-xl border border-brand-500 bg-brand-50 p-3 text-left'
                : 'w-full rounded-xl border border-ink-200 bg-white p-3 text-left transition-colors hover:border-brand-300'
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-ink-900">{item.nameMn}</span>
              {item.isSystem ? <Badge tone="neutral">{d.admin.systemRole}</Badge> : null}
            </div>
            <p className="mt-0.5 text-[11px] text-ink-500">{item.name}</p>
            <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-400 tabular">
              <Users className="h-3 w-3" aria-hidden />
              {item.userCount}
              <KeyRound className="ml-1 h-3 w-3" aria-hidden />
              {item.permissionKeys.length}
            </p>
          </button>
        ))}
      </div>

      {/* Permission matrix */}
      <div>
        {role ? (
          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-4">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                  <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden />
                  {role.nameMn}
                </h3>
                <p className="mt-0.5 text-xs text-ink-500">{role.description}</p>
                <p className="mt-1 text-xs text-ink-400 tabular">
                  {granted.size} / {permissions.length} {d.admin.permissionsCount}
                </p>
              </div>
              {canEdit && !immutable ? (
                <Button size="sm" onClick={save} loading={busy} disabled={!dirty}>
                  {d.admin.savePermissions}
                </Button>
              ) : null}
            </div>

            {immutable ? (
              <Alert tone="info" className="mb-4">
                {role.key === 'super_admin'
                  ? `${d.admin.systemRole} — ${permissions.length} ${d.admin.permissionsCount}`
                  : d.admin.role}
              </Alert>
            ) : null}

            <div className="space-y-5">
              {groups.map(([group, groupPermissions]) => {
                const activeCount = groupPermissions.filter((permission) =>
                  granted.has(permission.key),
                ).length
                return (
                  <div key={group}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                        {group}
                        <span className="ml-2 text-ink-400 tabular">
                          {activeCount}/{groupPermissions.length}
                        </span>
                      </h4>
                      {canEdit && !immutable ? (
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupPermissions)}
                          className="text-[11px] font-medium text-brand-700 hover:underline"
                        >
                          {activeCount === groupPermissions.length ? d.common.clear : d.common.all}
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {groupPermissions.map((permission) => (
                        <div
                          key={permission.key}
                          className={
                            granted.has(permission.key)
                              ? 'rounded-lg border border-brand-200 bg-brand-50/50 p-2.5'
                              : 'rounded-lg border border-ink-200 p-2.5'
                          }
                        >
                          <Checkbox
                            checked={granted.has(permission.key)}
                            disabled={!canEdit || immutable}
                            onChange={() => toggle(permission.key)}
                            label={
                              <span className="text-xs font-medium">
                                {locale === 'mn' ? permission.labelMn : permission.label}
                              </span>
                            }
                            description={permission.description ?? permission.key}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
