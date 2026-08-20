'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Ban, MessageSquarePlus, Phone, Printer, Send, Truck } from 'lucide-react'

import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Modal } from '@/components/ui/dialog'
import { Field, Select, Textarea } from '@/components/ui/field'
import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { formatDateTime } from '@/lib/utils'

const NEXT_STATUS: Record<string, string[]> = {
  NEW: ['CONFIRMING', 'PREPARING'],
  CONFIRMING: ['PREPARING'],
  PREPARING: ['SHIPPED', 'DELIVERED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

/**
 * Order workflow controls.
 *
 * The prescription gate is enforced server-side; here it is surfaced as a
 * disabled action with an explanation, so staff understand *why* an order
 * cannot advance rather than seeing a bare error.
 */
export function OrderWorkflow({
  orderId,
  status,
  requiresPrescription,
  prescriptionCleared,
  canUpdate,
  canCancel,
  canNote,
  couriers,
  deliveryId,
  courierId,
  canAssignCourier,
}: {
  orderId: string
  status: string
  requiresPrescription: boolean
  prescriptionCleared: boolean
  canUpdate: boolean
  canCancel: boolean
  canNote: boolean
  couriers: { id: string; fullName: string }[]
  deliveryId: string | null
  courierId: string | null
  canAssignCourier: boolean
}) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [busy, setBusy] = React.useState(false)
  const [statusModal, setStatusModal] = React.useState<string | null>(null)
  const [statusMessage, setStatusMessage] = React.useState('')
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState('')
  const [noteOpen, setNoteOpen] = React.useState(false)
  const [note, setNote] = React.useState('')
  const [selectedCourier, setSelectedCourier] = React.useState(courierId ?? '')

  const blockedByPrescription = requiresPrescription && !prescriptionCleared
  const options = NEXT_STATUS[status] ?? []

  async function updateStatus(next: string) {
    setBusy(true)
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status: next, message: statusMessage.trim() || undefined },
      })
      toast.success(d.admin.statusUpdated, d.orderStatus[next as keyof typeof d.orderStatus])
      setStatusModal(null)
      setStatusMessage('')
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'PRESCRIPTION_NOT_CLEARED') {
        toast.error(d.prescription.requiredForOrder, d.admin.verifyOnlyPharmacist)
      } else if (error instanceof ApiClientError && error.code === 'INVALID_TRANSITION') {
        toast.error(d.errors.generic, d.admin.updateStatus)
      } else {
        toast.error(d.errors.generic)
      }
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (cancelReason.trim().length < 3) {
      toast.warning(d.validation.required)
      return
    }
    setBusy(true)
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason.trim() },
      })
      toast.success(d.admin.orderCancelled)
      setCancelOpen(false)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  async function addNote() {
    if (note.trim().length < 2) return
    setBusy(true)
    try {
      await apiFetch(`/api/orders/${orderId}/notes`, { method: 'POST', body: { body: note.trim() } })
      toast.success(d.admin.saved)
      setNote('')
      setNoteOpen(false)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  async function assignCourier(value: string) {
    if (!deliveryId) return
    setSelectedCourier(value)
    setBusy(true)
    try {
      await apiFetch(`/api/deliveries/${deliveryId}`, {
        method: 'PATCH',
        body: { courierId: value || null, status: value ? 'ASSIGNED' : 'PENDING' },
      })
      toast.success(d.admin.saved)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-ink-900">{d.admin.updateStatus}</h3>

      {blockedByPrescription ? (
        <Alert tone="warning" className="mb-3" title={d.prescription.requiredForOrder}>
          {d.prescription.awaitingVerification} — {d.admin.verifyOnlyPharmacist}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canUpdate && options.length > 0 ? (
          options.map((option) => {
            const advancing = ['PREPARING', 'SHIPPED', 'DELIVERED'].includes(option)
            const disabled = busy || (advancing && blockedByPrescription)
            return (
              <Button
                key={option}
                size="sm"
                variant={option === 'DELIVERED' ? 'success' : 'primary'}
                disabled={disabled}
                onClick={() => setStatusModal(option)}
                title={disabled && advancing ? d.prescription.awaitingVerification : undefined}
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                {d.orderStatus[option as keyof typeof d.orderStatus]}
              </Button>
            )
          })
        ) : null}

        {canUpdate && options.length === 0 ? (
          <Badge tone={status === 'DELIVERED' ? 'success' : 'neutral'}>
            {d.orderStatus[status as keyof typeof d.orderStatus]}
          </Badge>
        ) : null}

        {canNote ? (
          <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            {d.admin.addNote}
          </Button>
        ) : null}

        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" aria-hidden />
          {d.common.print}
        </Button>

        {canCancel && !['DELIVERED', 'CANCELLED'].includes(status) ? (
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelOpen(true)}>
            <Ban className="h-3.5 w-3.5" aria-hidden />
            {d.admin.cancelOrder}
          </Button>
        ) : null}
      </div>

      {canAssignCourier && deliveryId ? (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <Field label={d.admin.assignCourier}>
            <Select
              value={selectedCourier}
              onChange={(event) => assignCourier(event.target.value)}
              disabled={busy}
            >
              <option value="">{d.common.none}</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {courier.fullName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {/* Status confirmation, with an optional customer-facing message */}
      <Modal
        open={statusModal !== null}
        onClose={() => setStatusModal(null)}
        title={d.admin.updateStatus}
        description={
          statusModal ? d.orderStatus[statusModal as keyof typeof d.orderStatus] : undefined
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setStatusModal(null)} disabled={busy}>
              {d.common.cancel}
            </Button>
            <Button size="sm" loading={busy} onClick={() => statusModal && updateStatus(statusModal)}>
              {d.common.confirm}
            </Button>
          </>
        }
      >
        <Field label={d.admin.internalNotes} hint={d.common.optional}>
          <Textarea
            rows={2}
            value={statusMessage}
            onChange={(event) => setStatusMessage(event.target.value)}
            placeholder={d.admin.addNote}
          />
        </Field>
        <p className="mt-2 text-xs text-ink-500">{d.admin.statusUpdated} — {d.account.notifications}</p>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
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
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
          />
        </Field>
      </ConfirmDialog>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={d.admin.addNote}
        description={d.admin.internalNotes}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setNoteOpen(false)} disabled={busy}>
              {d.common.cancel}
            </Button>
            <Button size="sm" loading={busy} onClick={addNote}>
              {d.common.save}
            </Button>
          </>
        }
      >
        <Field label={d.admin.internalNotes} required>
          <Textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </Modal>
    </Card>
  )
}

/** Payment status reconciliation, for bank transfers and card follow-ups. */
export function PaymentStatusControl({
  paymentId,
  status,
  method,
}: {
  paymentId: string
  status: string
  method: string
}) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [value, setValue] = React.useState(status)

  const options = ['PENDING', 'AWAITING_CONFIRMATION', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED']

  async function update(next: string) {
    setValue(next)
    setBusy(true)
    try {
      await apiFetch(`/api/payments/${paymentId}`, { method: 'PATCH', body: { status: next } })
      toast.success(d.admin.statusUpdated, d.paymentStatus[next as keyof typeof d.paymentStatus])
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
      setValue(status)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Field label={`${d.admin.paymentInfo} — ${d.paymentMethod[method as keyof typeof d.paymentMethod]}`}>
        <Select value={value} onChange={(event) => update(event.target.value)} disabled={busy}>
          {options.map((option) => (
            <option key={option} value={option}>
              {d.paymentStatus[option as keyof typeof d.paymentStatus]}
            </option>
          ))}
        </Select>
      </Field>
      {method === 'BANK_TRANSFER' ? (
        <p className="mt-1.5 text-xs text-ink-500">{d.checkout.bankTransferDesc}</p>
      ) : null}
    </div>
  )
}

/** Delivery status control used on the order page and the delivery board. */
export function DeliveryStatusControl({
  deliveryId,
  status,
  compact = false,
}: {
  deliveryId: string
  status: string
  compact?: boolean
}) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [value, setValue] = React.useState(status)

  const options = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED']

  async function update(next: string) {
    setValue(next)
    setBusy(true)
    try {
      await apiFetch(`/api/deliveries/${deliveryId}`, { method: 'PATCH', body: { status: next } })
      toast.success(d.admin.statusUpdated, d.deliveryStatus[next as keyof typeof d.deliveryStatus])
      router.refresh()
    } catch (error) {
      setValue(status)
      toast.error(
        d.errors.generic,
        error instanceof ApiClientError && error.code === 'FORBIDDEN' ? d.errors.forbiddenBody : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? 'w-40' : ''}>
      {!compact ? (
        <label className="label flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-ink-400" aria-hidden />
          {d.deliveryStatus[status as keyof typeof d.deliveryStatus]}
        </label>
      ) : null}
      <Select
        value={value}
        onChange={(event) => update(event.target.value)}
        disabled={busy}
        className={compact ? 'h-9 text-xs' : ''}
        aria-label={d.admin.delivery}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {d.deliveryStatus[option as keyof typeof d.deliveryStatus]}
          </option>
        ))}
      </Select>
    </div>
  )
}

/** Click-to-call, kept as a component so the print stylesheet can hide it. */
export function ContactCustomerButton({ phone, name }: { phone: string; name: string }) {
  const { d } = useI18n()
  return (
    <a href={`tel:${phone.replace(/\s/g, '')}`} className="no-print">
      <Button size="sm" variant="outline" title={name}>
        <Phone className="h-3.5 w-3.5" aria-hidden />
        {d.admin.contactCustomer}
      </Button>
    </a>
  )
}

export function PrintTimestamp({ locale }: { locale: string }) {
  const [now, setNow] = React.useState<string>('')
  React.useEffect(() => setNow(formatDateTime(new Date(), locale)), [locale])
  return <span className="tabular">{now}</span>
}
