/**
 * Role-based access control.
 *
 * The permission catalogue below is the single source of truth: it seeds the
 * `permissions` table, drives the admin "Roles & Permissions" screen, and is
 * what every API route checks. Adding a capability means adding it here — a
 * route that checks an unknown key fails closed.
 */

export const PERMISSION_GROUPS = [
  'dashboard',
  'products',
  'categories',
  'brands',
  'inventory',
  'orders',
  'prescriptions',
  'customers',
  'coupons',
  'promotions',
  'reviews',
  'delivery',
  'payments',
  'chatbot',
  'consultations',
  'notifications',
  'reports',
  'staff',
  'settings',
] as const

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number]

export interface PermissionDef {
  key: string
  group: PermissionGroup
  label: string
  labelMn: string
  description?: string
}

export const PERMISSIONS: PermissionDef[] = [
  { key: 'dashboard.view', group: 'dashboard', label: 'View dashboard', labelMn: 'Хяналтын самбар харах' },

  { key: 'products.view', group: 'products', label: 'View products', labelMn: 'Бүтээгдэхүүн харах' },
  { key: 'products.create', group: 'products', label: 'Create products', labelMn: 'Бүтээгдэхүүн нэмэх' },
  { key: 'products.update', group: 'products', label: 'Edit products', labelMn: 'Бүтээгдэхүүн засах' },
  { key: 'products.delete', group: 'products', label: 'Archive / delete products', labelMn: 'Бүтээгдэхүүн архивлах' },

  { key: 'categories.view', group: 'categories', label: 'View categories', labelMn: 'Категори харах' },
  { key: 'categories.manage', group: 'categories', label: 'Manage categories', labelMn: 'Категори удирдах' },

  { key: 'brands.view', group: 'brands', label: 'View brands', labelMn: 'Брэнд харах' },
  { key: 'brands.manage', group: 'brands', label: 'Manage brands', labelMn: 'Брэнд удирдах' },

  { key: 'inventory.view', group: 'inventory', label: 'View inventory', labelMn: 'Бараа материал харах' },
  { key: 'inventory.adjust', group: 'inventory', label: 'Adjust stock', labelMn: 'Нөөц тохируулах' },

  { key: 'orders.view', group: 'orders', label: 'View orders', labelMn: 'Захиалга харах' },
  { key: 'orders.update', group: 'orders', label: 'Update order status', labelMn: 'Захиалгын төлөв шинэчлэх' },
  { key: 'orders.cancel', group: 'orders', label: 'Cancel orders', labelMn: 'Захиалга цуцлах' },
  { key: 'orders.note', group: 'orders', label: 'Add internal notes', labelMn: 'Дотоод тэмдэглэл нэмэх' },

  {
    key: 'prescriptions.view',
    group: 'prescriptions',
    label: 'View prescriptions',
    labelMn: 'Жор харах',
    description: 'Grants access to uploaded prescription files. Every view is audit-logged.',
  },
  {
    key: 'prescriptions.verify',
    group: 'prescriptions',
    label: 'Verify prescriptions',
    labelMn: 'Жор баталгаажуулах',
    description: 'Licensed pharmacists only — approve, reject or request clarification.',
  },

  { key: 'customers.view', group: 'customers', label: 'View customers', labelMn: 'Харилцагч харах' },
  { key: 'customers.manage', group: 'customers', label: 'Enable / disable accounts', labelMn: 'Харилцагчийн эрх удирдах' },
  {
    key: 'customers.viewContact',
    group: 'customers',
    label: 'View full contact details',
    labelMn: 'Бүрэн холбоо барих мэдээлэл харах',
    description: 'Without this, phone numbers and emails are masked.',
  },

  { key: 'coupons.view', group: 'coupons', label: 'View coupons', labelMn: 'Купон харах' },
  { key: 'coupons.manage', group: 'coupons', label: 'Manage coupons', labelMn: 'Купон удирдах' },

  { key: 'promotions.view', group: 'promotions', label: 'View promotions', labelMn: 'Урамшуулал харах' },
  { key: 'promotions.manage', group: 'promotions', label: 'Manage promotions', labelMn: 'Урамшуулал удирдах' },

  { key: 'reviews.view', group: 'reviews', label: 'View reviews', labelMn: 'Үнэлгээ харах' },
  { key: 'reviews.moderate', group: 'reviews', label: 'Moderate reviews', labelMn: 'Үнэлгээ хянах' },

  { key: 'delivery.view', group: 'delivery', label: 'View deliveries', labelMn: 'Хүргэлт харах' },
  { key: 'delivery.manage', group: 'delivery', label: 'Assign & update deliveries', labelMn: 'Хүргэлт удирдах' },
  { key: 'delivery.own', group: 'delivery', label: 'Update own assigned deliveries', labelMn: 'Өөрийн хүргэлт шинэчлэх' },

  { key: 'payments.view', group: 'payments', label: 'View payments', labelMn: 'Төлбөр харах' },
  { key: 'payments.manage', group: 'payments', label: 'Update payment status', labelMn: 'Төлбөрийн төлөв шинэчлэх' },

  { key: 'chatbot.view', group: 'chatbot', label: 'View chatbot conversations', labelMn: 'Чатботын харилцаа харах' },
  { key: 'chatbot.manage', group: 'chatbot', label: 'Configure chatbot', labelMn: 'Чатбот тохируулах' },

  {
    key: 'consultations.view',
    group: 'consultations',
    label: 'View AI consultations',
    labelMn: 'AI зөвлөгөө харах',
    description:
      'Grants access to customers’ health answers. Every consultation opened is audit-logged.',
  },
  {
    key: 'consultations.review',
    group: 'consultations',
    label: 'Review AI consultations',
    labelMn: 'AI зөвлөгөө хянах',
    description:
      'Licensed pharmacists only — accept, modify or reject an AI recommendation and advise the customer.',
  },
  {
    key: 'consultations.configure',
    group: 'consultations',
    label: 'Configure the consultation agent',
    labelMn: 'AI зөвлөгөөний тохиргоо',
    description: 'Enable/disable the agent, languages, product limits and disclaimer wording.',
  },
  {
    key: 'consultations.safety',
    group: 'consultations',
    label: 'Change consultation safety rules',
    labelMn: 'Аюулгүй байдлын дүрэм өөрчлөх',
    description:
      'Restricted: escalation threshold, allowed/blocked products, system prompt and emergency contact. Never grant this to a general admin.',
  },

  { key: 'notifications.view', group: 'notifications', label: 'View notifications', labelMn: 'Мэдэгдэл харах' },
  { key: 'notifications.send', group: 'notifications', label: 'Send notifications', labelMn: 'Мэдэгдэл илгээх' },

  { key: 'reports.view', group: 'reports', label: 'View reports & analytics', labelMn: 'Тайлан харах' },
  { key: 'reports.export', group: 'reports', label: 'Export reports', labelMn: 'Тайлан татах' },

  { key: 'staff.view', group: 'staff', label: 'View staff', labelMn: 'Ажилтан харах' },
  { key: 'staff.manage', group: 'staff', label: 'Manage staff', labelMn: 'Ажилтан удирдах' },
  { key: 'staff.roles', group: 'staff', label: 'Manage roles & permissions', labelMn: 'Дүр, эрх удирдах' },

  { key: 'settings.view', group: 'settings', label: 'View settings', labelMn: 'Тохиргоо харах' },
  { key: 'settings.manage', group: 'settings', label: 'Change settings', labelMn: 'Тохиргоо өөрчлөх' },
  { key: 'audit.view', group: 'settings', label: 'View audit log', labelMn: 'Аудит лог харах' },
]

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key)
export type PermissionKey = string

export const ROLE_KEYS = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PHARMACIST: 'pharmacist',
  INVENTORY_MANAGER: 'inventory_manager',
  ORDER_MANAGER: 'order_manager',
  DELIVERY_STAFF: 'delivery_staff',
  CUSTOMER: 'customer',
} as const

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS]

export interface RoleDef {
  key: RoleKey
  name: string
  nameMn: string
  description: string
  isStaff: boolean
  /** '*' grants every permission, including ones added later. */
  permissions: PermissionKey[] | '*'
}

export const ROLES: RoleDef[] = [
  {
    key: ROLE_KEYS.SUPER_ADMIN,
    name: 'Super Admin',
    nameMn: 'Супер админ',
    description: 'Full access to every part of the system, including roles and settings.',
    isStaff: true,
    permissions: '*',
  },
  {
    key: ROLE_KEYS.ADMIN,
    name: 'Admin',
    nameMn: 'Админ',
    description: 'Products, orders, customers and reports. Cannot verify prescriptions or change roles.',
    isStaff: true,
    permissions: [
      'dashboard.view',
      'products.view', 'products.create', 'products.update', 'products.delete',
      'categories.view', 'categories.manage',
      'brands.view', 'brands.manage',
      'inventory.view', 'inventory.adjust',
      'orders.view', 'orders.update', 'orders.cancel', 'orders.note',
      'prescriptions.view',
      'customers.view', 'customers.manage', 'customers.viewContact',
      'coupons.view', 'coupons.manage',
      'promotions.view', 'promotions.manage',
      'reviews.view', 'reviews.moderate',
      'delivery.view', 'delivery.manage',
      'payments.view', 'payments.manage',
      'chatbot.view',
      // Admins may run the agent and read consultations, but clinical review is
      // a licensed-pharmacist act and safety rules need `consultations.safety`.
      'consultations.view', 'consultations.configure',
      'notifications.view', 'notifications.send',
      'reports.view', 'reports.export',
      'staff.view',
      'settings.view',
    ],
  },
  {
    key: ROLE_KEYS.PHARMACIST,
    name: 'Pharmacist',
    nameMn: 'Фармацевт',
    description:
      'Licensed pharmacist. Verifies prescriptions and maintains medicine information. The only staff role able to approve a prescription.',
    isStaff: true,
    permissions: [
      'dashboard.view',
      'products.view', 'products.create', 'products.update',
      'categories.view',
      'brands.view',
      'inventory.view',
      'orders.view', 'orders.update', 'orders.note',
      'prescriptions.view', 'prescriptions.verify',
      'customers.view', 'customers.viewContact',
      'reviews.view', 'reviews.moderate',
      'chatbot.view',
      'consultations.view', 'consultations.review',
      'notifications.view',
      'reports.view',
    ],
  },
  {
    key: ROLE_KEYS.INVENTORY_MANAGER,
    name: 'Inventory Manager',
    nameMn: 'Нөөцийн менежер',
    description: 'Stock levels, batches, expiry monitoring and product data.',
    isStaff: true,
    permissions: [
      'dashboard.view',
      'products.view', 'products.create', 'products.update',
      'categories.view',
      'brands.view', 'brands.manage',
      'inventory.view', 'inventory.adjust',
      'orders.view',
      'reports.view',
      'notifications.view',
    ],
  },
  {
    key: ROLE_KEYS.ORDER_MANAGER,
    name: 'Order Manager',
    nameMn: 'Захиалгын менежер',
    description: 'Processes orders and talks to customers. Cannot approve prescriptions.',
    isStaff: true,
    permissions: [
      'dashboard.view',
      'products.view',
      'inventory.view',
      'orders.view', 'orders.update', 'orders.cancel', 'orders.note',
      'prescriptions.view',
      'customers.view', 'customers.viewContact',
      'coupons.view',
      'delivery.view', 'delivery.manage',
      'payments.view', 'payments.manage',
      'notifications.view',
      'reports.view',
    ],
  },
  {
    key: ROLE_KEYS.DELIVERY_STAFF,
    name: 'Delivery Staff',
    nameMn: 'Хүргэлтийн ажилтан',
    description: 'Sees only their own assigned deliveries and updates delivery status.',
    isStaff: true,
    permissions: ['dashboard.view', 'delivery.view', 'delivery.own', 'orders.view'],
  },
  {
    key: ROLE_KEYS.CUSTOMER,
    name: 'Customer',
    nameMn: 'Харилцагч',
    description: 'Storefront account. No admin access.',
    isStaff: false,
    permissions: [],
  },
]

export function roleByKey(key: string): RoleDef | undefined {
  return ROLES.find((r) => r.key === key)
}

export function expandPermissions(role: RoleDef): string[] {
  return role.permissions === '*' ? [...PERMISSION_KEYS] : role.permissions
}

/** Groups the current actor may see in the admin sidebar. */
export function visibleGroups(granted: Set<string>): PermissionGroup[] {
  return PERMISSION_GROUPS.filter((group) =>
    PERMISSIONS.some((p) => p.group === group && granted.has(p.key)),
  )
}
