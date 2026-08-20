'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Package, Plus, Trash2, Upload, X } from 'lucide-react'

import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Switch, Textarea } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/ui/dialog'
import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { LOCALES, LOCALE_META, type Locale } from '@/lib/locale-types'
import type {
  ProductFormOption,
  ProductFormValues,
  ProductTranslationInput,
} from '@/lib/product-form-types'
import { cn, slugify } from '@/lib/utils'

type Tab = 'basics' | 'pricing' | 'pharmacy' | 'media' | 'seo'

/**
 * Product editor.
 *
 * Grouped into tabs so the ~40 fields stay navigable, with the pharmacy-safety
 * fields (prescription flag, warnings, expiry) on their own tab rather than
 * buried among commerce settings.
 */
export function ProductForm({
  initial,
  productId,
  categories,
  brands,
  manufacturers,
  relatedOptions,
  canDelete,
  hasOrderHistory,
}: {
  initial: ProductFormValues
  productId?: string
  categories: ProductFormOption[]
  brands: ProductFormOption[]
  manufacturers: ProductFormOption[]
  relatedOptions: { id: string; name: string; sku: string }[]
  canDelete: boolean
  hasOrderHistory: boolean
}) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [values, setValues] = React.useState<ProductFormValues>(initial)
  const [tab, setTab] = React.useState<Tab>('basics')
  const [translationLocale, setTranslationLocale] = React.useState<Locale>('mn')
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[key as string]
      return next
    })
  }

  function setTranslation(locale: Locale, key: keyof ProductTranslationInput, value: string) {
    setValues((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...current.translations[locale], [key]: value },
      },
    }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!/^[A-Za-z0-9\-_]{2,40}$/.test(values.sku)) next.sku = 'SKU: A-Z, 0-9, -, _'
    if (values.name.trim().length < 2) next.name = d.validation.required
    if (!values.categoryId) next.categoryId = d.validation.selectOption
    const price = Number(values.price)
    if (!Number.isFinite(price) || price < 0) next.price = d.validation.invalidNumber
    if (values.discountPrice) {
      const discount = Number(values.discountPrice)
      if (!Number.isFinite(discount) || discount <= 0) next.discountPrice = d.validation.invalidNumber
      else if (discount >= price) next.discountPrice = d.validation.maxValue.replace('{max}', values.price)
    }
    setErrors(next)
    if (Object.keys(next).length) {
      // Jump to the tab holding the first problem so the error is visible.
      if (next.sku || next.name || next.categoryId) setTab('basics')
      else if (next.price || next.discountPrice) setTab('pricing')
      return false
    }
    return true
  }

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('folder', 'products')
      const result = await apiFetch<{ fileKey: string; url: string }>('/api/uploads', {
        method: 'POST',
        formData: body,
      })
      set('images', [...values.images, { fileKey: result.fileKey, alt: values.name }])
      toast.success(d.admin.addImage)
    } catch (error) {
      const code = error instanceof ApiClientError ? error.code : ''
      toast.error(
        code === 'FILE_TOO_LARGE'
          ? d.validation.fileTooLarge
          : code === 'FILE_TYPE_INVALID'
            ? d.validation.fileTypeInvalid
            : d.errors.generic,
      )
    } finally {
      setUploading(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate()) {
      toast.warning(d.errors.validationFailed)
      return
    }

    setSaving(true)
    try {
      const payload = {
        sku: values.sku.trim(),
        barcode: values.barcode.trim() || undefined,
        slug: values.slug.trim() || slugify(values.name),
        name: values.name.trim(),
        categoryId: values.categoryId,
        brandId: values.brandId || undefined,
        manufacturerId: values.manufacturerId || undefined,
        prescriptionRequired: values.prescriptionRequired,
        isControlled: values.isControlled,
        price: Number(values.price),
        discountPrice: values.discountPrice ? Number(values.discountPrice) : null,
        costPrice: values.costPrice ? Number(values.costPrice) : null,
        taxRatePct: Number(values.taxRatePct || 0),
        status: values.status,
        isFeatured: values.isFeatured,
        isNew: values.isNew,
        weightGrams: values.weightGrams ? Number(values.weightGrams) : null,
        packageSize: values.packageSize.trim() || undefined,
        dosageForm: values.dosageForm.trim() || undefined,
        strength: values.strength.trim() || undefined,
        expiryDate: values.expiryDate || null,
        registrationNo: values.registrationNo.trim() || undefined,
        metaTitle: values.metaTitle.trim() || undefined,
        metaDescription: values.metaDescription.trim() || undefined,
        stockQuantity: Number(values.stockQuantity || 0),
        lowStockThreshold: Number(values.lowStockThreshold || 10),
        shelfLocation: values.shelfLocation.trim() || undefined,
        images: values.images,
        relatedProductIds: values.relatedProductIds,
        translations: Object.fromEntries(
          LOCALES.map((locale) => [
            locale,
            Object.fromEntries(
              Object.entries(values.translations[locale]).map(([key, value]) => [
                key,
                (value as string).trim() || undefined,
              ]),
            ),
          ]),
        ),
      }

      if (productId) {
        await apiFetch(`/api/products/${productId}`, { method: 'PUT', body: payload })
        toast.success(d.admin.saved)
      } else {
        const result = await apiFetch<{ product: { id: string } }>('/api/products', {
          method: 'POST',
          body: payload,
        })
        toast.success(d.admin.created)
        router.push(`/admin/products/${result.product.id}`)
        return
      }
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.code === 'SKU_TAKEN') {
          setErrors({ sku: 'SKU' })
          setTab('basics')
          toast.error(d.errors.validationFailed, 'SKU')
        } else if (error.code === 'BARCODE_TAKEN') {
          setErrors({ barcode: d.product.barcode })
          setTab('basics')
          toast.error(d.errors.validationFailed, d.product.barcode)
        } else if (error.code === 'VALIDATION_FAILED') {
          const details = (error.details ?? []) as { path: string; message: string }[]
          setErrors(Object.fromEntries(details.map((issue) => [issue.path, issue.message])))
          toast.error(d.errors.validationFailed, details.map((i) => i.path).join(', '))
        } else {
          toast.error(d.errors.generic, error.message)
        }
      } else {
        toast.error(d.errors.network)
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!productId) return
    setSaving(true)
    try {
      const result = await apiFetch<{ archived: boolean }>(`/api/products/${productId}`, {
        method: 'DELETE',
      })
      toast.success(result.archived ? d.admin.archived : d.admin.deleted)
      router.push('/admin/products')
    } catch {
      toast.error(d.errors.generic)
    } finally {
      setSaving(false)
      setDeleteOpen(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basics', label: d.admin.productBasics },
    { key: 'pricing', label: d.admin.productPricing },
    { key: 'pharmacy', label: d.admin.productPharmacy },
    { key: 'media', label: d.admin.productMedia },
    { key: 'seo', label: d.admin.productSeo },
  ]

  return (
    <form onSubmit={submit}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {/* Tabs */}
          <div className="mb-4 flex overflow-x-auto rounded-xl border border-ink-200 bg-white p-1 no-scrollbar">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  'shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  tab === item.key
                    ? 'bg-brand-500 text-white'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'basics' ? (
            <Card className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SKU" required error={errors.sku}>
                  <Input
                    value={values.sku}
                    onChange={(event) => set('sku', event.target.value.toUpperCase())}
                    invalid={Boolean(errors.sku)}
                    placeholder="ILK-PAR-500"
                    className="tabular"
                  />
                </Field>
                <Field label={d.product.barcode} hint={d.common.optional} error={errors.barcode}>
                  <Input
                    value={values.barcode}
                    onChange={(event) => set('barcode', event.target.value)}
                    invalid={Boolean(errors.barcode)}
                    className="tabular"
                  />
                </Field>
              </div>

              <Field
                label={`${d.common.name} (${LOCALE_META.mn.nativeLabel})`}
                required
                error={errors.name}
              >
                <Input
                  value={values.name}
                  onChange={(event) => {
                    set('name', event.target.value)
                    if (!productId) set('slug', slugify(event.target.value))
                  }}
                  invalid={Boolean(errors.name)}
                />
              </Field>

              <Field label="Slug (URL)" hint="/products/…">
                <Input
                  value={values.slug}
                  onChange={(event) => set('slug', slugify(event.target.value))}
                  className="tabular"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={d.product.category} required error={errors.categoryId}>
                  <Select
                    value={values.categoryId}
                    onChange={(event) => set('categoryId', event.target.value)}
                    invalid={Boolean(errors.categoryId)}
                  >
                    <option value="">{d.validation.selectOption}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={d.product.brand} hint={d.common.optional}>
                  <Select value={values.brandId} onChange={(event) => set('brandId', event.target.value)}>
                    <option value="">{d.common.none}</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={d.product.manufacturer} hint={d.common.optional}>
                  <Select
                    value={values.manufacturerId}
                    onChange={(event) => set('manufacturerId', event.target.value)}
                  >
                    <option value="">{d.common.none}</option>
                    {manufacturers.map((manufacturer) => (
                      <option key={manufacturer.id} value={manufacturer.id}>
                        {manufacturer.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Multilingual names + copy */}
              <div className="border-t border-ink-100 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink-900">{d.admin.productNames}</h3>
                  <div className="flex gap-1">
                    {LOCALES.map((locale) => (
                      <button
                        key={locale}
                        type="button"
                        onClick={() => setTranslationLocale(locale)}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                          translationLocale === locale
                            ? 'bg-brand-500 text-white'
                            : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
                        )}
                      >
                        {LOCALE_META[locale].flag} {locale.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Field label={`${d.common.name} — ${LOCALE_META[translationLocale].nativeLabel}`}>
                    <Input
                      value={values.translations[translationLocale].name}
                      onChange={(event) => setTranslation(translationLocale, 'name', event.target.value)}
                      placeholder={translationLocale === 'mn' ? values.name : ''}
                    />
                  </Field>
                  <Field label={d.admin.shortDescription}>
                    <Textarea
                      rows={2}
                      value={values.translations[translationLocale].shortDescription}
                      onChange={(event) =>
                        setTranslation(translationLocale, 'shortDescription', event.target.value)
                      }
                    />
                  </Field>
                  <Field label={d.product.description}>
                    <Textarea
                      rows={5}
                      value={values.translations[translationLocale].description}
                      onChange={(event) =>
                        setTranslation(translationLocale, 'description', event.target.value)
                      }
                    />
                  </Field>
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  {LOCALE_META.mn.nativeLabel} → {LOCALE_META.en.nativeLabel} /{' '}
                  {LOCALE_META.ru.nativeLabel}
                </p>
              </div>
            </Card>
          ) : null}

          {tab === 'pricing' ? (
            <Card className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={`${d.common.price} (₮)`} required error={errors.price}>
                  <Input
                    type="number"
                    min={0}
                    value={values.price}
                    onChange={(event) => set('price', event.target.value)}
                    invalid={Boolean(errors.price)}
                    className="tabular"
                  />
                </Field>
                <Field
                  label={`${d.product.discountBadge} (₮)`}
                  hint={d.common.optional}
                  error={errors.discountPrice}
                >
                  <Input
                    type="number"
                    min={0}
                    value={values.discountPrice}
                    onChange={(event) => set('discountPrice', event.target.value)}
                    invalid={Boolean(errors.discountPrice)}
                    className="tabular"
                  />
                </Field>
                <Field label="Cost (₮)" hint={d.common.optional}>
                  <Input
                    type="number"
                    min={0}
                    value={values.costPrice}
                    onChange={(event) => set('costPrice', event.target.value)}
                    className="tabular"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={`${d.admin.currentStock}`}>
                  <Input
                    type="number"
                    min={0}
                    value={values.stockQuantity}
                    onChange={(event) => set('stockQuantity', event.target.value)}
                    className="tabular"
                  />
                </Field>
                <Field label={d.admin.lowStockThreshold}>
                  <Input
                    type="number"
                    min={0}
                    value={values.lowStockThreshold}
                    onChange={(event) => set('lowStockThreshold', event.target.value)}
                    className="tabular"
                  />
                </Field>
                <Field label={`${d.admin.taxRate} (%)`}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={values.taxRatePct}
                    onChange={(event) => set('taxRatePct', event.target.value)}
                    className="tabular"
                  />
                </Field>
              </div>

              <Alert tone="info">
                {d.admin.stockAdjustment} — {d.admin.inventoryHistory}
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Shelf" hint={d.common.optional}>
                  <Input
                    value={values.shelfLocation}
                    onChange={(event) => set('shelfLocation', event.target.value)}
                    placeholder="A-01"
                  />
                </Field>
                <Field label={`${d.product.weight} (г)`} hint={d.common.optional}>
                  <Input
                    type="number"
                    min={0}
                    value={values.weightGrams}
                    onChange={(event) => set('weightGrams', event.target.value)}
                    className="tabular"
                  />
                </Field>
              </div>

              {/* Related products */}
              <div className="border-t border-ink-100 pt-4">
                <h3 className="mb-2 text-sm font-semibold text-ink-900">{d.admin.relatedProducts}</h3>
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-ink-200 p-2.5 scroll-thin">
                  {relatedOptions.length === 0 ? (
                    <p className="text-xs text-ink-400">{d.admin.emptyTable}</p>
                  ) : (
                    relatedOptions.map((option) => (
                      <Checkbox
                        key={option.id}
                        checked={values.relatedProductIds.includes(option.id)}
                        onChange={(event) =>
                          set(
                            'relatedProductIds',
                            event.target.checked
                              ? [...values.relatedProductIds, option.id]
                              : values.relatedProductIds.filter((id) => id !== option.id),
                          )
                        }
                        label={
                          <span className="text-xs">
                            {option.name} <span className="text-ink-400 tabular">({option.sku})</span>
                          </span>
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            </Card>
          ) : null}

          {tab === 'pharmacy' ? (
            <Card className="space-y-4">
              <Alert
                tone={values.prescriptionRequired ? 'warning' : 'brand'}
                title={
                  values.prescriptionRequired ? d.product.prescriptionRequired : d.product.otc
                }
              >
                {values.prescriptionRequired ? d.product.prescriptionNotice : d.product.safetyDisclaimer}
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={d.product.dosageForm} hint={d.common.optional}>
                  <Input
                    value={values.dosageForm}
                    onChange={(event) => set('dosageForm', event.target.value)}
                    placeholder="Шахмал / Сироп"
                  />
                </Field>
                <Field label={d.product.strength} hint={d.common.optional}>
                  <Input
                    value={values.strength}
                    onChange={(event) => set('strength', event.target.value)}
                    placeholder="500 мг"
                  />
                </Field>
                <Field label={d.product.packageSize} hint={d.common.optional}>
                  <Input
                    value={values.packageSize}
                    onChange={(event) => set('packageSize', event.target.value)}
                    placeholder="20 шахмал"
                  />
                </Field>
                <Field label={d.product.registrationNo} hint={d.common.optional}>
                  <Input
                    value={values.registrationNo}
                    onChange={(event) => set('registrationNo', event.target.value)}
                    className="tabular"
                  />
                </Field>
                <Field label={d.product.expiryDate} hint={d.common.optional} className="sm:col-span-2">
                  <Input
                    type="date"
                    value={values.expiryDate}
                    onChange={(event) => set('expiryDate', event.target.value)}
                  />
                </Field>
              </div>

              <div className="border-t border-ink-100 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink-900">{d.admin.productPharmacy}</h3>
                  <div className="flex gap-1">
                    {LOCALES.map((locale) => (
                      <button
                        key={locale}
                        type="button"
                        onClick={() => setTranslationLocale(locale)}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                          translationLocale === locale
                            ? 'bg-brand-500 text-white'
                            : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
                        )}
                      >
                        {LOCALE_META[locale].flag} {locale.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {(
                    [
                      ['activeIngredients', d.product.activeIngredients, 2],
                      ['ingredients', d.product.ingredients, 3],
                      ['dosage', d.product.dosage, 3],
                      ['usage', d.product.usage, 3],
                      ['warnings', d.product.warnings, 4],
                      ['sideEffects', d.product.sideEffects, 3],
                      ['storage', d.product.storage, 2],
                    ] as [keyof ProductTranslationInput, string, number][]
                  ).map(([key, label, rows]) => (
                    <Field key={key} label={label}>
                      <Textarea
                        rows={rows}
                        value={values.translations[translationLocale][key]}
                        onChange={(event) => setTranslation(translationLocale, key, event.target.value)}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          {tab === 'media' ? (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) uploadImage(file)
                      event.target.value = ''
                    }}
                  />
                  <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-300 bg-white px-4 text-sm font-medium text-ink-800 transition-colors hover:border-brand-400">
                    <Upload className="h-4 w-4" aria-hidden />
                    {uploading ? d.common.loading : d.admin.addImage}
                  </span>
                </label>
                <p className="text-xs text-ink-400">JPG, PNG, WEBP — 10MB</p>
              </div>

              {/* Manual URL entry, useful for images already hosted elsewhere */}
              <Field label={d.admin.imageUrl} hint={d.common.optional}>
                <div className="flex gap-2">
                  <Input
                    id="image-url-input"
                    placeholder="/media/pill.svg"
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      const input = event.currentTarget
                      if (input.value.trim()) {
                        set('images', [...values.images, { fileKey: input.value.trim(), alt: values.name }])
                        input.value = ''
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById('image-url-input') as HTMLInputElement | null
                      if (input?.value.trim()) {
                        set('images', [...values.images, { fileKey: input.value.trim(), alt: values.name }])
                        input.value = ''
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </Field>

              {values.images.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-ink-200 py-10 text-center">
                  <ImageIcon className="h-8 w-8 text-ink-300" aria-hidden />
                  <p className="mt-2 text-sm text-ink-400">{d.admin.emptyTable}</p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {values.images.map((image, index) => (
                    <li key={index} className="relative">
                      <div className="aspect-square overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            image.fileKey.startsWith('http') || image.fileKey.startsWith('/')
                              ? image.fileKey
                              : `/api/files/${image.fileKey}`
                          }
                          alt={image.alt}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {index === 0 ? (
                        <Badge tone="brand" className="absolute left-2 top-2">
                          {d.admin.primaryImage}
                        </Badge>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            'images',
                            values.images.filter((_, position) => position !== index),
                          )
                        }
                        className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-ink-500 shadow-sm transition-colors hover:text-danger"
                        aria-label={d.common.delete}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <Input
                        value={image.alt}
                        onChange={(event) =>
                          set(
                            'images',
                            values.images.map((item, position) =>
                              position === index ? { ...item, alt: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder="alt"
                        className="mt-1.5 h-9 text-xs"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {tab === 'seo' ? (
            <Card className="space-y-4">
              <Field label={d.admin.metaTitle} hint="≤ 60">
                <Input
                  value={values.metaTitle}
                  onChange={(event) => set('metaTitle', event.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field label={d.admin.metaDescription} hint="≤ 160">
                <Textarea
                  rows={3}
                  value={values.metaDescription}
                  onChange={(event) => set('metaDescription', event.target.value)}
                  maxLength={400}
                />
              </Field>
              <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3.5">
                <p className="text-xs text-ink-400">Preview</p>
                <p className="mt-1 truncate text-sm font-medium text-accent-700">
                  {values.metaTitle || values.name || '—'}
                </p>
                <p className="text-xs text-brand-700">
                  /{'{locale}'}/products/{values.slug || slugify(values.name) || '…'}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">
                  {values.metaDescription ||
                    values.translations.mn.shortDescription ||
                    d.meta.defaultDescription}
                </p>
              </div>
            </Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="space-y-4">
            <Field label={d.admin.statusLabel}>
              <Select
                value={values.status}
                onChange={(event) => set('status', event.target.value as ProductFormValues['status'])}
              >
                <option value="ACTIVE">{d.common.active}</option>
                <option value="DRAFT">DRAFT</option>
                <option value="INACTIVE">{d.common.inactive}</option>
                <option value="ARCHIVED">{d.admin.archived}</option>
              </Select>
            </Field>

            <div className="space-y-3 border-t border-ink-100 pt-4">
              <Switch
                checked={values.prescriptionRequired}
                onChange={(value) => set('prescriptionRequired', value)}
                label={d.admin.prescriptionRequiredLabel}
                description={d.home.prescriptionSubtitle}
              />
              <Switch
                checked={values.isControlled}
                onChange={(value) => set('isControlled', value)}
                label="Controlled"
                description={d.product.prescriptionNotice.slice(0, 60)}
              />
              <Switch
                checked={values.isFeatured}
                onChange={(value) => set('isFeatured', value)}
                label={d.admin.featuredLabel}
              />
              <Switch
                checked={values.isNew}
                onChange={(value) => set('isNew', value)}
                label={d.admin.newLabel}
              />
            </div>

            <div className="space-y-2 border-t border-ink-100 pt-4">
              <Button type="submit" fullWidth loading={saving}>
                {productId ? d.common.save : d.common.create}
              </Button>
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => router.push('/admin/products')}
                disabled={saving}
              >
                {d.common.cancel}
              </Button>
              {productId && canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  className="text-danger"
                  onClick={() => setDeleteOpen(true)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {hasOrderHistory ? d.admin.archiveProduct : d.admin.deleteProduct}
                </Button>
              ) : null}
            </div>
          </Card>

          {values.prescriptionRequired ? (
            <Alert tone="warning" title={d.product.prescriptionRequired}>
              {d.admin.verifyOnlyPharmacist}
            </Alert>
          ) : null}

          <Card>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Package className="h-4 w-4 text-ink-400" aria-hidden />
              {d.admin.productBasics}
            </h3>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">SKU</dt>
                <dd className="font-medium text-ink-900 tabular">{values.sku || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">{d.common.price}</dt>
                <dd className="font-medium text-ink-900 tabular">
                  {values.discountPrice || values.price || '—'}₮
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">{d.admin.currentStock}</dt>
                <dd className="font-medium text-ink-900 tabular">{values.stockQuantity}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">{d.admin.productMedia}</dt>
                <dd className="font-medium text-ink-900 tabular">{values.images.length}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title={hasOrderHistory ? d.admin.archiveProduct : d.admin.deleteProduct}
        body={d.admin.deleteProductConfirm}
        confirmLabel={hasOrderHistory ? d.admin.archiveProduct : d.common.delete}
        cancelLabel={d.common.cancel}
        loading={saving}
      />
    </form>
  )
}
