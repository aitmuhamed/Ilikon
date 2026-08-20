'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, GripVertical, Package, Pencil, Plus, Trash2 } from 'lucide-react'

import { Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Modal } from '@/components/ui/dialog'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/field'
import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { apiFetch, ApiClientError } from '@/lib/client-api'
import { LOCALES, LOCALE_META, type Locale } from '@/lib/locale-types'
import { cn, slugify } from '@/lib/utils'

// ───────────────────────────── categories ────────────────────────────────

export interface CategoryRow {
  id: string
  slug: string
  name: string
  parentId: string | null
  imageKey: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
  isFeatured: boolean
  metaTitle: string | null
  metaDescription: string | null
  productCount: number
  childCount: number
  translations: Record<string, { name: string; description: string }>
}

interface CategoryFormState {
  id: string | null
  name: string
  slug: string
  parentId: string
  imageKey: string
  icon: string
  sortOrder: string
  isActive: boolean
  isFeatured: boolean
  metaTitle: string
  metaDescription: string
  translations: Record<Locale, { name: string; description: string }>
}

function blankCategory(): CategoryFormState {
  return {
    id: null,
    name: '',
    slug: '',
    parentId: '',
    imageKey: '',
    icon: '',
    sortOrder: '0',
    isActive: true,
    isFeatured: false,
    metaTitle: '',
    metaDescription: '',
    translations: {
      mn: { name: '', description: '' },
      en: { name: '', description: '' },
      ru: { name: '', description: '' },
    },
  }
}

export function CategoryManager({
  categories,
  canManage,
}: {
  categories: CategoryRow[]
  canManage: boolean
}) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [form, setForm] = React.useState<CategoryFormState | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<CategoryRow | null>(null)
  const [locale, setLocale] = React.useState<Locale>('mn')
  const [busy, setBusy] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const roots = categories.filter((category) => !category.parentId)
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId)

  function open(row?: CategoryRow) {
    setErrors({})
    setLocale('mn')
    if (!row) {
      setForm(blankCategory())
      return
    }
    setForm({
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parentId ?? '',
      imageKey: row.imageKey ?? '',
      icon: row.icon ?? '',
      sortOrder: String(row.sortOrder),
      isActive: row.isActive,
      isFeatured: row.isFeatured,
      metaTitle: row.metaTitle ?? '',
      metaDescription: row.metaDescription ?? '',
      translations: {
        mn: row.translations.mn ?? { name: '', description: '' },
        en: row.translations.en ?? { name: '', description: '' },
        ru: row.translations.ru ?? { name: '', description: '' },
      },
    })
  }

  async function save() {
    if (!form) return
    if (form.name.trim().length < 2) {
      setErrors({ name: d.validation.required })
      return
    }

    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        parentId: form.parentId || null,
        imageKey: form.imageKey.trim() || undefined,
        icon: form.icon.trim() || undefined,
        sortOrder: Number(form.sortOrder || 0),
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        metaTitle: form.metaTitle.trim() || undefined,
        metaDescription: form.metaDescription.trim() || undefined,
        translations: Object.fromEntries(
          LOCALES.map((code) => [
            code,
            {
              name: form.translations[code].name.trim() || undefined,
              description: form.translations[code].description.trim() || undefined,
            },
          ]),
        ),
      }

      if (form.id) {
        await apiFetch(`/api/categories/${form.id}`, { method: 'PUT', body: payload })
        toast.success(d.admin.saved)
      } else {
        await apiFetch('/api/categories', { method: 'POST', body: payload })
        toast.success(d.admin.created)
      }
      setForm(null)
      router.refresh()
    } catch (error) {
      if (error instanceof ApiClientError) {
        const map: Record<string, string> = {
          CYCLIC_PARENT: d.admin.parentCategory,
          SELF_PARENT: d.admin.parentCategory,
          PARENT_NOT_FOUND: d.admin.parentCategory,
        }
        toast.error(map[error.code] ?? d.errors.generic, error.message)
      } else {
        toast.error(d.errors.network)
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: CategoryRow) {
    setBusy(true)
    try {
      const result = await apiFetch<{ archived: boolean }>(`/api/categories/${row.id}`, {
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

  const renderRow = (category: CategoryRow, depth: number) => (
    <React.Fragment key={category.id}>
      <li>
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-white p-3"
          style={{ marginLeft: depth * 20 }}
        >
          <GripVertical className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-brand-600">
            {category.imageKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={category.imageKey} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-ink-900">{category.name}</span>
              {!category.isActive ? <Badge tone="neutral">{d.common.inactive}</Badge> : null}
              {category.isFeatured ? <Badge tone="brand">{d.admin.featuredLabel}</Badge> : null}
            </div>
            <p className="text-xs text-ink-400 tabular">
              /{category.slug} · {d.admin.sortOrder} {category.sortOrder}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs text-ink-500 tabular">
              {category.productCount} {d.admin.productCount.toLowerCase()}
            </span>
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => open(category)}
                  className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
                  aria-label={d.common.edit}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(category)}
                  className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-red-50 hover:text-danger"
                  aria-label={d.common.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </li>
      {childrenOf(category.id).map((child) => renderRow(child, depth + 1))}
    </React.Fragment>
  )

  return (
    <>
      {canManage ? (
        <div className="mb-4">
          <Button size="sm" onClick={() => open()}>
            <Plus className="h-4 w-4" aria-hidden />
            {d.admin.newCategory}
          </Button>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <Card>
          <p className="py-10 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
        </Card>
      ) : (
        <ul className="space-y-2">{roots.map((root) => renderRow(root, 0))}</ul>
      )}

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? d.admin.editCategory : d.admin.newCategory}
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
              <Field label={d.common.name} required error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(event) => {
                    const value = event.target.value
                    setForm({ ...form, name: value, slug: form.id ? form.slug : slugify(value) })
                  }}
                  invalid={Boolean(errors.name)}
                />
              </Field>
              <Field label="Slug">
                <Input
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
                  className="tabular"
                />
              </Field>
              <Field label={d.admin.parentCategory}>
                <Select
                  value={form.parentId}
                  onChange={(event) => setForm({ ...form, parentId: event.target.value })}
                >
                  <option value="">{d.admin.noParent}</option>
                  {categories
                    .filter((category) => category.id !== form.id && !category.parentId)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={d.admin.sortOrder}>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
                  className="tabular"
                />
              </Field>
              <Field label={d.admin.imageUrl} hint={d.common.optional} className="sm:col-span-2">
                <Input
                  value={form.imageKey}
                  onChange={(event) => setForm({ ...form, imageKey: event.target.value })}
                  placeholder="/media/pill.svg"
                />
              </Field>
            </div>

            <div className="space-y-3 border-t border-ink-100 pt-4">
              <Switch
                checked={form.isActive}
                onChange={(value) => setForm({ ...form, isActive: value })}
                label={d.common.enabled}
              />
              <Switch
                checked={form.isFeatured}
                onChange={(value) => setForm({ ...form, isFeatured: value })}
                label={d.admin.featuredLabel}
              />
            </div>

            <div className="border-t border-ink-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink-900">{d.admin.productNames}</h4>
                <div className="flex gap-1">
                  {LOCALES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLocale(code)}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                        locale === code ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600',
                      )}
                    >
                      {LOCALE_META[code].flag} {code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Field label={`${d.common.name} — ${LOCALE_META[locale].nativeLabel}`}>
                  <Input
                    value={form.translations[locale].name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        translations: {
                          ...form.translations,
                          [locale]: { ...form.translations[locale], name: event.target.value },
                        },
                      })
                    }
                    placeholder={locale === 'mn' ? form.name : ''}
                  />
                </Field>
                <Field label={d.product.description}>
                  <Textarea
                    rows={2}
                    value={form.translations[locale].description}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        translations: {
                          ...form.translations,
                          [locale]: { ...form.translations[locale], description: event.target.value },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
              <Field label={d.admin.metaTitle} hint={d.common.optional}>
                <Input
                  value={form.metaTitle}
                  onChange={(event) => setForm({ ...form, metaTitle: event.target.value })}
                />
              </Field>
              <Field label={d.admin.metaDescription} hint={d.common.optional}>
                <Input
                  value={form.metaDescription}
                  onChange={(event) => setForm({ ...form, metaDescription: event.target.value })}
                />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title={
          deleteTarget && (deleteTarget.productCount > 0 || deleteTarget.childCount > 0)
            ? d.admin.archiveProduct
            : d.common.delete
        }
        body={
          deleteTarget && (deleteTarget.productCount > 0 || deleteTarget.childCount > 0)
            ? `${deleteTarget.name} — ${deleteTarget.productCount} ${d.admin.productCount.toLowerCase()}, ${deleteTarget.childCount} ${d.admin.categories.toLowerCase()}`
            : d.admin.confirmDeleteBody
        }
        confirmLabel={d.common.delete}
        cancelLabel={d.common.cancel}
        loading={busy}
      />
    </>
  )
}

// ─────────────────────────────── brands ──────────────────────────────────

export interface BrandRow {
  id: string
  slug: string
  name: string
  logoKey: string | null
  description: string | null
  country: string | null
  website: string | null
  isActive: boolean
  productCount: number
}

export function BrandManager({ brands, canManage }: { brands: BrandRow[]; canManage: boolean }) {
  const { d } = useI18n()
  const toast = useToast()
  const router = useRouter()

  const [form, setForm] = React.useState<(Omit<Partial<BrandRow>, 'id'> & { id: string | null }) | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<BrandRow | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  async function save() {
    if (!form) return
    if (!form.name || form.name.trim().length < 2) {
      setErrors({ name: d.validation.required })
      return
    }

    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        slug: (form.slug ?? '').trim() || slugify(form.name),
        logoKey: form.logoKey?.trim() || undefined,
        description: form.description?.trim() || undefined,
        country: form.country?.trim() || undefined,
        website: form.website?.trim() || undefined,
        isActive: form.isActive ?? true,
      }

      if (form.id) {
        await apiFetch(`/api/brands/${form.id}`, { method: 'PUT', body: payload })
        toast.success(d.admin.saved)
      } else {
        await apiFetch('/api/brands', { method: 'POST', body: payload })
        toast.success(d.admin.created)
      }
      setForm(null)
      router.refresh()
    } catch (error) {
      toast.error(d.errors.generic, error instanceof ApiClientError ? error.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: BrandRow) {
    setBusy(true)
    try {
      const result = await apiFetch<{ archived: boolean }>(`/api/brands/${row.id}`, {
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
          <Button
            size="sm"
            onClick={() => {
              setErrors({})
              setForm({ id: null, name: '', slug: '', isActive: true })
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {d.admin.newBrand}
          </Button>
        </div>
      ) : null}

      {brands.length === 0 ? (
        <Card>
          <p className="py-10 text-center text-sm text-ink-400">{d.admin.emptyTable}</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50 text-xs font-bold text-ink-500">
                  {brand.logoKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logoKey} alt="" className="h-full w-full object-contain" />
                  ) : (
                    brand.name.slice(0, 2).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink-900">{brand.name}</span>
                    {!brand.isActive ? <Badge tone="neutral">{d.common.inactive}</Badge> : null}
                  </div>
                  <p className="text-xs text-ink-500">{brand.country ?? '—'}</p>
                  <p className="mt-0.5 text-xs text-ink-400 tabular">
                    {brand.productCount} {d.admin.productCount.toLowerCase()}
                  </p>
                </div>
              </div>

              {brand.description ? (
                <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-ink-500">
                  {brand.description}
                </p>
              ) : null}

              {canManage ? (
                <div className="mt-3 flex gap-1.5 border-t border-ink-100 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setErrors({})
                      setForm({ ...brand })
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    {d.common.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setDeleteTarget(brand)}
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
        title={form?.id ? d.admin.editBrand : d.admin.newBrand}
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
              <Field label={d.common.name} required error={errors.name}>
                <Input
                  value={form.name ?? ''}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                      slug: form.id ? form.slug : slugify(event.target.value),
                    })
                  }
                  invalid={Boolean(errors.name)}
                />
              </Field>
              <Field label="Slug">
                <Input
                  value={form.slug ?? ''}
                  onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
                  className="tabular"
                />
              </Field>
              <Field label={d.admin.brandCountry} hint={d.common.optional}>
                <Input
                  value={form.country ?? ''}
                  onChange={(event) => setForm({ ...form, country: event.target.value })}
                />
              </Field>
              <Field label={d.admin.brandWebsite} hint={d.common.optional}>
                <Input
                  type="url"
                  value={form.website ?? ''}
                  onChange={(event) => setForm({ ...form, website: event.target.value })}
                  placeholder="https://"
                />
              </Field>
              <Field label={d.admin.brandLogo} hint={d.common.optional} className="sm:col-span-2">
                <Input
                  value={form.logoKey ?? ''}
                  onChange={(event) => setForm({ ...form, logoKey: event.target.value })}
                  placeholder="/media/..."
                />
              </Field>
            </div>
            <Field label={d.product.description} hint={d.common.optional}>
              <Textarea
                rows={3}
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
        title={deleteTarget && deleteTarget.productCount > 0 ? d.admin.archiveProduct : d.common.delete}
        body={
          deleteTarget && deleteTarget.productCount > 0
            ? `${deleteTarget.name} — ${deleteTarget.productCount} ${d.admin.productCount.toLowerCase()}`
            : d.admin.confirmDeleteBody
        }
        confirmLabel={d.common.delete}
        cancelLabel={d.common.cancel}
        loading={busy}
      />
    </>
  )
}

export { ChevronRight }
