'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, FileText, Lock, ShieldCheck, Upload, X } from 'lucide-react'

import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { useI18n, useLocalePath } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { PRESCRIPTION_MAX_MB } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface OrderOption {
  id: string
  orderNumber: string
  requiresPrescription: boolean
}

/**
 * Prescription upload.
 *
 * The client validates size and type for a fast, clear error, but the server
 * re-checks by sniffing the file's magic bytes — a renamed `.exe` never lands in
 * storage. The result is always PENDING: nothing here can approve a
 * prescription, only a pharmacist can.
 */
export function PrescriptionUploadForm({ orders }: { orders: OrderOption[] }) {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const params = useSearchParams()
  const router = useRouter()
  const toast = useToast()

  const preselected = params.get('orderId') ?? ''

  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState<{ code: string } | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const inputRef = React.useRef<HTMLInputElement>(null)

  const [meta, setMeta] = React.useState({
    orderId: preselected,
    patientName: '',
    doctorName: '',
    clinic: '',
    issuedAt: '',
    expiresAt: '',
    customerNote: '',
  })

  React.useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

  function accept(candidate: File | null | undefined) {
    if (!candidate) return
    if (!ACCEPTED.includes(candidate.type)) {
      setErrors({ file: d.validation.fileTypeInvalid })
      return
    }
    if (candidate.size > PRESCRIPTION_MAX_MB * 1024 * 1024) {
      setErrors({ file: d.validation.fileTooLarge })
      return
    }
    setErrors({})
    setFile(candidate)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!file) {
      setErrors({ file: d.validation.required })
      return
    }

    setSubmitting(true)
    try {
      const body = new FormData()
      body.append('file', file)
      for (const [key, value] of Object.entries(meta)) {
        if (value) body.append(key, value)
      }

      const result = await apiFetch<{ prescription: { code: string } }>('/api/prescriptions', {
        method: 'POST',
        formData: body,
      })

      setDone({ code: result.prescription.code })
      toast.success(d.prescription.submitted)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError) {
        const map: Record<string, string> = {
          FILE_TOO_LARGE: d.validation.fileTooLarge,
          FILE_TYPE_INVALID: d.validation.fileTypeInvalid,
          EMPTY_FILE: d.validation.required,
          FILE_REQUIRED: d.validation.required,
          RATE_LIMITED: d.errors.tooManyRequests,
          UNAUTHORIZED: d.errors.unauthorized,
        }
        toast.error(map[error.code] ?? d.errors.generic)
        if (error.code === 'UNAUTHORIZED') {
          window.location.href = localePath('/login')
          return
        }
      } else {
        toast.error(d.errors.network)
      }
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Card>
        <div className="py-6 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-bold text-ink-900">{d.prescription.submitted}</h2>
          <div className="mt-4 inline-flex flex-col items-center rounded-xl border border-brand-200 bg-brand-50 px-5 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-brand-700">
              {d.prescription.code}
            </span>
            <span className="text-lg font-extrabold text-brand-900 tabular">{done.code}</span>
          </div>
          <div className="mx-auto mt-5 max-w-md">
            <Alert tone="warning">{d.prescription.safetyNotice}</Alert>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href={localePath('/account/prescriptions')}>
              <Button>{d.prescription.myPrescriptions}</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setDone(null)
                setFile(null)
                setMeta({ ...meta, patientName: '', doctorName: '', clinic: '', customerNote: '' })
              }}
            >
              {d.prescription.uploadTitle}
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Safety + privacy notices are shown before the form, not after. */}
      <Alert tone="warning" title={d.prescription.safetyNotice} />

      <Card>
        <h2 className="mb-1 text-base font-semibold text-ink-900">{d.prescription.uploadTitle}</h2>
        <p className="mb-4 text-sm text-ink-500">{d.prescription.uploadSubtitle}</p>

        {/* Dropzone */}
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            accept(event.dataTransfer.files?.[0])
          }}
          className={cn(
            'relative rounded-xl border-2 border-dashed p-6 text-center transition-colors',
            dragging
              ? 'border-brand-500 bg-brand-50'
              : errors.file
                ? 'border-danger bg-red-50/40'
                : 'border-ink-300 bg-ink-50/40 hover:border-brand-400',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={(event) => accept(event.target.files?.[0])}
            className="sr-only"
            id="prescription-file"
          />

          {file ? (
            <div className="flex flex-col items-center gap-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="max-h-56 rounded-lg border border-ink-200 object-contain"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                  <FileText className="h-8 w-8" aria-hidden />
                </span>
              )}
              <div className="text-center">
                <p className="max-w-xs truncate text-sm font-medium text-ink-900">{file.name}</p>
                <p className="text-xs text-ink-500 tabular">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                  {d.common.edit}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setFile(null)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  {d.common.delete}
                </Button>
              </div>
            </div>
          ) : (
            <label htmlFor="prescription-file" className="block cursor-pointer">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Upload className="h-6 w-6" aria-hidden />
              </span>
              <span className="mt-3 block text-sm font-medium text-ink-800">
                {d.prescription.dropzone}
              </span>
              <span className="mt-1 block text-xs text-ink-500">{d.prescription.dropzoneHint}</span>
            </label>
          )}
        </div>
        {errors.file ? (
          <p className="error-text" role="alert">
            {errors.file}
          </p>
        ) : null}

        {/* Metadata */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {orders.length > 0 ? (
            <Field label={d.prescription.attachToOrder} className="sm:col-span-2">
              <Select
                value={meta.orderId}
                onChange={(event) => setMeta({ ...meta, orderId: event.target.value })}
              >
                <option value="">{d.prescription.noOrder}</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber}
                    {order.requiresPrescription ? ` — ${d.prescription.requiredForOrder}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label={d.prescription.patientName} hint={d.common.optional}>
            <Input
              value={meta.patientName}
              onChange={(event) => setMeta({ ...meta, patientName: event.target.value })}
            />
          </Field>
          <Field label={d.prescription.doctorName} hint={d.common.optional}>
            <Input
              value={meta.doctorName}
              onChange={(event) => setMeta({ ...meta, doctorName: event.target.value })}
            />
          </Field>
          <Field label={d.prescription.clinic} hint={d.common.optional}>
            <Input
              value={meta.clinic}
              onChange={(event) => setMeta({ ...meta, clinic: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={d.prescription.issuedAt} hint={d.common.optional}>
              <Input
                type="date"
                value={meta.issuedAt}
                onChange={(event) => setMeta({ ...meta, issuedAt: event.target.value })}
              />
            </Field>
            <Field label={d.prescription.expiresAt} hint={d.common.optional}>
              <Input
                type="date"
                value={meta.expiresAt}
                onChange={(event) => setMeta({ ...meta, expiresAt: event.target.value })}
              />
            </Field>
          </div>
          <Field label={d.prescription.customerNote} hint={d.common.optional} className="sm:col-span-2">
            <Textarea
              rows={2}
              value={meta.customerNote}
              onChange={(event) => setMeta({ ...meta, customerNote: event.target.value })}
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-500 sm:max-w-md">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {d.prescription.privacyNotice}
          </p>
          <Button type="submit" size="lg" loading={submitting} disabled={!file}>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {d.prescription.submit}
          </Button>
        </div>
      </Card>

      {/* What happens next */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink-900">{d.prescription.verificationStatus}</h3>
        <ol className="space-y-2.5 text-sm">
          {[
            { status: 'PENDING', label: d.prescription.statusPENDING, tone: 'warning' as const },
            { status: 'VERIFIED', label: d.prescription.statusVERIFIED, tone: 'success' as const },
            { status: 'CLARIFICATION_REQUESTED', label: d.prescription.statusCLARIFICATION_REQUESTED, tone: 'accent' as const },
            { status: 'REJECTED', label: d.prescription.statusREJECTED, tone: 'danger' as const },
          ].map((step, index) => (
            <li key={step.status} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600">
                {index + 1}
              </span>
              <Badge tone={step.tone}>{step.label}</Badge>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-ink-500">{d.prescription.safetyNotice}</p>
      </Card>
    </form>
  )
}
