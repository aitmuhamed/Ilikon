'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react'

import { Alert, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input } from '@/components/ui/field'
import { useI18n, useLocalePath } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { interpolate } from '@/i18n'
import { normalizePhone } from '@/lib/utils'

/** Maps server validation codes onto the visitor's language. */
function useErrorText() {
  const { d } = useI18n()
  return React.useCallback(
    (code: string, fallback?: string) => {
      const map: Record<string, string> = {
        INVALID_PHONE: d.validation.invalidPhone,
        INVALID_EMAIL: d.validation.invalidEmail,
        PASSWORD_TOO_SHORT: interpolate(d.validation.minLength, { min: 8 }),
        PASSWORD_WEAK: d.validation.passwordWeak,
        PASSWORD_MISMATCH: d.validation.passwordMismatch,
        AGREE_REQUIRED: d.validation.agreeRequired,
        PHONE_TAKEN: d.validation.phoneTaken,
        EMAIL_TAKEN: d.validation.emailTaken,
        INVALID_CREDENTIALS: d.auth.invalidCredentials,
        ACCOUNT_DISABLED: d.auth.accountDisabled,
        RATE_LIMITED: d.errors.tooManyRequests,
        VALIDATION_FAILED: d.errors.validationFailed,
        INVALID_TOKEN: d.errors.generic,
        NETWORK_ERROR: d.errors.network,
      }
      return map[code] ?? fallback ?? d.errors.generic
    },
    [d],
  )
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        leading={<Lock className="h-4 w-4" />}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition-colors hover:text-ink-700"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const { d } = useI18n()
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink-900">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>
      </div>
      <Card>{children}</Card>
      {footer ? <div className="mt-5 text-center text-sm text-ink-500">{footer}</div> : null}
      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-400">
        {d.prescription.privacyNotice}
      </p>
    </div>
  )
}

// ─────────────────────────────── login ────────────────────────────────────

export function LoginForm() {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()
  const errorText = useErrorText()

  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const redirectTo = params.get('next')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await apiFetch<{ user: { fullName: string; isStaff: boolean } }>('/api/auth/login', {
        method: 'POST',
        body: { identifier: identifier.trim(), password },
      })
      toast.success(d.auth.loginSuccess, data.user.fullName)
      // Staff land in the admin dashboard, customers on their account.
      const destination =
        redirectTo ?? (data.user.isStaff ? '/admin' : localePath('/account'))
      window.location.href = destination
    } catch (caught) {
      const code = caught instanceof ApiClientError ? caught.code : 'NETWORK_ERROR'
      setError(errorText(code))
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={d.auth.loginTitle}
      subtitle={d.auth.loginSubtitle}
      footer={
        <>
          {d.auth.noAccount}{' '}
          <Link href={localePath('/register')} className="font-semibold text-brand-700 hover:underline">
            {d.auth.registerSubmit}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Field label={d.auth.identifier} required>
          <Input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="99112233 / name@example.com"
            leading={<User className="h-4 w-4" />}
            autoComplete="username"
            required
          />
        </Field>

        <Field label={d.auth.password} required>
          <PasswordInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={d.auth.passwordPlaceholder}
            autoComplete="current-password"
            required
          />
        </Field>

        <div className="flex items-center justify-between">
          <Link
            href={localePath('/forgot-password')}
            className="text-sm text-brand-700 hover:underline"
          >
            {d.auth.forgotPassword}
          </Link>
        </div>

        <Button type="submit" fullWidth size="lg" loading={loading}>
          {d.auth.loginSubmit}
        </Button>
      </form>
    </AuthShell>
  )
}

// ───────────────────────────── register ───────────────────────────────────

export function RegisterForm() {
  const { d, locale } = useI18n()
  const localePath = useLocalePath()
  const toast = useToast()
  const errorText = useErrorText()

  const [form, setForm] = React.useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    marketingOptIn: false,
    agreeTerms: false,
  })
  const [loading, setLoading] = React.useState(false)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[key as string]
      return next
    })
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (form.fullName.trim().length < 2) next.fullName = d.validation.required
    if (normalizePhone(form.phone).length !== 8) next.phone = d.validation.invalidPhone
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      next.email = d.validation.invalidEmail
    }
    if (form.password.length < 8) next.password = interpolate(d.validation.minLength, { min: 8 })
    else if (!/[a-zа-яё]/i.test(form.password) || !/\d/.test(form.password)) {
      next.password = d.validation.passwordWeak
    }
    if (form.password !== form.confirmPassword) next.confirmPassword = d.validation.passwordMismatch
    if (!form.agreeTerms) next.agreeTerms = d.validation.agreeRequired
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!validate()) return

    setLoading(true)
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: form.fullName.trim(),
          phone: normalizePhone(form.phone),
          email: form.email.trim() || undefined,
          password: form.password,
          confirmPassword: form.confirmPassword,
          locale,
          marketingOptIn: form.marketingOptIn,
          agreeTerms: true,
        },
      })
      toast.success(d.auth.registerSuccess)
      window.location.href = localePath('/account')
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        if (caught.code === 'PHONE_TAKEN') setFieldErrors({ phone: d.validation.phoneTaken })
        else if (caught.code === 'EMAIL_TAKEN') setFieldErrors({ email: d.validation.emailTaken })
        else if (caught.code === 'VALIDATION_FAILED') {
          const details = (caught.details ?? []) as { path: string; message: string }[]
          const mapped: Record<string, string> = {}
          for (const issue of details) mapped[issue.path] = errorText(issue.message)
          setFieldErrors(mapped)
          setError(d.errors.validationFailed)
        } else setError(errorText(caught.code, caught.message))
      } else {
        setError(d.errors.network)
      }
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={d.auth.registerTitle}
      subtitle={d.auth.registerSubtitle}
      footer={
        <>
          {d.auth.hasAccount}{' '}
          <Link href={localePath('/login')} className="font-semibold text-brand-700 hover:underline">
            {d.auth.loginSubmit}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Field label={d.checkout.fullName} required error={fieldErrors.fullName}>
          <Input
            value={form.fullName}
            onChange={(event) => set('fullName', event.target.value)}
            placeholder={d.checkout.fullNamePlaceholder}
            leading={<User className="h-4 w-4" />}
            invalid={Boolean(fieldErrors.fullName)}
            autoComplete="name"
          />
        </Field>

        <Field label={d.checkout.phone} required error={fieldErrors.phone}>
          <Input
            value={form.phone}
            onChange={(event) => set('phone', event.target.value)}
            placeholder={d.checkout.phonePlaceholder}
            leading={<Phone className="h-4 w-4" />}
            invalid={Boolean(fieldErrors.phone)}
            inputMode="tel"
            autoComplete="tel"
            maxLength={12}
          />
        </Field>

        <Field
          label={d.checkout.email}
          hint={d.common.optional}
          error={fieldErrors.email}
        >
          <Input
            type="email"
            value={form.email}
            onChange={(event) => set('email', event.target.value)}
            placeholder={d.checkout.emailPlaceholder}
            leading={<Mail className="h-4 w-4" />}
            invalid={Boolean(fieldErrors.email)}
            autoComplete="email"
          />
        </Field>

        <Field label={d.auth.password} required error={fieldErrors.password}>
          <PasswordInput
            value={form.password}
            onChange={(event) => set('password', event.target.value)}
            placeholder={d.auth.passwordPlaceholder}
            invalid={Boolean(fieldErrors.password)}
            autoComplete="new-password"
          />
        </Field>

        <Field label={d.auth.confirmPassword} required error={fieldErrors.confirmPassword}>
          <PasswordInput
            value={form.confirmPassword}
            onChange={(event) => set('confirmPassword', event.target.value)}
            invalid={Boolean(fieldErrors.confirmPassword)}
            autoComplete="new-password"
          />
        </Field>

        <div className="space-y-2.5 border-t border-ink-100 pt-4">
          <Checkbox
            checked={form.marketingOptIn}
            onChange={(event) => set('marketingOptIn', event.target.checked)}
            label={d.account.marketingOptIn}
            description={d.home.newsletterConsent}
          />
          <div>
            <Checkbox
              checked={form.agreeTerms}
              onChange={(event) => set('agreeTerms', event.target.checked)}
              label={
                <span>
                  {d.auth.agreeTerms}{' '}
                  <Link href={localePath('/terms')} className="text-brand-700 underline">
                    {d.footer.terms}
                  </Link>
                </span>
              }
            />
            {fieldErrors.agreeTerms ? (
              <p className="error-text" role="alert">
                {fieldErrors.agreeTerms}
              </p>
            ) : null}
          </div>
        </div>

        <Button type="submit" fullWidth size="lg" loading={loading}>
          {d.auth.registerSubmit}
        </Button>
      </form>
    </AuthShell>
  )
}

// ───────────────────────── forgot / reset password ────────────────────────

export function ForgotPasswordForm() {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const errorText = useErrorText()

  const [identifier, setIdentifier] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [devToken, setDevToken] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await apiFetch<{ sent: boolean; devToken?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { identifier: identifier.trim() },
      })
      setSent(true)
      if (data.devToken) setDevToken(data.devToken)
    } catch (caught) {
      setError(errorText(caught instanceof ApiClientError ? caught.code : 'NETWORK_ERROR'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={d.auth.forgotTitle}
      subtitle={d.auth.forgotSubtitle}
      footer={
        <Link href={localePath('/login')} className="font-semibold text-brand-700 hover:underline">
          ← {d.auth.loginSubmit}
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <Alert tone="success">{d.auth.forgotSent}</Alert>
          {devToken ? (
            <Alert tone="info" title="Development only">
              <p className="mb-2 text-xs">
                Email/SMS delivery is a deployment concern, so the token is shown here outside
                production:
              </p>
              <Link
                href={`${localePath('/reset-password')}?token=${encodeURIComponent(devToken)}`}
                className="break-all text-xs font-semibold underline"
              >
                {d.auth.resetTitle} →
              </Link>
            </Alert>
          ) : null}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={d.auth.identifier} required>
            <Input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="99112233 / name@example.com"
              leading={<User className="h-4 w-4" />}
              required
            />
          </Field>
          <Button type="submit" fullWidth size="lg" loading={loading}>
            {d.auth.forgotSubmit}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPasswordForm() {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const params = useSearchParams()
  const toast = useToast()
  const errorText = useErrorText()

  const token = params.get('token') ?? ''
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const next: Record<string, string> = {}
    if (password.length < 8) next.password = interpolate(d.validation.minLength, { min: 8 })
    else if (!/[a-zа-яё]/i.test(password) || !/\d/.test(password)) {
      next.password = d.validation.passwordWeak
    }
    if (password !== confirmPassword) next.confirmPassword = d.validation.passwordMismatch
    setFieldErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password, confirmPassword },
      })
      toast.success(d.auth.resetSuccess)
      window.location.href = localePath('/login')
    } catch (caught) {
      setError(errorText(caught instanceof ApiClientError ? caught.code : 'NETWORK_ERROR'))
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={d.auth.resetTitle}
      subtitle={d.auth.forgotSubtitle}
      footer={
        <Link href={localePath('/login')} className="font-semibold text-brand-700 hover:underline">
          ← {d.auth.loginSubmit}
        </Link>
      }
    >
      {!token ? (
        <Alert tone="danger">{d.errors.generic}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Field label={d.account.newPassword} required error={fieldErrors.password}>
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={d.auth.passwordPlaceholder}
              invalid={Boolean(fieldErrors.password)}
              autoComplete="new-password"
            />
          </Field>

          <Field label={d.account.confirmPassword} required error={fieldErrors.confirmPassword}>
            <PasswordInput
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              invalid={Boolean(fieldErrors.confirmPassword)}
              autoComplete="new-password"
            />
          </Field>

          <Button type="submit" fullWidth size="lg" loading={loading}>
            {d.auth.resetSubmit}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
