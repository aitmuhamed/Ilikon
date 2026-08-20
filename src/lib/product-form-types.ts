import type { Locale } from './locale-types'

/**
 * Product editor value shape and blank factories.
 *
 * Kept out of the `'use client'` form module so Server Components can build an
 * initial value — a function exported from a client module cannot be called on
 * the server, only rendered.
 */

export interface ProductFormOption {
  id: string
  name: string
}

export interface ProductTranslationInput {
  name: string
  shortDescription: string
  description: string
  ingredients: string
  activeIngredients: string
  dosage: string
  usage: string
  warnings: string
  sideEffects: string
  storage: string
}

export interface ProductFormValues {
  sku: string
  barcode: string
  slug: string
  name: string
  categoryId: string
  brandId: string
  manufacturerId: string
  prescriptionRequired: boolean
  isControlled: boolean
  price: string
  discountPrice: string
  costPrice: string
  taxRatePct: string
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  isFeatured: boolean
  isNew: boolean
  weightGrams: string
  packageSize: string
  dosageForm: string
  strength: string
  expiryDate: string
  registrationNo: string
  metaTitle: string
  metaDescription: string
  stockQuantity: string
  lowStockThreshold: string
  shelfLocation: string
  images: { fileKey: string; alt: string }[]
  relatedProductIds: string[]
  translations: Record<Locale, ProductTranslationInput>
}

export function emptyTranslation(): ProductTranslationInput {
  return {
    name: '',
    shortDescription: '',
    description: '',
    ingredients: '',
    activeIngredients: '',
    dosage: '',
    usage: '',
    warnings: '',
    sideEffects: '',
    storage: '',
  }
}

export function emptyProduct(): ProductFormValues {
  return {
    sku: '',
    barcode: '',
    slug: '',
    name: '',
    categoryId: '',
    brandId: '',
    manufacturerId: '',
    prescriptionRequired: false,
    isControlled: false,
    price: '',
    discountPrice: '',
    costPrice: '',
    taxRatePct: '0',
    status: 'ACTIVE',
    isFeatured: false,
    isNew: false,
    weightGrams: '',
    packageSize: '',
    dosageForm: '',
    strength: '',
    expiryDate: '',
    registrationNo: '',
    metaTitle: '',
    metaDescription: '',
    stockQuantity: '0',
    lowStockThreshold: '10',
    shelfLocation: '',
    images: [],
    relatedProductIds: [],
    translations: { mn: emptyTranslation(), en: emptyTranslation(), ru: emptyTranslation() },
  }
}
