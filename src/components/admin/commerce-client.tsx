'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Eye, EyeOff, Pencil, Percent, Plus, Tag, Trash2 } from 'lucide-react'

import { Alert, Badge, Card, StarRating } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Modal } from '@/components/ui/dialog'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/field'
import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { LOCALES, LOCALE_META, type Locale } from '@/lib/locale-types'
import { cn, formatDate, formatDateTime, formatMnt } from '@/lib/utils'

// ────────────────────────────── coupons ──────────────────────────────────

export interface CouponRow {
  id: string
  code: string
  description: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  minOrderAmount: number
  maxDiscountAmount: number | null
  startsAt: string
  endsAt: string
  usageLimit: number | null
  perCustomerLimit: number
  usedCount: number
  isActive: boolean
  redemptionCount: number
  isExpired: boolean
  isScheduled: boolean
  isExhausted: boolean
}

function toDateInput(value: string): string {
  return new Date(value).toISOString().slice(0, 10)
}

export function CouponManager({
  coupons,
  canManage,
}: {
  coupons: CouponRow[]
  canManage: boolean
}) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [form, setForm] = React.useState<
    | (Omit<Partial<CouponRow>, 'id'> & {
        id: string | null
        startsAtInput: string
        endsAtInput: string
      })
    | null
  >(null)
  const [deleteTarget, setDeleteTarget] = React.useState<CouponRow | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  function open(row?: CouponRow) {
    setErrors({})
    const today = new Date().toISOString().slice(0, 10)
    const inThreeMonths = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
    setForm(
      row
        ? { ...row, startsAtInput: toDateInput(row.startsAt), endsAtInput: toDateInput(row.endsAt) }
        : {
            id: null,
            code: '',
            discountType: 'PERCENTAGE',
            discountValue: 10,
            minOrderAmount: 0,
            perCustomerLimit: 1,
            isActive: true,
            startsAtInput: today,
            endsAtInput: inThreeMonths,
          },
    )
  }

  async function save() {
    if (!form) return
    const next: Record<string, string> = {}
    if (!/^[A-Z0-9\-_]{2,40}$/.test(form.code ?? '')) next.code = 'A-Z, 0-9, -, _'
    const value = Number(form.discountValue)
    if (!Number.isFinite(value) || value < 1) next.discountValue = d.validation.invalidNumber
    if (form.discountType === 'PERCENTAGE' && value > 100) next.discountValue = '1-100'
    if (new Date(form.endsAtInput) <= new Date(form.startsAtInput)) next.endsAtInput = d.validation.invalidDate
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const payload = {
        code: (form.code ?? '').toUpperCase(),
        description: form.description?.trim() || undefined,
        discountType: form.discountType,
        discountValue: value,
        minOrderAmount: Number(form.minOrderAmount ?? 0),
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        startsAt: new Date(form.startsAtInput).toISOString(),
        endsAt: new Date(`${form.endsAtInput}T23:59:59`).toISOString(),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        perCustomerLimit: Number(form.perCustomerLimit ?? 1),
        isActive: form.isActive ?? true,
      }

      if (form.id) {
        await apiFetch(`/api/coupons/${form.id}`, { method: 'PUT', body: payload })
        toast.success(d.admin.saved)
      } else {
        await apiFetch('/api/coupons', { method: 'POST', body: payload })
        toast.success(d.admin.created)
      }
      setForm(null)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'CODE_TAKEN') {
        setErrors({ code: d.admin.couponCode })
        toast.error(d.errors.validationFailed, d.admin.couponCode)
      } else {
        toast.error(d.errors.generic)
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: CouponRow) {
    setBusy(true)
    try {
      const result = await apiFetch<{ archived: boolean }>(`/api/coupons/${row.id}`, {
        method: 'DELETE',
      })
      toast.success(result.archived ? d.admin.archived : d.admin.deleted)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
      setDeleteTarget(null)
    }
  }

  return (
    <>
      {canManage ? (
        <div className="mb-4">
          <Button size="sm" onClick={() => open()}>
            <Plus className="h-4 w-4" aria-hidden />
            {d.admin.newCoupon}
          </Button>
        </div>
      ) : null}

      {coupons.length === 0 ? (
        <Card>
          <p className="py-10 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {coupons.map((coupon) => {
            const state = !coupon.isActive
              ? { tone: 'neutral' as const, label: d.common.inactive }
              : coupon.isExpired
                ? { tone: 'danger' as const, label: d.prescription.statusEXPIRED }
                : coupon.isScheduled
                  ? { tone: 'accent' as const, label: d.admin.startsAt }
                  : coupon.isExhausted
                    ? { tone: 'warning' as const, label: d.admin.usageLimit }
                    : { tone: 'success' as const, label: d.common.active }

            return (
              <Card key={coupon.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-extrabold text-brand-800 tabular">
                        <Tag className="h-3.5 w-3.5" aria-hidden />
                        {coupon.code}
                      </span>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </div>
                    {coupon.description ? (
                      <p className="mt-1.5 text-xs text-ink-600">{coupon.description}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-extrabold text-ink-900 tabular">
                      {coupon.discountType === 'PERCENTAGE'
                        ? `${coupon.discountValue}%`
                        : formatMnt(coupon.discountValue, locale)}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {coupon.discountType === 'PERCENTAGE' ? d.admin.percentage : d.admin.fixed}
                    </p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-ink-100 pt-3 text-xs">
                  <Pair label={d.admin.minOrderAmount} value={formatMnt(coupon.minOrderAmount, locale)} />
                  <Pair
                    label={d.admin.maxDiscountAmount}
                    value={
                      coupon.maxDiscountAmount ? formatMnt(coupon.maxDiscountAmount, locale) : d.admin.unlimited
                    }
                  />
                  <Pair label={d.admin.startsAt} value={formatDate(coupon.startsAt, locale)} />
                  <Pair label={d.admin.endsAt} value={formatDate(coupon.endsAt, locale)} />
                  <Pair
                    label={d.admin.usedCount}
                    value={`${coupon.usedCount} / ${coupon.usageLimit ?? '∞'}`}
                  />
                  <Pair label={d.admin.perCustomerLimit} value={String(coupon.perCustomerLimit)} />
                </dl>

                {canManage ? (
                  <div className="mt-3 flex gap-1.5 border-t border-ink-100 pt-3">
                    <Button size="sm" variant="outline" onClick={() => open(coupon)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      {d.common.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => setDeleteTarget(coupon)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? d.admin.editCoupon : d.admin.newCoupon}
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
              <Field label={d.admin.couponCode} required error={errors.code}>
                <Input
                  value={form.code ?? ''}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                  invalid={Boolean(errors.code)}
                  className="uppercase tabular"
                  placeholder="ILIKON10"
                />
              </Field>
              <Field label={d.admin.discountType} required>
                <Select
                  value={form.discountType}
                  onChange={(event) =>
                    setForm({ ...form, discountType: event.target.value as 'PERCENTAGE' | 'FIXED' })
                  }
                >
                  <option value="PERCENTAGE">{d.admin.percentage} (%)</option>
                  <option value="FIXED">{d.admin.fixed} (₮)</option>
                </Select>
              </Field>
              <Field label={d.admin.discountValue} required error={errors.discountValue}>
                <Input
                  type="number"
                  min={1}
                  value={form.discountValue ?? ''}
                  onChange={(event) => setForm({ ...form, discountValue: Number(event.target.value) })}
                  invalid={Boolean(errors.discountValue)}
                  className="tabular"
                />
              </Field>
              <Field label={d.admin.minOrderAmount}>
                <Input
                  type="number"
                  min={0}
                  value={form.minOrderAmount ?? 0}
                  onChange={(event) => setForm({ ...form, minOrderAmount: Number(event.target.value) })}
                  className="tabular"
                />
              </Field>
              {form.discountType === 'PERCENTAGE' ? (
                <Field label={d.admin.maxDiscountAmount} hint={d.common.optional}>
                  <Input
                    type="number"
                    min={0}
                    value={form.maxDiscountAmount ?? ''}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        maxDiscountAmount: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                    className="tabular"
                  />
                </Field>
              ) : null}
              <Field label={d.admin.startsAt} required>
                <Input
                  type="date"
                  value={form.startsAtInput}
                  onChange={(event) => setForm({ ...form, startsAtInput: event.target.value })}
                />
              </Field>
              <Field label={d.admin.endsAt} required error={errors.endsAtInput}>
                <Input
                  type="date"
                  value={form.endsAtInput}
                  onChange={(event) => setForm({ ...form, endsAtInput: event.target.value })}
                  invalid={Boolean(errors.endsAtInput)}
                />
              </Field>
              <Field label={d.admin.usageLimit} hint={d.admin.unlimited}>
                <Input
                  type="number"
                  min={1}
                  value={form.usageLimit ?? ''}
                  onChange={(event) =>
                    setForm({ ...form, usageLimit: event.target.value ? Number(event.target.value) : null })
                  }
                  className="tabular"
                />
              </Field>
              <Field label={d.admin.perCustomerLimit}>
                <Input
                  type="number"
                  min={1}
                  value={form.perCustomerLimit ?? 1}
                  onChange={(event) =>
                    setForm({ ...form, perCustomerLimit: Number(event.target.value) })
                  }
                  className="tabular"
                />
              </Field>
            </div>

            <Field label={d.product.description} hint={d.common.optional}>
              <Textarea
                rows={2}
                value={form.description ?? ''}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>

            <Switch
              checked={form.isActive ?? true}
              onChange={(value) => setForm({ ...form, isActive: value })}
              label={d.common.enabled}
            />
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title={deleteTarget && deleteTarget.redemptionCount > 0 ? d.admin.archiveProduct : d.common.delete}
        body={
          deleteTarget && deleteTarget.redemptionCount > 0
            ? `${deleteTarget.code} — ${deleteTarget.redemptionCount} ${d.admin.usedCount.toLowerCase()}`
            : d.admin.confirmDeleteBody
        }
        confirmLabel={d.common.delete}
        cancelLabel={d.common.cancel}
        loading={busy}
      />
    </>
  )
}

// ───────────────────────────── promotions ────────────────────────────────

export interface PromotionRow {
  id: string
  title: string
  subtitle: string | null
  imageKey: string | null
  linkUrl: string | null
  placement: string
  badgeText: string | null
  sortOrder: number
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  categoryId: string | null
  productId: string | null
  translations: Record<string, { title: string; subtitle: string }>
}

const PLACEMENTS = ['HOME_HERO', 'HOME_STRIP', 'CATEGORY_BANNER', 'SIDEBAR'] as const

export function PromotionManager({
  promotions,
  categories,
  canManage,
}: {
  promotions: PromotionRow[]
  categories: { id: string; name: string }[]
  canManage: boolean
}) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [form, setForm] = React.useState<
    | (Omit<Partial<PromotionRow>, 'id'> & {
        id: string | null
        translations: Record<Locale, { title: string; subtitle: string }>
      })
    | null
  >(null)
  const [deleteTarget, setDeleteTarget] = React.useState<PromotionRow | null>(null)
  const [editLocale, setEditLocale] = React.useState<Locale>('mn')
  const [busy, setBusy] = React.useState(false)

  function open(row?: PromotionRow) {
    setEditLocale('mn')
    const blank = { title: '', subtitle: '' }
    setForm(
      row
        ? {
            ...row,
            translations: {
              mn: row.translations.mn ?? blank,
              en: row.translations.en ?? blank,
              ru: row.translations.ru ?? blank,
            },
          }
        : {
            id: null,
            title: '',
            placement: 'HOME_STRIP',
            sortOrder: 0,
            isActive: true,
            translations: { mn: { ...blank }, en: { ...blank }, ru: { ...blank } },
          },
    )
  }

  async function save() {
    if (!form) return
    if (!form.title || form.title.trim().length < 2) {
      toast.warning(d.validation.required)
      return
    }

    setBusy(true)
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle?.trim() || undefined,
        imageKey: form.imageKey?.trim() || undefined,
        linkUrl: form.linkUrl?.trim() || undefined,
        placement: form.placement ?? 'HOME_STRIP',
        badgeText: form.badgeText?.trim() || undefined,
        sortOrder: Number(form.sortOrder ?? 0),
        isActive: form.isActive ?? true,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        categoryId: form.categoryId || null,
        productId: form.productId || null,
        translations: Object.fromEntries(
          LOCALES.map((code) => [
            code,
            {
              title: form.translations[code].title.trim() || undefined,
              subtitle: form.translations[code].subtitle.trim() || undefined,
            },
          ]),
        ),
      }

      if (form.id) {
        await apiFetch(`/api/promotions/${form.id}`, { method: 'PUT', body: payload })
        toast.success(d.admin.saved)
      } else {
        await apiFetch('/api/promotions', { method: 'POST', body: payload })
        toast.success(d.admin.created)
      }
      setForm(null)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: PromotionRow) {
    setBusy(true)
    try {
      await apiFetch(`/api/promotions/${row.id}`, { method: 'DELETE' })
      toast.success(d.admin.deleted)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(false)
      setDeleteTarget(null)
    }
  }

  return (
    <>
      {canManage ? (
        <div className="mb-4">
          <Button size="sm" onClick={() => open()}>
            <Plus className="h-4 w-4" aria-hidden />
            {d.admin.newPromotion}
          </Button>
        </div>
      ) : null}

      {promotions.length === 0 ? (
        <Card>
          <p className="py-10 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {promotions.map((promotion) => (
            <Card key={promotion.id}>
              <div className="flex items-start gap-3.5">
                {promotion.imageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={promotion.imageKey}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <Percent className="h-6 w-6" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink-900">{promotion.title}</span>
                    {promotion.badgeText ? <Badge tone="danger">{promotion.badgeText}</Badge> : null}
                    <Badge tone={promotion.isActive ? 'success' : 'neutral'}>
                      {promotion.isActive ? d.common.active : d.common.inactive}
                    </Badge>
                  </div>
                  {promotion.subtitle ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{promotion.subtitle}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-ink-400 tabular">
                    {promotion.placement} · {d.admin.sortOrder} {promotion.sortOrder}
                    {promotion.endsAt ? ` · → ${formatDate(promotion.endsAt, locale)}` : ''}
                  </p>
                </div>
              </div>

              {canManage ? (
                <div className="mt-3 flex gap-1.5 border-t border-ink-100 pt-3">
                  <Button size="sm" variant="outline" onClick={() => open(promotion)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    {d.common.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setDeleteTarget(promotion)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? d.admin.editPromotion : d.admin.newPromotion}
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
            <Field label={d.common.name} required>
              <Input
                value={form.title ?? ''}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </Field>
            <Field label={d.admin.shortDescription} hint={d.common.optional}>
              <Input
                value={form.subtitle ?? ''}
                onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={d.admin.placement}>
                <Select
                  value={form.placement}
                  onChange={(event) => setForm({ ...form, placement: event.target.value })}
                >
                  {PLACEMENTS.map((placement) => (
                    <option key={placement} value={placement}>
                      {placement}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={d.admin.badgeText} hint={d.common.optional}>
                <Input
                  value={form.badgeText ?? ''}
                  onChange={(event) => setForm({ ...form, badgeText: event.target.value })}
                  placeholder="−15%"
                />
              </Field>
              <Field label={d.admin.imageUrl} hint={d.common.optional}>
                <Input
                  value={form.imageKey ?? ''}
                  onChange={(event) => setForm({ ...form, imageKey: event.target.value })}
                  placeholder="/media/vitamin.svg"
                />
              </Field>
              <Field label={d.admin.linkUrl} hint={d.common.optional}>
                <Input
                  value={form.linkUrl ?? ''}
                  onChange={(event) => setForm({ ...form, linkUrl: event.target.value })}
                  placeholder="/categories/vitamin"
                />
              </Field>
              <Field label={d.product.category} hint={d.common.optional}>
                <Select
                  value={form.categoryId ?? ''}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value || null })}
                >
                  <option value="">{d.common.none}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={d.admin.sortOrder}>
                <Input
                  type="number"
                  value={form.sortOrder ?? 0}
                  onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
                  className="tabular"
                />
              </Field>
            </div>

            <div className="border-t border-ink-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink-900">{d.admin.productNames}</h4>
                <div className="flex gap-1">
                  {LOCALES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setEditLocale(code)}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                        editLocale === code ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600',
                      )}
                    >
                      {LOCALE_META[code].flag} {code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Field label={`${d.common.name} — ${LOCALE_META[editLocale].nativeLabel}`}>
                  <Input
                    value={form.translations[editLocale].title}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        translations: {
                          ...form.translations,
                          [editLocale]: {
                            ...form.translations[editLocale],
                            title: event.target.value,
                          },
                        },
                      })
                    }
                    placeholder={editLocale === 'mn' ? form.title : ''}
                  />
                </Field>
                <Field label={d.admin.shortDescription}>
                  <Input
                    value={form.translations[editLocale].subtitle}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        translations: {
                          ...form.translations,
                          [editLocale]: {
                            ...form.translations[editLocale],
                            subtitle: event.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </div>

            <Switch
              checked={form.isActive ?? true}
              onChange={(value) => setForm({ ...form, isActive: value })}
              label={d.common.enabled}
            />
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title={d.common.delete}
        body={deleteTarget?.title}
        confirmLabel={d.common.delete}
        cancelLabel={d.common.cancel}
        loading={busy}
      />
    </>
  )
}

// ──────────────────────────── review moderation ──────────────────────────

export interface ReviewRow {
  id: string
  rating: number
  title: string | null
  comment: string | null
  status: string
  isVerifiedBuyer: boolean
  createdAt: string
  product: { id: string; name: string; slug: string; sku: string }
  user: { id: string; fullName: string }
}

export function ReviewModeration({
  reviews,
  canModerate,
}: {
  reviews: ReviewRow[]
  canModerate: boolean
}) {
  const { d, locale } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ReviewRow | null>(null)

  async function moderate(review: ReviewRow, status: 'APPROVED' | 'HIDDEN' | 'PENDING') {
    setBusy(review.id)
    try {
      await apiFetch(`/api/reviews/${review.id}`, { method: 'PATCH', body: { status } })
      toast.success(d.admin.saved, status === 'APPROVED' ? d.admin.approveReview : d.admin.hideReview)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(null)
    }
  }

  async function remove(review: ReviewRow) {
    setBusy(review.id)
    try {
      await apiFetch(`/api/reviews/${review.id}`, { method: 'DELETE' })
      toast.success(d.admin.deleted)
      router.refresh()
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setBusy(null)
      setDeleteTarget(null)
    }
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <p className="py-10 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
      </Card>
    )
  }

  return (
    <>
      <Alert tone="info" className="mb-4">
        {d.admin.moderateReviews} — {d.product.noReviews}
      </Alert>

      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating value={review.rating} showValue />
                    <Badge
                      tone={
                        review.status === 'APPROVED'
                          ? 'success'
                          : review.status === 'HIDDEN'
                            ? 'neutral'
                            : 'warning'
                      }
                    >
                      {review.status === 'APPROVED'
                        ? d.common.active
                        : review.status === 'HIDDEN'
                          ? d.admin.hideReview
                          : d.prescription.statusPENDING}
                    </Badge>
                    {review.isVerifiedBuyer ? (
                      <Badge tone="brand">{d.admin.verifiedBuyer}</Badge>
                    ) : null}
                  </div>

                  {review.title ? (
                    <p className="mt-1.5 text-sm font-semibold text-ink-900">{review.title}</p>
                  ) : null}
                  {review.comment ? (
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{review.comment}</p>
                  ) : null}

                  <p className="mt-2 text-xs text-ink-400">
                    {review.user.fullName} · {formatDateTime(review.createdAt, locale)} ·{' '}
                    <Link
                      href={`/admin/products/${review.product.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {review.product.name}
                    </Link>
                  </p>
                </div>

                {canModerate ? (
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {review.status !== 'APPROVED' ? (
                      <Button
                        size="sm"
                        variant="success"
                        loading={busy === review.id}
                        onClick={() => moderate(review, 'APPROVED')}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        {d.admin.approveReview}
                      </Button>
                    ) : null}
                    {review.status !== 'HIDDEN' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busy === review.id}
                        onClick={() => moderate(review, 'HIDDEN')}
                      >
                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                        {d.admin.hideReview}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busy === review.id}
                        onClick={() => moderate(review, 'PENDING')}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        {d.prescription.statusPENDING}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => setDeleteTarget(review)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title={d.admin.confirmDelete}
        body={deleteTarget?.comment ?? undefined}
        confirmLabel={d.common.delete}
        cancelLabel={d.common.cancel}
        loading={busy !== null}
      />
    </>
  )
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-400">{label}</dt>
      <dd className="font-medium text-ink-800 tabular">{value}</dd>
    </div>
  )
}
