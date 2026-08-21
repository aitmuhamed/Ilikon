/**
 * Page crawl: requests every route in every locale plus the whole admin tree
 * and reports any non-2xx response. Usage: node scripts/crawl.mjs <port>
 */
const PORT = process.argv[2] ?? '3000'
const BASE = `http://localhost:${PORT}`

// Test-account password. Defaults to the seeded value; override with
// TEST_PASSWORD once the accounts have been rotated (npm run rotate:passwords).
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'Ilikon2026!'

// Per-account overrides, for when accounts have been rotated to different
// passwords: TEST_PASSWORD_MAP='{"admin@ilikon.mn":"...","orders@ilikon.mn":"..."}'
const PASSWORD_MAP = JSON.parse(process.env.TEST_PASSWORD_MAP ?? '{}')
const passwordFor = (identifier) => PASSWORD_MAP[identifier] ?? TEST_PASSWORD

const cookies = new Map()

async function login(identifier) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password: passwordFor(identifier) }),
  })
  const jar = []
  for (const raw of res.headers.getSetCookie?.() ?? []) jar.push(raw.split(';')[0])
  cookies.set(identifier, jar.join('; '))
  return res.ok
}

async function get(path, as) {
  const headers = {}
  const jar = as ? cookies.get(as) : null
  if (jar) headers.cookie = jar
  const res = await fetch(`${BASE}${path}`, { headers, redirect: 'manual' })
  return res.status
}

async function main() {
  await login('admin@ilikon.mn')
  await login('delgermaa@example.mn')

  // Real slugs, so the crawl exercises the dynamic routes too.
  const products = await fetch(`${BASE}/api/products?perPage=3`).then((r) => r.json())
  const slugs = products.data.items.map((item) => item.slug)
  const categories = await fetch(`${BASE}/api/categories`).then((r) => r.json())
  const catSlugs = categories.data.categories.slice(0, 3).map((c) => c.slug)

  const orders = await fetch(`${BASE}/api/orders?scope=admin&perPage=2`, {
    headers: { cookie: cookies.get('admin@ilikon.mn') },
  }).then((r) => r.json())
  const orderIds = (orders.data?.orders ?? []).map((o) => o.id)

  const customers = await fetch(`${BASE}/api/customers?perPage=2`, {
    headers: { cookie: cookies.get('admin@ilikon.mn') },
  }).then((r) => r.json())
  const customerIds = (customers.data?.customers ?? []).map((c) => c.id)

  const storefront = [
    '/',
    '/products',
    '/products?sort=price_asc&prescription=otc&inStock=1',
    '/products?q=витамин',
    '/categories',
    '/cart',
    '/about',
    '/contact',
    '/faq',
    '/terms',
    '/privacy',
    '/login',
    '/register',
    '/forgot-password',
    ...catSlugs.map((slug) => `/categories/${slug}`),
    ...slugs.map((slug) => `/products/${slug}`),
  ]

  const customerPages = [
    '/account',
    '/account/orders',
    '/account/wishlist',
    '/account/addresses',
    '/account/notifications',
    '/account/prescriptions',
    '/prescriptions/upload',
  ]

  const adminPages = [
    '/admin',
    '/admin/orders',
    '/admin/orders?status=NEW',
    '/admin/products',
    '/admin/products/new',
    '/admin/categories',
    '/admin/brands',
    '/admin/inventory',
    '/admin/inventory?filter=low',
    '/admin/inventory?filter=expiring',
    '/admin/customers',
    '/admin/prescriptions',
    '/admin/prescriptions?status=all',
    '/admin/coupons',
    '/admin/promotions',
    '/admin/reviews',
    '/admin/reviews?status=all',
    '/admin/delivery',
    '/admin/payments',
    '/admin/chatbot',
    '/admin/notifications',
    '/admin/reports',
    '/admin/reports?range=7d',
    '/admin/staff',
    '/admin/roles',
    '/admin/settings',
    '/admin/audit',
    ...orderIds.map((id) => `/admin/orders/${id}`),
    ...customerIds.map((id) => `/admin/customers/${id}`),
  ]

  const misc = ['/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/icon.svg']

  const failures = []
  let count = 0

  async function run(path, as, label) {
    const status = await get(path, as)
    count += 1
    const ok = status >= 200 && status < 400
    if (!ok) failures.push(`${label} ${path} → ${status}`)
    return ok
  }

  for (const locale of ['mn', 'en', 'ru']) {
    for (const path of storefront) {
      await run(`/${locale}${path === '/' ? '' : path}`, undefined, 'public')
    }
  }
  for (const path of customerPages) {
    await run(`/mn${path}`, 'delgermaa@example.mn', 'customer')
  }
  for (const path of adminPages) {
    await run(path, 'admin@ilikon.mn', 'admin')
  }
  for (const path of misc) {
    await run(path, undefined, 'misc')
  }

  console.log(`\ncrawled ${count} routes`)
  if (failures.length === 0) {
    console.log('all routes responded 2xx/3xx')
  } else {
    console.log(`${failures.length} failing:`)
    for (const failure of failures) console.log(`  ${failure}`)
  }
  process.exit(failures.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
