/* eslint-disable no-await-in-loop */
import {
  PrismaClient,
  type OrderStatus,
  type PaymentMethod,
  type Prisma,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

import { PERMISSIONS, ROLES, ROLE_KEYS, expandPermissions } from '../src/lib/rbac'
import {
  DEFAULT_SETTINGS,
  SETTING_GROUPS,
  type PharmacySettings,
} from '../src/lib/settings-defaults'
import { CATEGORIES, BRANDS, MANUFACTURERS } from './seed-data'
import { PRODUCTS_A, type SeedProduct } from './seed-products-a'
import { PRODUCTS_B } from './seed-products-b'
import { PRODUCTS_C } from './seed-products-c'

const prisma = new PrismaClient()

/** Shared demo password. Documented in the README; rotate before production. */
const DEMO_PASSWORD = 'Ilikon2026!'
const ALL_PRODUCTS: SeedProduct[] = [...PRODUCTS_A, ...PRODUCTS_B, ...PRODUCTS_C]

function monthsFromNow(months: number): Date {
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return date
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function pick<T>(items: T[], index: number): T {
  return items[index % items.length]!
}

// ════════════════════════════ roles & permissions ═════════════════════════

async function seedAccessControl() {
  for (const definition of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        group: definition.group,
        label: definition.label,
        description: definition.description ?? null,
      },
      update: { group: definition.group, label: definition.label },
    })
  }

  const permissionsByKey = new Map(
    (await prisma.permission.findMany()).map((p) => [p.key, p.id]),
  )

  for (const definition of ROLES) {
    const role = await prisma.role.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        name: definition.name,
        nameMn: definition.nameMn,
        description: definition.description,
        isSystem: true,
        isStaff: definition.isStaff,
      },
      update: {
        name: definition.name,
        nameMn: definition.nameMn,
        description: definition.description,
        isStaff: definition.isStaff,
      },
    })

    const keys = expandPermissions(definition)
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    if (keys.length) {
      await prisma.rolePermission.createMany({
        data: keys
          .map((key) => permissionsByKey.get(key))
          .filter((id): id is string => Boolean(id))
          .map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      })
    }
  }

  console.log(`  ✓ ${PERMISSIONS.length} permissions, ${ROLES.length} roles`)
}

// ═══════════════════════════════ taxonomy ═════════════════════════════════

async function seedTaxonomy() {
  // Two passes so a child can always resolve its parent id.
  for (const category of CATEGORIES.filter((c) => !c.parent)) {
    await upsertCategory(category, null)
  }
  const parents = new Map(
    (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  )
  for (const category of CATEGORIES.filter((c) => c.parent)) {
    await upsertCategory(category, parents.get(category.parent!) ?? null)
  }

  for (const brand of BRANDS) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      create: {
        slug: brand.slug,
        name: brand.name,
        country: brand.country,
        description: brand.description,
        isActive: true,
      },
      update: { name: brand.name, country: brand.country, description: brand.description },
    })
  }

  for (const manufacturer of MANUFACTURERS) {
    await prisma.manufacturer.upsert({
      where: { slug: manufacturer.slug },
      create: { slug: manufacturer.slug, name: manufacturer.name, country: manufacturer.country },
      update: { name: manufacturer.name, country: manufacturer.country },
    })
  }

  console.log(
    `  ✓ ${CATEGORIES.length} categories, ${BRANDS.length} brands, ${MANUFACTURERS.length} manufacturers`,
  )
}

async function upsertCategory(category: (typeof CATEGORIES)[number], parentId: string | null) {
  const record = await prisma.category.upsert({
    where: { slug: category.slug },
    create: {
      slug: category.slug,
      name: category.name,
      parentId,
      icon: category.icon,
      imageKey: `/media/${category.art}.svg`,
      sortOrder: category.sortOrder,
      isActive: true,
      isFeatured: category.featured ?? false,
      metaTitle: `${category.name} — Иликон Уужим Эмийн Сан`,
      metaDescription: `${category.name} категорийн бүтээгдэхүүнийг Иликон Уужим Эмийн Сангаас онлайнаар захиалаарай.`,
    },
    update: {
      name: category.name,
      parentId,
      icon: category.icon,
      imageKey: `/media/${category.art}.svg`,
      sortOrder: category.sortOrder,
      isFeatured: category.featured ?? false,
    },
  })

  const translations = [
    { locale: 'mn' as const, name: category.name },
    { locale: 'en' as const, name: category.nameEn },
    { locale: 'ru' as const, name: category.nameRu },
  ]
  for (const translation of translations) {
    await prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: record.id, locale: translation.locale } },
      create: { categoryId: record.id, locale: translation.locale, name: translation.name },
      update: { name: translation.name },
    })
  }
}

// ═══════════════════════════════ products ═════════════════════════════════

async function seedProducts() {
  const categories = new Map(
    (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  )
  const brands = new Map(
    (await prisma.brand.findMany({ select: { id: true, slug: true } })).map((b) => [b.slug, b.id]),
  )
  const manufacturers = new Map(
    (await prisma.manufacturer.findMany({ select: { id: true, slug: true } })).map((m) => [m.slug, m.id]),
  )

  for (const item of ALL_PRODUCTS) {
    const categoryId = categories.get(item.category)
    if (!categoryId) throw new Error(`Unknown category slug: ${item.category}`)

    const expiryDate = monthsFromNow(item.expiryMonths)

    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      create: {
        sku: item.sku,
        barcode: item.barcode,
        slug: item.slug,
        name: item.name,
        categoryId,
        brandId: brands.get(item.brand) ?? null,
        manufacturerId: manufacturers.get(item.manufacturer) ?? null,
        prescriptionRequired: item.rx,
        isControlled: item.controlled ?? false,
        price: item.price,
        discountPrice: item.discountPrice ?? null,
        costPrice: item.costPrice ?? Math.round(item.price * 0.68),
        status: 'ACTIVE',
        isFeatured: item.featured ?? false,
        isNew: item.isNew ?? false,
        weightGrams: item.weightGrams ?? null,
        packageSize: item.packageSize,
        dosageForm: item.dosageForm,
        strength: item.strength ?? null,
        expiryDate,
        registrationNo: item.registrationNo ?? null,
        activeIngredientsIndex: `${item.mn.activeIngredients} ${item.en.activeIngredients}`.toLowerCase(),
        soldCount: item.soldCount ?? 0,
        viewCount: (item.soldCount ?? 0) * 7 + 13,
        metaTitle: `${item.name} — ${item.packageSize} | Иликон`,
        metaDescription: item.mn.short,
      },
      update: {
        name: item.name,
        price: item.price,
        discountPrice: item.discountPrice ?? null,
        isFeatured: item.featured ?? false,
        isNew: item.isNew ?? false,
        expiryDate,
        prescriptionRequired: item.rx,
      },
    })

    const translations: {
      locale: 'mn' | 'en' | 'ru'
      data: Prisma.ProductTranslationCreateWithoutProductInput
    }[] = [
      {
        locale: 'mn',
        data: {
          locale: 'mn',
          name: item.name,
          shortDescription: item.mn.short,
          description: item.mn.description,
          ingredients: item.mn.ingredients,
          activeIngredients: item.mn.activeIngredients,
          dosage: item.mn.dosage,
          usage: item.mn.usage,
          warnings: item.mn.warnings,
          sideEffects: item.mn.sideEffects,
          storage: item.mn.storage,
        },
      },
      {
        locale: 'en',
        data: {
          locale: 'en',
          name: item.nameEn,
          shortDescription: item.en.short,
          description: item.en.description,
          activeIngredients: item.en.activeIngredients,
          dosage: item.en.dosage,
          warnings: item.en.warnings,
          storage: item.en.storage,
        },
      },
      {
        locale: 'ru',
        data: {
          locale: 'ru',
          name: item.nameRu,
          shortDescription: item.ru.short,
          description: item.ru.description,
          activeIngredients: item.ru.activeIngredients,
          warnings: item.ru.warnings,
        },
      },
    ]

    for (const translation of translations) {
      const { locale, ...rest } = translation.data
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale: translation.locale } },
        create: { productId: product.id, locale, ...rest } as Prisma.ProductTranslationUncheckedCreateInput,
        update: rest,
      })
    }

    await prisma.productImage.deleteMany({ where: { productId: product.id } })
    await prisma.productImage.createMany({
      data: [
        { productId: product.id, fileKey: `/media/${item.art}.svg`, alt: item.name, sortOrder: 0, isPrimary: true },
        { productId: product.id, fileKey: `/media/${item.art}.svg`, alt: `${item.name} — савлагаа`, sortOrder: 1, isPrimary: false },
      ],
    })

    const inventory = await prisma.inventory.upsert({
      where: { productId: product.id },
      create: {
        productId: product.id,
        quantity: item.stock,
        lowStockThreshold: item.lowStockThreshold ?? 10,
        reorderLevel: (item.lowStockThreshold ?? 10) * 2,
        shelfLocation: item.shelf ?? null,
        lastCountedAt: daysAgo(9),
      },
      update: { quantity: item.stock, shelfLocation: item.shelf ?? null },
    })

    // Opening balance in the ledger, so history reconciles with the figure.
    const hasLedger = await prisma.inventoryTransaction.count({ where: { productId: product.id } })
    if (hasLedger === 0) {
      await prisma.inventoryTransaction.create({
        data: {
          productId: product.id,
          type: 'STOCK_IN',
          quantityDelta: item.stock,
          balanceAfter: inventory.quantity,
          reason: 'Нээлтийн нөөц (seed)',
          reference: `INIT-${item.sku}`,
          createdAt: daysAgo(30),
        },
      })
    }

    await prisma.inventoryBatch.upsert({
      where: { productId_lotNumber: { productId: product.id, lotNumber: `LOT-${item.sku}-A` } },
      create: {
        productId: product.id,
        lotNumber: `LOT-${item.sku}-A`,
        quantity: item.stock,
        expiryDate,
        supplier: 'Иликон нийлүүлэлт',
        receivedAt: daysAgo(30),
      },
      update: { quantity: item.stock, expiryDate },
    })
  }

  // Related products: same category, excluding self.
  const products = await prisma.product.findMany({ select: { id: true, categoryId: true } })
  const byCategory = new Map<string, string[]>()
  for (const product of products) {
    byCategory.set(product.categoryId, [...(byCategory.get(product.categoryId) ?? []), product.id])
  }
  for (const product of products) {
    const siblings = (byCategory.get(product.categoryId) ?? []).filter((id) => id !== product.id).slice(0, 4)
    if (!siblings.length) continue
    await prisma.relatedProduct.createMany({
      data: siblings.map((relatedId, index) => ({ productId: product.id, relatedId, sortOrder: index })),
      skipDuplicates: true,
    })
  }

  // One product deliberately expiring soon, so the expiry alert has real data.
  const expiringTarget = await prisma.product.findFirst({ where: { sku: 'ILK-COLD-SYR' } })
  if (expiringTarget) {
    const soon = new Date(Date.now() + 34 * 86_400_000)
    await prisma.product.update({ where: { id: expiringTarget.id }, data: { expiryDate: soon } })
    await prisma.inventoryBatch.updateMany({
      where: { productId: expiringTarget.id },
      data: { expiryDate: soon },
    })
  }

  console.log(`  ✓ ${ALL_PRODUCTS.length} products with mn/en/ru translations, stock and batches`)
}

// ═════════════════════════════ users & staff ══════════════════════════════

interface SeedUser {
  fullName: string
  phone: string
  email: string
  roleKey: string
  isStaff: boolean
  jobTitle?: string
  licenseNumber?: string
  marketingOptIn?: boolean
  createdDaysAgo?: number
}

const STAFF: SeedUser[] = [
  { fullName: 'Батбаярын Ануужин', phone: '99110001', email: 'admin@ilikon.mn', roleKey: ROLE_KEYS.SUPER_ADMIN, isStaff: true, jobTitle: 'Гүйцэтгэх захирал' },
  { fullName: 'Доржийн Сарангэрэл', phone: '99110002', email: 'manager@ilikon.mn', roleKey: ROLE_KEYS.ADMIN, isStaff: true, jobTitle: 'Салбарын менежер' },
  { fullName: 'Ганбатын Оюунчимэг', phone: '99110003', email: 'pharmacist@ilikon.mn', roleKey: ROLE_KEYS.PHARMACIST, isStaff: true, jobTitle: 'Ахлах фармацевт', licenseNumber: 'ФА-2016/1187' },
  { fullName: 'Лхагвын Мөнхбаяр', phone: '99110004', email: 'pharmacist2@ilikon.mn', roleKey: ROLE_KEYS.PHARMACIST, isStaff: true, jobTitle: 'Фармацевт', licenseNumber: 'ФА-2020/2043' },
  { fullName: 'Цэрэнгийн Хонгорзул', phone: '99110005', email: 'inventory@ilikon.mn', roleKey: ROLE_KEYS.INVENTORY_MANAGER, isStaff: true, jobTitle: 'Нөөцийн менежер' },
  { fullName: 'Энхбатын Тэмүүлэн', phone: '99110006', email: 'orders@ilikon.mn', roleKey: ROLE_KEYS.ORDER_MANAGER, isStaff: true, jobTitle: 'Захиалгын менежер' },
  { fullName: 'Баярсайханы Нэргүй', phone: '99110007', email: 'delivery@ilikon.mn', roleKey: ROLE_KEYS.DELIVERY_STAFF, isStaff: true, jobTitle: 'Хүргэлтийн ажилтан' },
]

const CUSTOMERS: SeedUser[] = [
  { fullName: 'Отгонбаярын Дэлгэрмаа', phone: '88220001', email: 'delgermaa@example.mn', roleKey: ROLE_KEYS.CUSTOMER, isStaff: false, marketingOptIn: true, createdDaysAgo: 240 },
  { fullName: 'Пүрэвийн Ганзориг', phone: '88220002', email: 'ganzorig@example.mn', roleKey: ROLE_KEYS.CUSTOMER, isStaff: false, marketingOptIn: false, createdDaysAgo: 180 },
  { fullName: 'Сүхбаатарын Алтанцэцэг', phone: '88220003', email: 'altantsetseg@example.mn', roleKey: ROLE_KEYS.CUSTOMER, isStaff: false, marketingOptIn: true, createdDaysAgo: 120 },
  { fullName: 'Бatbold Namsrai', phone: '88220004', email: 'batbold@example.mn', roleKey: ROLE_KEYS.CUSTOMER, isStaff: false, marketingOptIn: false, createdDaysAgo: 75 },
  { fullName: 'Жаргалын Уранчимэг', phone: '88220005', email: 'uranchimeg@example.mn', roleKey: ROLE_KEYS.CUSTOMER, isStaff: false, marketingOptIn: true, createdDaysAgo: 40 },
  { fullName: 'Мөнхбатын Түвшинжаргал', phone: '88220006', email: 'tuvshin@example.mn', roleKey: ROLE_KEYS.CUSTOMER, isStaff: false, marketingOptIn: false, createdDaysAgo: 12 },
  { fullName: 'Эрдэнэбилэгийн Ноён', phone: '88220007', email: 'noyon@example.mn', roleKey: ROLE_KEYS.CUSTOMER, isStaff: false, marketingOptIn: true, createdDaysAgo: 4 },
]

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const roles = new Map(
    (await prisma.role.findMany({ select: { id: true, key: true } })).map((r) => [r.key, r.id]),
  )

  for (const person of [...STAFF, ...CUSTOMERS]) {
    const user = await prisma.user.upsert({
      where: { phone: person.phone },
      create: {
        fullName: person.fullName,
        phone: person.phone,
        email: person.email,
        passwordHash,
        isStaff: person.isStaff,
        roleId: roles.get(person.roleKey) ?? null,
        jobTitle: person.jobTitle ?? null,
        licenseNumber: person.licenseNumber ?? null,
        marketingOptIn: person.marketingOptIn ?? false,
        status: 'ACTIVE',
        createdAt: person.createdDaysAgo ? daysAgo(person.createdDaysAgo) : new Date(),
        lastLoginAt: daysAgo(Math.floor(Math.random() * 6) + 1),
      },
      update: {
        fullName: person.fullName,
        email: person.email,
        roleId: roles.get(person.roleKey) ?? null,
        jobTitle: person.jobTitle ?? null,
        licenseNumber: person.licenseNumber ?? null,
      },
    })

    if (!person.isStaff) {
      await prisma.wishlist.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      })
    }
  }

  // Saved addresses for the first few customers.
  const districts = ['Сүхбаатар', 'Баянзүрх', 'Хан-Уул', 'Чингэлтэй', 'Баянгол']
  const customers = await prisma.user.findMany({ where: { isStaff: false }, orderBy: { createdAt: 'asc' } })
  for (const [index, customer] of customers.slice(0, 5).entries()) {
    const existing = await prisma.address.count({ where: { userId: customer.id } })
    if (existing > 0) continue
    await prisma.address.create({
      data: {
        userId: customer.id,
        label: 'Гэр',
        recipient: customer.fullName,
        phone: customer.phone,
        district: pick(districts, index),
        khoroo: `${(index % 12) + 1}-р хороо`,
        addressLine: `${10 + index}-р хороолол, ${index + 3} байр, ${(index + 1) * 12} тоот`,
        instructions: index % 2 === 0 ? 'Хаалганы код 1234, 3 дугаар подъезд' : null,
        isDefault: true,
      },
    })
  }

  // Wishlist entries so the account page has content.
  const featured = await prisma.product.findMany({ where: { isFeatured: true }, take: 6, select: { id: true } })
  for (const [index, customer] of customers.slice(0, 4).entries()) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId: customer.id } })
    if (!wishlist) continue
    await prisma.wishlistItem.createMany({
      data: featured.slice(index, index + 3).map((product) => ({
        wishlistId: wishlist.id,
        productId: product.id,
      })),
      skipDuplicates: true,
    })
  }

  console.log(`  ✓ ${STAFF.length} staff, ${CUSTOMERS.length} customers, addresses and wishlists`)
}

// ═══════════════════════════ coupons & promotions ═════════════════════════

async function seedCommerceExtras() {
  const coupons: Prisma.CouponCreateInput[] = [
    {
      code: 'ILIKON10',
      description: '10% хямдрал — 50,000₮-с дээш захиалгад',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: 50_000,
      maxDiscountAmount: 25_000,
      startsAt: daysAgo(30),
      endsAt: monthsFromNow(6),
      usageLimit: 500,
      perCustomerLimit: 2,
      isActive: true,
    },
    {
      code: 'SHINE5000',
      description: 'Шинэ харилцагчид 5,000₮ хямдрал',
      discountType: 'FIXED',
      discountValue: 5_000,
      minOrderAmount: 30_000,
      startsAt: daysAgo(60),
      endsAt: monthsFromNow(3),
      usageLimit: 1000,
      perCustomerLimit: 1,
      isActive: true,
    },
    {
      code: 'VITAMIN15',
      description: 'Витамин, био нэмэлтэд 15% хямдрал',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      minOrderAmount: 80_000,
      maxDiscountAmount: 40_000,
      startsAt: daysAgo(10),
      endsAt: monthsFromNow(2),
      usageLimit: 200,
      perCustomerLimit: 1,
      isActive: true,
    },
    {
      code: 'HUURSAN2025',
      description: 'Хугацаа дууссан урамшуулал (демо)',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderAmount: 0,
      startsAt: daysAgo(200),
      endsAt: daysAgo(30),
      usageLimit: 100,
      perCustomerLimit: 1,
      isActive: false,
    },
  ]

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      create: coupon,
      update: { endsAt: coupon.endsAt, isActive: coupon.isActive },
    })
  }

  const vitaminCategory = await prisma.category.findUnique({ where: { slug: 'vitamin' } })
  const promotions = [
    {
      title: 'Витамин, био нэмэлтэд 15% хямдрал',
      subtitle: 'VITAMIN15 кодыг сагсандаа хэрэглэнэ',
      titleEn: '15% off vitamins & supplements',
      subtitleEn: 'Use code VITAMIN15 at checkout',
      titleRu: '15% на витамины и добавки',
      subtitleRu: 'Промокод VITAMIN15 в корзине',
      badgeText: '−15%',
      art: 'vitamin',
      placement: 'HOME_STRIP' as const,
      linkUrl: '/categories/vitamin',
      categoryId: vitaminCategory?.id ?? null,
      sortOrder: 1,
    },
    {
      title: '80,000₮-с дээш захиалгад хүргэлт үнэгүй',
      subtitle: 'Улаанбаатар хотын дотор, 1-3 цагт',
      titleEn: 'Free delivery over 80,000₮',
      subtitleEn: 'Within Ulaanbaatar, in 1-3 hours',
      titleRu: 'Бесплатная доставка от 80 000₮',
      subtitleRu: 'По Улан-Батору, за 1-3 часа',
      badgeText: 'Үнэгүй',
      art: 'device',
      placement: 'HOME_STRIP' as const,
      linkUrl: '/products',
      categoryId: null,
      sortOrder: 2,
    },
  ]

  for (const promotion of promotions) {
    const existing = await prisma.promotion.findFirst({ where: { title: promotion.title } })
    const record = existing
      ? await prisma.promotion.update({
          where: { id: existing.id },
          data: { isActive: true, sortOrder: promotion.sortOrder },
        })
      : await prisma.promotion.create({
          data: {
            title: promotion.title,
            subtitle: promotion.subtitle,
            badgeText: promotion.badgeText,
            imageKey: `/media/${promotion.art}.svg`,
            placement: promotion.placement,
            linkUrl: promotion.linkUrl,
            categoryId: promotion.categoryId,
            sortOrder: promotion.sortOrder,
            isActive: true,
            startsAt: daysAgo(15),
            endsAt: monthsFromNow(3),
          },
        })

    for (const translation of [
      { locale: 'mn' as const, title: promotion.title, subtitle: promotion.subtitle },
      { locale: 'en' as const, title: promotion.titleEn, subtitle: promotion.subtitleEn },
      { locale: 'ru' as const, title: promotion.titleRu, subtitle: promotion.subtitleRu },
    ]) {
      await prisma.promotionTranslation.upsert({
        where: { promotionId_locale: { promotionId: record.id, locale: translation.locale } },
        create: { promotionId: record.id, ...translation },
        update: { title: translation.title, subtitle: translation.subtitle },
      })
    }
  }

  console.log(`  ✓ ${coupons.length} coupons, ${promotions.length} promotions`)
}

// ════════════════════════════════ settings ════════════════════════════════

async function seedSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: {
        key,
        value: value as never,
        group: SETTING_GROUPS[key as keyof PharmacySettings] ?? 'general',
      },
      update: {},
    })
  }
  console.log(`  ✓ ${Object.keys(DEFAULT_SETTINGS).length} settings`)
}

export { prisma, DEMO_PASSWORD, ALL_PRODUCTS, daysAgo, monthsFromNow, pick }
export { seedAccessControl, seedTaxonomy, seedProducts, seedUsers, seedCommerceExtras, seedSettings }
export type { OrderStatus, PaymentMethod }
