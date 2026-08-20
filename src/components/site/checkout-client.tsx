'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Banknote,
  Building2,
  Check,
  CreditCard,
  FileText,
  Package,
  QrCode,
  Store,
  Truck,
  User,
} from 'lucide-react'

import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Radio, Select, Textarea } from '@/components/ui/field'
import { useCartCount, useI18n, useLocalePath } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { UB_DISTRICTS } from '@/lib/constants'
import { cn, formatMnt, normalizePhone } from '@/lib/utils'
import type { CartSummary } from '@/lib/cart'

interface SavedAddress {
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

interface Props {
  cart: CartSummary
  user: { fullName: string; phone: string; email: string | null } | null
  addresses: SavedAddress[]
  paymentMethods: string[]
  bankDetails: { bank: string; account: string; holder: string }
  deliveryFee: number
  freeDeliveryThreshold: number
}

type Step = 1 | 2 | 3

/**
 * Three-step checkout: customer → delivery → payment.
 *
 * Steps are validated as the customer advances, so an error never surfaces only
 * at the final submit. The order total is recalculated by the server on submit —
 * the figures here are for display.
 */
export function CheckoutClient({
  cart,
  user,
  addresses,
  paymentMethods,
  bankDetails,
  deliveryFee,
  freeDeliveryThreshold,
}: Props) {
  const { d, locale } = useI18n()
  const localePath = useLocalePath()
  const toast = useToast()
  const cartBadge = useCartCount()

  const [step, setStep] = React.useState<Step>(1)
  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0]

  const [form, setForm] = React.useState({
    customerName: user?.fullName ?? '',
    customerPhone: user?.phone ?? '',
    customerEmail: user?.email ?? '',
    deliveryMethod: 'HOME_DELIVERY' as 'HOME_DELIVERY' | 'PHARMACY_PICKUP',
    addressId: defaultAddress?.id ?? 'new',
    district: defaultAddress?.district ?? '',
    khoroo: defaultAddress?.khoroo ?? '',
    addressLine: defaultAddress?.addressLine ?? '',
    instructions: defaultAddress?.instructions ?? '',
    saveAddress: false,
    paymentMethod: (paymentMethods[0] ?? 'CASH_ON_DELIVERY') as
      | 'CASH_ON_DELIVERY'
      | 'BANK_TRANSFER'
      | 'CARD'
      | 'QPAY',
    customerNote: '',
    agreeTerms: false,
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[key as string]
      return next
    })
  }

  function pickSavedAddress(id: string) {
    const address = addresses.find((a) => a.id === id)
    setForm((current) => ({
      ...current,
      addressId: id,
      ...(address
        ? {
            district: address.district,
            khoroo: address.khoroo,
            addressLine: address.addressLine,
            instructions: address.instructions ?? '',
          }
        : { district: '', khoroo: '', addressLine: '', instructions: '' }),
    }))
  }

  function validateStep(target: Step): boolean {
    const next: Record<string, string> = {}

    if (target >= 1) {
      if (form.customerName.trim().length < 2) next.customerName = d.validation.required
      if (normalizePhone(form.customerPhone).length !== 8) next.customerPhone = d.validation.invalidPhone
      if (form.customerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.customerEmail)) {
        next.customerEmail = d.validation.invalidEmail
      }
    }

    if (target >= 2 && form.deliveryMethod === 'HOME_DELIVERY') {
      if (!form.district) next.district = d.validation.selectOption
      if (!form.khoroo.trim()) next.khoroo = d.validation.required
      if (form.addressLine.trim().length < 4) next.addressLine = d.validation.required
    }

    if (target >= 3) {
      if (!form.agreeTerms) next.agreeTerms = d.validation.agreeRequired
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  function goTo(target: Step) {
    // Moving forward requires the preceding steps to be valid.
    if (target > step && !validateStep((target - 1) as Step)) {
      toast.warning(d.errors.validationFailed)
      return
    }
    setStep(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit() {
    if (!validateStep(3)) {
      toast.warning(d.errors.validationFailed)
      return
    }

    setSubmitting(true)
    try {
      const result = await apiFetch<{
        orderId: string
        orderNumber: string
        total: number
        requiresPrescription: boolean
        payment: { redirectUrl?: string; qrText?: string; instructions?: Record<string, string> }
      }>('/api/orders', {
        method: 'POST',
        body: {
          customerName: form.customerName.trim(),
          customerPhone: normalizePhone(form.customerPhone),
          customerEmail: form.customerEmail.trim() || undefined,
          deliveryMethod: form.deliveryMethod,
          district: form.deliveryMethod === 'HOME_DELIVERY' ? form.district : undefined,
          khoroo: form.deliveryMethod === 'HOME_DELIVERY' ? form.khoroo.trim() : undefined,
          addressLine: form.deliveryMethod === 'HOME_DELIVERY' ? form.addressLine.trim() : undefined,
          instructions: form.instructions.trim() || undefined,
          saveAddress: form.saveAddress && form.addressId === 'new',
          paymentMethod: form.paymentMethod,
          customerNote: form.customerNote.trim() || undefined,
          couponCode: cart.couponCode ?? undefined,
          agreeTerms: true,
        },
      })

      cartBadge.setCount(0)

      if (result.payment.redirectUrl) {
        window.location.href = result.payment.redirectUrl
        return
      }

      window.location.href = `${localePath('/checkout/success')}?order=${encodeURIComponent(
        result.orderNumber,
      )}&id=${result.orderId}`
    } catch (error) {
      if (error instanceof ApiClientError) {
        const detail = error.details as { productName?: string; available?: number } | undefined
        if (error.code === 'INSUFFICIENT_STOCK') {
          toast.error(
            d.validation.insufficientStock,
            detail?.productName ? `${detail.productName} — ${detail.available}` : undefined,
          )
        } else if (error.code === 'EXPIRED_PRODUCT') {
          toast.error(d.validation.expiredProduct, detail?.productName)
        } else if (error.code === 'EMPTY_CART') {
          toast.error(d.checkout.emptyCartRedirect)
        } else if (error.code === 'COUPON_INVALID') {
          toast.error(d.cart.couponInvalid)
        } else if (error.code === 'VALIDATION_FAILED') {
          toast.error(d.errors.validationFailed)
        } else {
          toast.error(d.errors.generic, error.message)
        }
      } else {
        toast.error(d.errors.network)
      }
      setSubmitting(false)
    }
  }

  const isPickup = form.deliveryMethod === 'PHARMACY_PICKUP'
  const effectiveDeliveryFee =
    isPickup || cart.subtotal - cart.discountTotal >= freeDeliveryThreshold ? 0 : deliveryFee
  const displayTotal = cart.subtotal - cart.discountTotal + effectiveDeliveryFee + cart.taxTotal

  const steps = [
    { n: 1 as Step, label: d.checkout.stepShort1, full: d.checkout.step1, icon: User },
    { n: 2 as Step, label: d.checkout.stepShort2, full: d.checkout.step2, icon: Truck },
    { n: 3 as Step, label: d.checkout.stepShort3, full: d.checkout.step3, icon: CreditCard },
  ]

  const paymentConfig: Record<string, { label: string; desc: string; icon: React.ReactNode }> = {
    CASH_ON_DELIVERY: {
      label: d.checkout.cashOnDelivery,
      desc: d.checkout.cashOnDeliveryDesc,
      icon: <Banknote className="h-4 w-4" />,
    },
    BANK_TRANSFER: {
      label: d.checkout.bankTransfer,
      desc: d.checkout.bankTransferDesc,
      icon: <Building2 className="h-4 w-4" />,
    },
    CARD: { label: d.checkout.card, desc: d.checkout.cardDesc, icon: <CreditCard className="h-4 w-4" /> },
    QPAY: { label: d.checkout.qpay, desc: d.checkout.qpayDesc, icon: <QrCode className="h-4 w-4" /> },
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        {/* Stepper */}
        <ol className="mb-6 flex items-center">
          {steps.map((item, index) => (
            <li key={item.n} className={cn('flex items-center', index < steps.length - 1 && 'flex-1')}>
              <button
                type="button"
                onClick={() => (item.n < step ? goTo(item.n) : undefined)}
                disabled={item.n > step}
                className="flex items-center gap-2.5 text-left disabled:cursor-default"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors',
                    item.n < step
                      ? 'bg-brand-500 text-white'
                      : item.n === step
                        ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                        : 'bg-ink-100 text-ink-400',
                  )}
                >
                  {item.n < step ? <Check className="h-4 w-4" aria-hidden /> : item.n}
                </span>
                <span className="hidden sm:block">
                  <span
                    className={cn(
                      'block text-xs font-medium',
                      item.n <= step ? 'text-brand-700' : 'text-ink-400',
                    )}
                  >
                    {d.checkout.title} {item.n}
                  </span>
                  <span
                    className={cn(
                      'block text-sm font-semibold',
                      item.n <= step ? 'text-ink-900' : 'text-ink-400',
                    )}
                  >
                    {item.label}
                  </span>
                </span>
              </button>
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    'mx-3 h-0.5 flex-1 rounded-full transition-colors',
                    item.n < step ? 'bg-brand-400' : 'bg-ink-200',
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ol>

        {/* Step 1 — customer */}
        {step === 1 ? (
          <Card>
            <h2 className="mb-4 text-base font-semibold text-ink-900">{d.checkout.step1}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={d.checkout.fullName}
                required
                error={errors.customerName}
                className="sm:col-span-2"
              >
                <Input
                  value={form.customerName}
                  onChange={(event) => set('customerName', event.target.value)}
                  placeholder={d.checkout.fullNamePlaceholder}
                  invalid={Boolean(errors.customerName)}
                  autoComplete="name"
                />
              </Field>

              <Field label={d.checkout.phone} required error={errors.customerPhone}>
                <Input
                  value={form.customerPhone}
                  onChange={(event) => set('customerPhone', event.target.value)}
                  placeholder={d.checkout.phonePlaceholder}
                  invalid={Boolean(errors.customerPhone)}
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={12}
                />
              </Field>

              <Field
                label={d.checkout.email}
                hint={d.common.optional}
                error={errors.customerEmail}
              >
                <Input
                  type="email"
                  value={form.customerEmail}
                  onChange={(event) => set('customerEmail', event.target.value)}
                  placeholder={d.checkout.emailPlaceholder}
                  invalid={Boolean(errors.customerEmail)}
                  autoComplete="email"
                />
              </Field>
            </div>

            {!user ? (
              <Alert tone="info" className="mt-4">
                {d.auth.noAccount}{' '}
                <Link href={localePath('/login')} className="font-semibold underline">
                  {d.nav.login}
                </Link>{' '}
                — {d.account.orderHistory}, {d.account.addresses}.
              </Alert>
            ) : null}

            <div className="mt-6 flex justify-end">
              <Button size="lg" onClick={() => goTo(2)}>
                {d.common.next} →
              </Button>
            </div>
          </Card>
        ) : null}

        {/* Step 2 — delivery */}
        {step === 2 ? (
          <Card>
            <h2 className="mb-4 text-base font-semibold text-ink-900">{d.checkout.step2}</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <Radio
                name="deliveryMethod"
                checked={form.deliveryMethod === 'HOME_DELIVERY'}
                onChange={() => set('deliveryMethod', 'HOME_DELIVERY')}
                label={d.checkout.homeDelivery}
                description={d.checkout.homeDeliveryDesc}
                icon={<Truck className="h-4 w-4" />}
              />
              <Radio
                name="deliveryMethod"
                checked={form.deliveryMethod === 'PHARMACY_PICKUP'}
                onChange={() => set('deliveryMethod', 'PHARMACY_PICKUP')}
                label={d.checkout.pickup}
                description={d.checkout.pickupDesc}
                icon={<Store className="h-4 w-4" />}
              />
            </div>

            {form.deliveryMethod === 'HOME_DELIVERY' ? (
              <div className="mt-5 space-y-4">
                {addresses.length > 0 ? (
                  <Field label={d.checkout.savedAddresses}>
                    <Select value={form.addressId} onChange={(event) => pickSavedAddress(event.target.value)}>
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label ? `${address.label} — ` : ''}
                          {address.district}, {address.khoroo}, {address.addressLine}
                        </option>
                      ))}
                      <option value="new">{d.checkout.useNewAddress}</option>
                    </Select>
                  </Field>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={d.checkout.district} required error={errors.district}>
                    <Select
                      value={form.district}
                      onChange={(event) => set('district', event.target.value)}
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
                      onChange={(event) => set('khoroo', event.target.value)}
                      placeholder={d.checkout.khorooPlaceholder}
                      invalid={Boolean(errors.khoroo)}
                    />
                  </Field>

                  <Field
                    label={d.checkout.addressLine}
                    required
                    error={errors.addressLine}
                    className="sm:col-span-2"
                  >
                    <Input
                      value={form.addressLine}
                      onChange={(event) => set('addressLine', event.target.value)}
                      placeholder={d.checkout.addressPlaceholder}
                      invalid={Boolean(errors.addressLine)}
                      autoComplete="street-address"
                    />
                  </Field>

                  <Field
                    label={d.checkout.instructions}
                    hint={d.common.optional}
                    className="sm:col-span-2"
                  >
                    <Textarea
                      rows={2}
                      value={form.instructions}
                      onChange={(event) => set('instructions', event.target.value)}
                      placeholder={d.checkout.instructionsPlaceholder}
                    />
                  </Field>
                </div>

                {user && form.addressId === 'new' ? (
                  <Checkbox
                    checked={form.saveAddress}
                    onChange={(event) => set('saveAddress', event.target.checked)}
                    label={d.checkout.saveAddress}
                  />
                ) : null}
              </div>
            ) : (
              <Alert tone="brand" className="mt-5" title={d.checkout.pickup}>
                {d.checkout.pickupDesc}
              </Alert>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="outline" size="lg" onClick={() => goTo(1)}>
                ← {d.common.back}
              </Button>
              <Button size="lg" onClick={() => goTo(3)}>
                {d.common.next} →
              </Button>
            </div>
          </Card>
        ) : null}

        {/* Step 3 — payment */}
        {step === 3 ? (
          <Card>
            <h2 className="mb-4 text-base font-semibold text-ink-900">{d.checkout.step3}</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {paymentMethods.map((method) => {
                const config = paymentConfig[method]
                if (!config) return null
                return (
                  <Radio
                    key={method}
                    name="paymentMethod"
                    checked={form.paymentMethod === method}
                    onChange={() => set('paymentMethod', method as typeof form.paymentMethod)}
                    label={config.label}
                    description={config.desc}
                    icon={config.icon}
                  />
                )
              })}
            </div>

            {form.paymentMethod === 'BANK_TRANSFER' ? (
              <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50/60 p-4">
                <p className="mb-2.5 text-sm font-semibold text-ink-900">{d.checkout.bankDetails}</p>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">{d.checkout.bankName}</dt>
                    <dd className="font-medium text-ink-900">{bankDetails.bank || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">{d.checkout.bankAccount}</dt>
                    <dd className="font-medium text-ink-900 tabular">{bankDetails.account || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">{d.checkout.bankHolder}</dt>
                    <dd className="font-medium text-ink-900">{bankDetails.holder || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-ink-200 pt-1.5">
                    <dt className="text-ink-500">{d.checkout.bankReference}</dt>
                    <dd className="font-semibold text-brand-700">{d.checkout.orderNumber}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <Field label={d.checkout.customerNote} hint={d.common.optional} className="mt-5">
              <Textarea
                rows={2}
                value={form.customerNote}
                onChange={(event) => set('customerNote', event.target.value)}
                placeholder={d.checkout.customerNotePlaceholder}
              />
            </Field>

            {cart.requiresPrescription ? (
              <Alert tone="warning" className="mt-5" title={d.checkout.prescriptionRequiredTitle}>
                {d.checkout.prescriptionRequiredBody}
              </Alert>
            ) : null}

            <div className="mt-5">
              <Checkbox
                checked={form.agreeTerms}
                onChange={(event) => set('agreeTerms', event.target.checked)}
                label={
                  <span>
                    {d.checkout.agreeTerms}{' '}
                    <Link href={localePath('/terms')} className="text-brand-700 underline">
                      {d.footer.terms}
                    </Link>
                  </span>
                }
              />
              {errors.agreeTerms ? (
                <p className="error-text" role="alert">
                  {errors.agreeTerms}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" size="lg" onClick={() => goTo(2)} disabled={submitting}>
                ← {d.common.back}
              </Button>
              <Button size="lg" onClick={submit} loading={submitting}>
                {submitting ? d.checkout.placingOrder : d.checkout.placeOrder}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      {/* Order summary */}
      <div>
        <Card className="lg:sticky lg:top-32">
          <h2 className="text-base font-semibold text-ink-900">{d.checkout.orderSummary}</h2>

          <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1 scroll-thin">
            {cart.lines.map((line) => (
              <li key={line.productId} className="flex gap-2.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50">
                  {line.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-4 w-4 text-ink-300" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink-900">{line.name}</span>
                  <span className="block text-xs text-ink-400 tabular">
                    {line.quantity} × {formatMnt(line.unitPrice, locale)}
                  </span>
                  {line.prescriptionRequired ? (
                    <Badge tone="rx" className="mt-0.5">
                      {d.product.prescriptionRequiredShort}
                    </Badge>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs font-semibold text-ink-900 tabular">
                  {formatMnt(line.lineTotal, locale)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">{d.cart.subtotal}</dt>
              <dd className="font-medium text-ink-900 tabular">{formatMnt(cart.subtotal, locale)}</dd>
            </div>
            {cart.discountTotal > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-500">
                  {d.cart.discount}
                  {cart.couponCode ? ` (${cart.couponCode})` : ''}
                </dt>
                <dd className="font-semibold text-success tabular">
                  −{formatMnt(cart.discountTotal, locale)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">{d.cart.deliveryFee}</dt>
              <dd
                className={
                  effectiveDeliveryFee === 0
                    ? 'font-semibold text-success tabular'
                    : 'font-medium text-ink-900 tabular'
                }
              >
                {effectiveDeliveryFee === 0 ? d.cart.freeDelivery : formatMnt(effectiveDeliveryFee, locale)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-4">
            <span className="text-sm font-semibold text-ink-700">{d.cart.total}</span>
            <span className="text-2xl font-extrabold text-ink-900 tabular">
              {formatMnt(displayTotal, locale)}
            </span>
          </div>

          {cart.requiresPrescription ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p className="text-[11px] leading-relaxed text-amber-900">
                {d.prescription.awaitingVerification} — {d.prescription.safetyNotice}
              </p>
            </div>
          ) : null}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {d.footer.disclaimer}
          </p>
        </Card>
      </div>
    </div>
  )
}
