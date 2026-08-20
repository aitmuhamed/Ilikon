'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  HelpCircle,
  Lock,
  MessageSquare,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

import { Alert, Badge, Card, PRESCRIPTION_STATUS_TONE } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Field, Textarea } from '@/components/ui/field'
import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { formatDate, formatDateTime, formatMnt } from '@/lib/utils'

export interface PrescriptionRow {
  id: string
  code: string
  status: string
  fileName: string
  mimeType: string
  sizeBytes: number
  patientName: string | null
  doctorName: string | null
  clinic: string | null
  issuedAt: string | null
  expiresAt: string | null
  customerNote: string | null
  createdAt: string
  customer: { id: string; fullName: string; phone: string }
  order: {
    id: string
    orderNumber: string
    total: number
    status: string
    requiresPrescription: boolean
    items: { name: string; quantity: number; prescriptionRequired: boolean }[]
  } | null
  reviews: {
    id: string
    action: string
    resultStatus: string
    reason: string | null
    pharmacistNote: string | null
    reviewer: string
    createdAt: string
  }[]
}

type Action = 'APPROVE' | 'REJECT' | 'REQUEST_CLARIFICATION' | 'NOTE'

/**
 * Pharmacist review queue.
 *
 * There is deliberately no bulk-approve control: each prescription is a clinical
 * decision that has to be made against the actual document, and the API rejects
 * verification from anyone without a pharmacist role regardless of what the UI
 * offers.
 */
export function PrescriptionQueue({
  prescriptions,
  canVerify,
  reviewerName,
}: {
  prescriptions: PrescriptionRow[]
  canVerify: boolean
  reviewerName: string
}) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [selected, setSelected] = React.useState<PrescriptionRow | null>(null)
  const [action, setAction] = React.useState<Action>('APPROVE')
  const [reason, setReason] = React.useState('')
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const statusLabel = (status: string) =>
    d.prescription[`status${status}` as keyof typeof d.prescription] as string

  function open(prescription: PrescriptionRow, initialAction: Action) {
    setSelected(prescription)
    setAction(initialAction)
    setReason('')
    setNote('')
  }

  async function submit() {
    if (!selected) return
    if ((action === 'REJECT' || action === 'REQUEST_CLARIFICATION') && reason.trim().length < 4) {
      toast.warning(d.prescription.reason, d.validation.required)
      return
    }

    setBusy(true)
    try {
      await apiFetch(`/api/prescriptions/${selected.id}/verify`, {
        method: 'PATCH',
        body: {
          action,
          reason: reason.trim() || undefined,
          pharmacistNote: note.trim() || undefined,
        },
      })
      toast.success(d.admin.prescriptionReviewed, statusLabel(
        action === 'APPROVE' ? 'VERIFIED' : action === 'REJECT' ? 'REJECTED' : 'CLARIFICATION_REQUESTED',
      ))
      setSelected(null)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'PHARMACIST_REQUIRED') {
        toast.error(d.admin.verifyOnlyPharmacist)
      } else if (error instanceof ApiClientError && error.code === 'FORBIDDEN') {
        toast.error(d.errors.forbidden, d.admin.verifyOnlyPharmacist)
      } else {
        toast.error(d.errors.generic)
      }
    } finally {
      setBusy(false)
    }
  }

  if (prescriptions.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
          <p className="mt-3 text-sm font-medium text-ink-800">{d.prescription.noPrescriptions}</p>
          <p className="mt-1 text-xs text-ink-500">{d.admin.emptyTable}</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Alert tone="info" className="mb-4" title={d.admin.prescriptionAccessNotice}>
        {d.prescription.safetyNotice}
      </Alert>

      <ul className="space-y-3">
        {prescriptions.map((prescription) => {
          const expired =
            prescription.expiresAt && new Date(prescription.expiresAt).getTime() < Date.now()
          const actionable = ['PENDING', 'CLARIFICATION_REQUESTED'].includes(prescription.status)

          return (
            <li key={prescription.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink-900 tabular">{prescription.code}</span>
                      <Badge tone={PRESCRIPTION_STATUS_TONE[prescription.status] ?? 'neutral'}>
                        {statusLabel(prescription.status)}
                      </Badge>
                      {expired && prescription.status !== 'REJECTED' ? (
                        <Badge tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>
                          {d.prescription.statusEXPIRED}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {formatDateTime(prescription.createdAt, locale)} · {prescription.customer.fullName} ·{' '}
                      <span className="tabular">{prescription.customer.phone}</span>
                    </p>
                  </div>

                  {prescription.order ? (
                    <Link
                      href={`/admin/orders/${prescription.order.id}`}
                      className="shrink-0 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:border-brand-300"
                    >
                      <span className="tabular">{prescription.order.orderNumber}</span> ·{' '}
                      {formatMnt(prescription.order.total, locale)} →
                    </Link>
                  ) : (
                    <Badge tone="neutral">{d.prescription.noOrder}</Badge>
                  )}
                </div>

                <div className="grid gap-4 py-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
                      <Detail label={d.prescription.patientName} value={prescription.patientName} />
                      <Detail label={d.prescription.doctorName} value={prescription.doctorName} />
                      <Detail label={d.prescription.clinic} value={prescription.clinic} />
                      <Detail
                        label={d.prescription.issuedAt}
                        value={prescription.issuedAt ? formatDate(prescription.issuedAt, locale) : null}
                      />
                      <Detail
                        label={d.prescription.expiresAt}
                        value={prescription.expiresAt ? formatDate(prescription.expiresAt, locale) : null}
                        tone={expired ? 'danger' : undefined}
                      />
                      <Detail
                        label={d.common.upload}
                        value={`${prescription.fileName} · ${(prescription.sizeBytes / 1024).toFixed(0)} KB`}
                      />
                    </dl>

                    {prescription.customerNote ? (
                      <div className="mt-3 rounded-lg bg-ink-50 p-2.5">
                        <p className="text-[11px] font-semibold text-ink-700">
                          {d.prescription.customerNote}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-600">{prescription.customerNote}</p>
                      </div>
                    ) : null}

                    {/* Which items on the order actually need the prescription */}
                    {prescription.order?.items.some((item) => item.prescriptionRequired) ? (
                      <div className="mt-3 rounded-lg border border-accent-200 bg-accent-50/60 p-2.5">
                        <p className="text-[11px] font-semibold text-accent-900">
                          {d.prescription.requiredForOrder}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {prescription.order.items
                            .filter((item) => item.prescriptionRequired)
                            .map((item, index) => (
                              <li key={index} className="text-xs text-accent-900/90">
                                • {item.name} × {item.quantity}
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}

                    {prescription.reviews.length > 0 ? (
                      <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
                        <p className="text-[11px] font-semibold text-ink-700">{d.admin.reviewHistory}</p>
                        {prescription.reviews.map((review) => (
                          <div key={review.id} className="rounded-lg bg-ink-50 p-2.5 text-xs">
                            <p className="font-medium text-ink-800">
                              {statusLabel(review.resultStatus)} · {review.reviewer} ·{' '}
                              {formatDateTime(review.createdAt, locale)}
                            </p>
                            {review.reason ? (
                              <p className="mt-0.5 text-ink-600">
                                {d.prescription.reason}: {review.reason}
                              </p>
                            ) : null}
                            {review.pharmacistNote ? (
                              <p className="mt-0.5 text-ink-600">
                                {d.prescription.pharmacistNote}: {review.pharmacistNote}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Document preview */}
                  <div>
                    <div className="overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
                      {prescription.mimeType.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/prescriptions/${prescription.id}/file`}
                          alt={`${d.prescription.title} ${prescription.code}`}
                          className="h-44 w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-44 flex-col items-center justify-center text-ink-400">
                          <FileText className="h-8 w-8" aria-hidden />
                          <p className="mt-1.5 text-xs">{prescription.mimeType}</p>
                        </div>
                      )}
                    </div>
                    <a
                      href={`/api/prescriptions/${prescription.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block"
                    >
                      <Button size="sm" variant="outline" fullWidth>
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                        {d.admin.viewFile}
                      </Button>
                    </a>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-ink-400">
                      {d.prescription.privacyNotice}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                  {canVerify ? (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        disabled={!actionable}
                        onClick={() => open(prescription, 'APPROVE')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        {d.admin.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="accent"
                        disabled={!actionable}
                        onClick={() => open(prescription, 'REQUEST_CLARIFICATION')}
                      >
                        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                        {d.admin.requestClarification}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!actionable}
                        onClick={() => open(prescription, 'REJECT')}
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden />
                        {d.admin.reject}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => open(prescription, 'NOTE')}>
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        {d.admin.pharmacistNote}
                      </Button>
                    </>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-ink-500">
                      <ShieldCheck className="h-3.5 w-3.5 text-ink-400" aria-hidden />
                      {d.admin.verifyOnlyPharmacist}
                    </p>
                  )}
                </div>
              </Card>
            </li>
          )
        })}
      </ul>

      {/* Decision modal */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          action === 'APPROVE'
            ? d.admin.approve
            : action === 'REJECT'
              ? d.admin.reject
              : action === 'REQUEST_CLARIFICATION'
                ? d.admin.requestClarification
                : d.admin.pharmacistNote
        }
        description={selected ? `${selected.code} · ${selected.customer.fullName}` : undefined}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSelected(null)} disabled={busy}>
              {d.common.cancel}
            </Button>
            <Button
              size="sm"
              variant={action === 'REJECT' ? 'danger' : action === 'APPROVE' ? 'success' : 'primary'}
              loading={busy}
              onClick={submit}
            >
              {d.common.confirm}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {action === 'APPROVE' ? (
            <Alert tone="success" title={d.prescription.statusVERIFIED}>
              {d.prescription.safetyNotice}
            </Alert>
          ) : action === 'REJECT' ? (
            <Alert tone="danger" title={d.prescription.statusREJECTED}>
              {d.checkout.prescriptionRequiredBody}
            </Alert>
          ) : action === 'REQUEST_CLARIFICATION' ? (
            <Alert tone="warning" title={d.prescription.statusCLARIFICATION_REQUESTED}>
              {d.prescription.uploadSubtitle}
            </Alert>
          ) : null}

          {action === 'REJECT' || action === 'REQUEST_CLARIFICATION' ? (
            <Field
              label={d.prescription.reason}
              required
              hint={d.account.notifications}
            >
              <Textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  action === 'REJECT'
                    ? 'Жорын хугацаа дууссан / уншигдахгүй / захиалгатай тохирохгүй'
                    : 'Тодруулга шаардлагатай хэсгийг тайлбарлана уу'
                }
              />
            </Field>
          ) : null}

          <Field label={d.prescription.pharmacistNote} hint={d.common.optional}>
            <Textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={d.admin.internalNotes}
            />
          </Field>

          <div className="rounded-lg bg-ink-50 p-3">
            <p className="text-[11px] text-ink-600">
              {d.prescription.reviewedBy}: <strong>{reviewerName}</strong>
            </p>
            <p className="mt-0.5 text-[11px] text-ink-500">{d.admin.prescriptionAccessNotice}</p>
          </div>
        </div>
      </Modal>
    </>
  )
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string
  value: string | null
  tone?: 'danger'
}) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-ink-400">{label}:</dt>
      <dd className={tone === 'danger' ? 'font-semibold text-danger' : 'text-ink-700'}>
        {value ?? '—'}
      </dd>
    </div>
  )
}
