'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, History, PackagePlus, Settings2, ShieldAlert } from 'lucide-react'

import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils'

export interface InventoryRow {
  id: string
  name: string
  sku: string
  categoryName: string
  quantity: number
  lowStockThreshold: number
  shelfLocation: string | null
  expiryDate: string | null
  daysToExpiry: number | null
  prescriptionRequired: boolean
  isLowStock: boolean
  isExpired: boolean
  isExpiringSoon: boolean
}

export interface LedgerRow {
  id: string
  type: string
  quantityDelta: number
  balanceAfter: number
  reason: string | null
  reference: string | null
  performedBy: string | null
  createdAt: string
  productName: string
  productSku: string
}

const TX_TYPES = ['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED', 'RETURN'] as const

/**
 * Stock adjustment.
 *
 * Every movement goes through the ledger with a reason, so the running balance
 * can always be reconciled. Write-offs (damaged / expired) are separate movement
 * types rather than a plain decrement, which is what makes the expiry write-off
 * auditable.
 */
export function InventoryTable({
  items,
  canAdjust,
  lowStockDefault,
}: {
  items: InventoryRow[]
  canAdjust: boolean
  lowStockDefault: number
}) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [adjust, setAdjust] = React.useState<InventoryRow | null>(null)
  const [thresholdTarget, setThresholdTarget] = React.useState<InventoryRow | null>(null)
  const [history, setHistory] = React.useState<{ row: InventoryRow; entries: LedgerRow[] } | null>(null)
  const [busy, setBusy] = React.useState(false)

  const [form, setForm] = React.useState({
    type: 'STOCK_IN' as (typeof TX_TYPES)[number],
    quantity: '',
    reason: '',
    reference: '',
  })
  const [thresholdForm, setThresholdForm] = React.useState({ lowStockThreshold: '', shelfLocation: '' })

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      STOCK_IN: d.admin.stockIn,
      STOCK_OUT: d.admin.stockOut,
      SALE: d.admin.orders,
      RETURN: d.account.reorder,
      ADJUSTMENT: d.admin.stockAdjustment,
      DAMAGED: d.admin.damagedStock,
      EXPIRED: d.admin.expiredStock,
      RESERVED: d.common.status,
      RELEASED: d.common.status,
    }
    return labels[type] ?? type
  }

  function openAdjust(row: InventoryRow, type: (typeof TX_TYPES)[number] = 'STOCK_IN') {
    setForm({ type, quantity: '', reason: '', reference: '' })
    setAdjust(row)
  }

  async function submitAdjust() {
    if (!adjust) return
    const quantity = Number(form.quantity)
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.warning(d.validation.invalidNumber)
      return
    }

    setBusy(true)
    try {
      const result = await apiFetch<{ balanceAfter: number }>('/api/inventory', {
        method: 'POST',
        body: {
          productId: adjust.id,
          type: form.type,
          quantity,
          reason: form.reason.trim() || undefined,
          reference: form.reference.trim() || undefined,
        },
      })
      toast.success(d.admin.stockAdjusted, `${adjust.sku}: ${result.balanceAfter}`)
      setAdjust(null)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'INSUFFICIENT_STOCK') {
        const available = (error.details as { available?: number })?.available
        toast.error(d.validation.insufficientStock, `${d.admin.currentStock}: ${available ?? 0}`)
      } else {
        toast.error(d.errors.generic)
      }
    } finally {
      setBusy(false)
    }
  }

  async function submitThreshold() {
    if (!thresholdTarget) return
    setBusy(true)
    try {
      await apiFetch('/api/inventory', {
        method: 'PATCH',
        body: {
          productId: thresholdTarget.id,
          lowStockThreshold: Number(thresholdForm.lowStockThreshold || lowStockDefault),
          shelfLocation: thresholdForm.shelfLocation.trim() || undefined,
        },
      })
      toast.success(d.admin.saved)
      setThresholdTarget(null)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  async function openHistory(row: InventoryRow) {
    setBusy(true)
    try {
      const result = await apiFetch<{ transactions: LedgerRow[] }>(
        `/api/inventory/transactions?productId=${row.id}`,
      )
      setHistory({ row, entries: result.transactions })
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-[11px] uppercase tracking-wide text-ink-500">
                <th className="px-3.5 py-2.5">{d.common.name}</th>
                <th className="px-3.5 py-2.5">SKU</th>
                <th className="px-3.5 py-2.5">{d.product.category}</th>
                <th className="px-3.5 py-2.5 text-center">{d.admin.currentStock}</th>
                <th className="px-3.5 py-2.5 text-center">{d.admin.lowStockThreshold}</th>
                <th className="px-3.5 py-2.5">Shelf</th>
                <th className="px-3.5 py-2.5">{d.product.expiryDate}</th>
                <th className="px-3.5 py-2.5 text-right">{d.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-brand-50/40">
                  <td className="px-3.5 py-3">
                    <span className="block max-w-[220px] truncate font-medium text-ink-900">
                      {row.name}
                    </span>
                    {row.prescriptionRequired ? (
                      <Badge tone="rx" className="mt-0.5">
                        {d.product.prescriptionRequiredShort}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3.5 py-3 text-xs tabular">{row.sku}</td>
                  <td className="px-3.5 py-3 text-xs text-ink-600">{row.categoryName}</td>
                  <td className="px-3.5 py-3 text-center">
                    <span
                      className={
                        row.quantity === 0
                          ? 'text-base font-bold text-danger tabular'
                          : row.isLowStock
                            ? 'text-base font-bold text-warning tabular'
                            : 'text-base font-semibold text-ink-900 tabular'
                      }
                    >
                      {row.quantity}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-center text-xs text-ink-500 tabular">
                    {row.lowStockThreshold}
                  </td>
                  <td className="px-3.5 py-3 text-xs text-ink-500 tabular">
                    {row.shelfLocation ?? '—'}
                  </td>
                  <td className="px-3.5 py-3">
                    {row.expiryDate ? (
                      <span
                        className={
                          row.isExpired
                            ? 'text-xs font-bold text-danger'
                            : row.isExpiringSoon
                              ? 'text-xs font-semibold text-warning'
                              : 'text-xs text-ink-500'
                        }
                      >
                        {formatDate(row.expiryDate, locale)}
                        {row.isExpired ? ` · ${d.admin.expiredAlert}` : ''}
                        {row.isExpiringSoon ? ` · ${row.daysToExpiry} ${d.admin.daysLeft}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canAdjust ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openAdjust(row, 'STOCK_IN')}
                            className="rounded-lg p-1.5 text-success transition-colors hover:bg-green-50"
                            aria-label={d.admin.stockIn}
                            title={d.admin.stockIn}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjust(row, 'STOCK_OUT')}
                            className="rounded-lg p-1.5 text-danger transition-colors hover:bg-red-50"
                            aria-label={d.admin.stockOut}
                            title={d.admin.stockOut}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setThresholdForm({
                                lowStockThreshold: String(row.lowStockThreshold),
                                shelfLocation: row.shelfLocation ?? '',
                              })
                              setThresholdTarget(row)
                            }}
                            className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-100"
                            aria-label={d.admin.lowStockThreshold}
                            title={d.admin.lowStockThreshold}
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openHistory(row)}
                        className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-100"
                        aria-label={d.admin.inventoryHistory}
                        title={d.admin.inventoryHistory}
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-ink-400">
                    {d.admin.emptyTable}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment */}
      <Modal
        open={adjust !== null}
        onClose={() => setAdjust(null)}
        title={d.admin.stockAdjustment}
        description={adjust ? `${adjust.name} · ${adjust.sku}` : undefined}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAdjust(null)} disabled={busy}>
              {d.common.cancel}
            </Button>
            <Button size="sm" onClick={submitAdjust} loading={busy}>
              {d.common.confirm}
            </Button>
          </>
        }
      >
        {adjust ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-ink-50 p-3">
              <span className="text-sm text-ink-600">{d.admin.currentStock}</span>
              <span className="text-lg font-bold text-ink-900 tabular">{adjust.quantity}</span>
            </div>

            <Field label={d.common.status} required>
              <Select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as (typeof TX_TYPES)[number] })
                }
              >
                {TX_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={d.admin.adjustmentQuantity} required>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                className="tabular"
                data-autofocus
              />
            </Field>

            <Field label={d.admin.adjustmentReason} hint={d.common.optional}>
              <Textarea
                rows={2}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                placeholder={
                  form.type === 'EXPIRED'
                    ? d.admin.expiredStock
                    : form.type === 'DAMAGED'
                      ? d.admin.damagedStock
                      : d.admin.stockAdjustment
                }
              />
            </Field>

            <Field label="Reference" hint={d.common.optional}>
              <Input
                value={form.reference}
                onChange={(event) => setForm({ ...form, reference: event.target.value })}
                placeholder="INV-2026-0142"
                className="tabular"
              />
            </Field>

            {form.type === 'EXPIRED' || form.type === 'DAMAGED' ? (
              <Alert tone="warning" title={d.admin.expiredAlert}>
                {d.validation.expiredProduct}
              </Alert>
            ) : null}

            {form.quantity ? (
              <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 p-3">
                <span className="text-sm font-medium text-brand-800">{d.admin.currentStock} →</span>
                <span className="text-lg font-extrabold text-brand-800 tabular">
                  {['STOCK_OUT', 'DAMAGED', 'EXPIRED'].includes(form.type)
                    ? Math.max(0, adjust.quantity - Number(form.quantity || 0))
                    : adjust.quantity + Number(form.quantity || 0)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Threshold */}
      <Modal
        open={thresholdTarget !== null}
        onClose={() => setThresholdTarget(null)}
        title={d.admin.lowStockThreshold}
        description={thresholdTarget?.name}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setThresholdTarget(null)}
              disabled={busy}
            >
              {d.common.cancel}
            </Button>
            <Button size="sm" onClick={submitThreshold} loading={busy}>
              {d.common.save}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={d.admin.lowStockThreshold} required>
            <Input
              type="number"
              min={0}
              value={thresholdForm.lowStockThreshold}
              onChange={(event) =>
                setThresholdForm({ ...thresholdForm, lowStockThreshold: event.target.value })
              }
              className="tabular"
            />
          </Field>
          <Field label="Shelf" hint={d.common.optional}>
            <Input
              value={thresholdForm.shelfLocation}
              onChange={(event) =>
                setThresholdForm({ ...thresholdForm, shelfLocation: event.target.value })
              }
              placeholder="A-01"
            />
          </Field>
          <p className="text-xs text-ink-500">{d.admin.lowStockAlert}</p>
        </div>
      </Modal>

      {/* Ledger */}
      <Modal
        open={history !== null}
        onClose={() => setHistory(null)}
        title={d.admin.inventoryHistory}
        description={history ? `${history.row.name} · ${history.row.sku}` : undefined}
        size="lg"
      >
        {history ? (
          history.entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {history.entries.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          entry.quantityDelta > 0
                            ? 'success'
                            : entry.quantityDelta < 0
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {typeLabel(entry.type)}
                      </Badge>
                      <span
                        className={
                          entry.quantityDelta > 0
                            ? 'text-sm font-bold text-success tabular'
                            : 'text-sm font-bold text-danger tabular'
                        }
                      >
                        {entry.quantityDelta > 0 ? '+' : ''}
                        {entry.quantityDelta}
                      </span>
                      <span className="text-xs text-ink-400">
                        → <span className="font-semibold tabular">{entry.balanceAfter}</span>
                      </span>
                    </div>
                    {entry.reason ? (
                      <p className="mt-0.5 text-xs text-ink-600">{entry.reason}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {formatDateTime(entry.createdAt, locale)}
                      {entry.performedBy ? ` · ${entry.performedBy}` : ''}
                      {entry.reference ? ` · ${entry.reference}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Modal>
    </>
  )
}

/** Expiry / low-stock write-off panel shown above the table. */
export function InventoryAlertPanel({
  expired,
  expiring,
  canAdjust,
}: {
  expired: { productId: string; name: string; sku: string; expiryDate: string }[]
  expiring: { productId: string; name: string; sku: string; expiryDate: string; daysLeft: number }[]
  canAdjust: boolean
}) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const [busy, setBusy] = React.useState<string | null>(null)

  async function writeOff(productId: string, sku: string) {
    setBusy(productId)
    try {
      // Quantity is read server-side; a large value is clamped by the ledger
      // guard, so we ask for the current balance first.
      const inventory = await apiFetch<{ items: { id: string; quantity: number }[] }>(
        `/api/inventory?q=${encodeURIComponent(sku)}`,
      )
      const quantity = inventory.items.find((item) => item.id === productId)?.quantity ?? 0
      if (quantity <= 0) {
        toast.info(d.product.outOfStock)
        return
      }
      await apiFetch('/api/inventory', {
        method: 'POST',
        body: {
          productId,
          type: 'EXPIRED',
          quantity,
          reason: 'Хугацаа дууссан — хасалт',
        },
      })
      toast.success(d.admin.stockAdjusted, `${sku}: 0`)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(null)
    }
  }

  if (expired.length === 0 && expiring.length === 0) return null

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-2">
      {expired.length > 0 ? (
        <Card className="border-red-200 bg-red-50/50">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-red-900">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            {d.admin.expiredAlert} ({expired.length})
          </h3>
          <p className="mt-1 text-xs text-red-800">{d.validation.expiredProduct}</p>
          <ul className="mt-3 space-y-1.5">
            {expired.slice(0, 6).map((item) => (
              <li key={item.productId} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-red-900">
                  {item.name} <span className="text-red-700 tabular">({item.sku})</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-red-700 tabular">{formatDate(item.expiryDate, locale)}</span>
                  {canAdjust ? (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busy === item.productId}
                      onClick={() => writeOff(item.productId, item.sku)}
                    >
                      {d.admin.expiredStock}
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {expiring.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <PackagePlus className="h-4 w-4" aria-hidden />
            {d.admin.expiringAlert} ({expiring.length})
          </h3>
          <ul className="mt-3 space-y-1.5">
            {expiring.slice(0, 8).map((item) => (
              <li key={item.productId} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-amber-900">
                  {item.name} <span className="text-amber-700 tabular">({item.sku})</span>
                </span>
                <span className="shrink-0 font-semibold text-amber-800 tabular">
                  {formatNumber(item.daysLeft, locale)} {d.admin.daysLeft}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
