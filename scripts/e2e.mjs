/**
 * End-to-end check of the interconnected pharmacy flow.
 * Usage: node e2e.mjs <port>
 */
const PORT = process.argv[2] ?? '3007'
const BASE = `http://localhost:${PORT}`

// Test-account password. Defaults to the seeded value; override with
// TEST_PASSWORD once the accounts have been rotated (npm run rotate:passwords).
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'Ilikon2026!'

// Per-account overrides, for when accounts have been rotated to different
// passwords: TEST_PASSWORD_MAP='{"admin@ilikon.mn":"...","orders@ilikon.mn":"..."}'
const PASSWORD_MAP = JSON.parse(process.env.TEST_PASSWORD_MAP ?? '{}')
const passwordFor = (identifier) => PASSWORD_MAP[identifier] ?? TEST_PASSWORD

const jars = new Map()

function jar(name) {
  if (!jars.has(name)) jars.set(name, new Map())
  return jars.get(name)
}

function cookieHeader(name) {
  return [...jar(name).entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function call(who, path, options = {}) {
  const headers = { ...(options.headers ?? {}) }
  const cookies = cookieHeader(who)
  if (cookies) headers.cookie = cookies
  if (options.body) headers['content-type'] = 'application/json'
  const csrf = jar(who).get('ilikon_csrf')
  if (csrf && options.method && options.method !== 'GET') headers['x-csrf-token'] = csrf

  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: 'manual',
  })

  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';')
    const idx = pair.indexOf('=')
    jar(who).set(pair.slice(0, idx), pair.slice(idx + 1))
  }

  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* html response */
  }
  return { status: res.status, json, text }
}

let pass = 0
let fail = 0
function check(label, ok, detail = '') {
  if (ok) {
    pass += 1
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function login(who, identifier) {
  const res = await call(who, '/api/auth/login', {
    method: 'POST',
    body: { identifier, password: passwordFor(identifier) },
  })
  // The login endpoint allows 8 attempts per IP per 5 minutes. Running this
  // suite twice in quick succession legitimately trips it — surface that
  // clearly instead of reporting dozens of confusing downstream failures.
  if (res.status === 429) {
    console.error(
      '\nRATE LIMITED on /api/auth/login (8 attempts / 5 min per IP).\n' +
        'That is the limiter working as designed. Wait ~5 minutes and re-run.\n',
    )
    process.exit(2)
  }
  return res.json?.ok === true
}

async function main() {
  console.log('\n=== 1. Authentication & RBAC ===')
  check('super admin login', await login('admin', 'admin@ilikon.mn'))
  check('pharmacist login', await login('rx', 'pharmacist@ilikon.mn'))
  check('order manager login', await login('om', 'orders@ilikon.mn'))
  check('customer login', await login('cust', 'delgermaa@example.mn'))
  const bad = await call('anon', '/api/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@ilikon.mn', password: 'wrong-password' },
  })
  check('wrong password rejected', bad.status === 401)

  console.log('\n=== 2. Admin creates a prescription product ===')
  const cats = await call('admin', '/api/categories')
  const rxCat =
    cats.json.data.categories
      .flatMap((c) => [c, ...(c.children ?? [])])
      .find((c) => c.slug === 'joroor-olgoh-em') ?? cats.json.data.categories[0]

  const sku = `E2E-${Date.now().toString(36).toUpperCase()}`
  const created = await call('admin', '/api/products', {
    method: 'POST',
    body: {
      sku,
      name: 'E2E жороор олгох эм',
      categoryId: rxCat.id,
      price: 25000,
      prescriptionRequired: true,
      status: 'ACTIVE',
      stockQuantity: 10,
      lowStockThreshold: 3,
      translations: {
        mn: { name: 'E2E жороор олгох эм', shortDescription: 'E2E тест', warnings: 'Эмчийн жороор' },
      },
    },
  })
  check('product created', created.json?.ok === true, created.json?.error?.code ?? '')
  const productId = created.json?.data?.product?.id
  const productSlug = created.json?.data?.product?.slug

  const forbidden = await call('om', '/api/products', {
    method: 'POST',
    body: { sku: `${sku}-X`, name: 'x', categoryId: rxCat.id, price: 1 },
  })
  check('order manager cannot create products', forbidden.status === 403)

  console.log('\n=== 3. Product appears on the storefront ===')
  const search = await call('anon', `/api/products?q=${sku}`)
  check('found via search API', search.json?.data?.total === 1)
  check('marked prescription-required', search.json?.data?.items?.[0]?.prescriptionRequired === true)
  check('stock is 10', search.json?.data?.items?.[0]?.stock === 10)
  const detail = await call('anon', `/mn/products/${productSlug}`)
  check('product page renders', detail.status === 200)
  check('page shows Rx notice', detail.text.includes('Жороор олгоно') || detail.text.includes('жор'))

  console.log('\n=== 4. Customer orders it ===')
  await call('cust', '/api/cart', { method: 'DELETE' })
  const added = await call('cust', '/api/cart/items', {
    method: 'POST',
    body: { productId, quantity: 2 },
  })
  check('added to cart', added.json?.ok === true)
  check('cart flags prescription requirement', added.json?.data?.requiresPrescription === true)

  const over = await call('cust', '/api/cart/items', {
    method: 'PATCH',
    body: { productId, quantity: 99 },
  })
  check('over-stock quantity rejected', over.status === 409, over.json?.error?.code ?? '')

  const coupon = await call('cust', '/api/cart/coupon', {
    method: 'POST',
    body: { code: 'ILIKON10' },
  })
  // ILIKON10 has a per-customer limit of 2; once this customer has used it up,
  // the correct behaviour is a refusal, not an application.
  check(
    'coupon evaluated (applied, or limit correctly enforced)',
    coupon.json?.ok === true || coupon.json?.error?.code === 'CUSTOMER_LIMIT_REACHED',
    coupon.json?.error?.code ?? 'applied',
  )

  const order = await call('cust', '/api/orders', {
    method: 'POST',
    body: {
      customerName: 'Отгонбаярын Дэлгэрмаа',
      customerPhone: '88220001',
      deliveryMethod: 'HOME_DELIVERY',
      district: 'Сүхбаатар',
      khoroo: '1-р хороо',
      addressLine: 'E2E тест хаяг 1',
      paymentMethod: 'CASH_ON_DELIVERY',
      agreeTerms: true,
    },
  })
  check('order created', order.json?.ok === true, order.json?.error?.code ?? '')
  const orderId = order.json?.data?.orderId
  const orderNumber = order.json?.data?.orderNumber
  check('order number format ILK-YYYYMMDD-NNNN', /^ILK-\d{8}-\d{4}$/.test(orderNumber ?? ''), orderNumber)
  check('order flagged as needing a prescription', order.json?.data?.requiresPrescription === true)

  console.log('\n=== 5. Inventory decremented through the ledger ===')
  const after = await call('anon', `/api/products?q=${sku}`)
  check('stock 10 → 8', after.json?.data?.items?.[0]?.stock === 8)
  const ledger = await call('admin', `/api/inventory/transactions?productId=${productId}`)
  const sale = ledger.json?.data?.transactions?.find((t) => t.type === 'SALE')
  check('SALE ledger entry written', Boolean(sale), sale ? `${sale.quantityDelta} → ${sale.balanceAfter}` : '')

  console.log('\n=== 6. Prescription gate blocks fulfilment ===')
  const blocked = await call('om', `/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status: 'PREPARING' },
  })
  check('cannot move to PREPARING without a verified prescription', blocked.status === 409, blocked.json?.error?.code ?? '')

  const confirming = await call('om', `/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status: 'CONFIRMING' },
  })
  check('CONFIRMING is allowed', confirming.json?.ok === true)

  console.log('\n=== 7. Customer uploads a prescription ===')
  // Minimal valid PNG so the server's magic-byte sniffing accepts it.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  )
  const upload = new FormData()
  upload.append('file', new Blob([png], { type: 'image/png' }), 'e2e-prescription.png')
  upload.append('orderId', orderId)
  upload.append('doctorName', 'Э. Батзориг')
  upload.append('clinic', 'E2E эмнэлэг')

  const uploadRes = await fetch(`${BASE}/api/prescriptions`, {
    method: 'POST',
    headers: {
      cookie: cookieHeader('cust'),
      'x-csrf-token': jar('cust').get('ilikon_csrf') ?? '',
    },
    body: upload,
  })
  const uploadJson = await uploadRes.json().catch(() => null)
  check('prescription uploaded', uploadJson?.ok === true, uploadJson?.error?.code ?? '')
  check('starts in PENDING', uploadJson?.data?.prescription?.status === 'PENDING')
  const uploadedId = uploadJson?.data?.prescription?.id

  console.log('\n=== 7b. Pharmacist verification ===')
  const rxList = await call('rx', '/api/prescriptions?scope=admin&status=PENDING')
  const pending =
    rxList.json?.data?.prescriptions?.find((p) => p.id === uploadedId) ??
    rxList.json?.data?.prescriptions?.[0]
  check('pharmacist sees it in the pending queue', Boolean(pending))
  check('queue entry is linked to the order', pending?.order?.orderNumber === orderNumber, pending?.order?.orderNumber ?? '')

  if (pending) {
    const nope = await call('om', `/api/prescriptions/${pending.id}/verify`, {
      method: 'PATCH',
      body: { action: 'APPROVE' },
    })
    check('order manager cannot verify', nope.status === 403, nope.json?.error?.code ?? '')

    const noReason = await call('rx', `/api/prescriptions/${pending.id}/verify`, {
      method: 'PATCH',
      body: { action: 'REJECT' },
    })
    check('reject without a reason is rejected', noReason.status === 422, noReason.json?.error?.code ?? '')

    const approved = await call('rx', `/api/prescriptions/${pending.id}/verify`, {
      method: 'PATCH',
      body: { action: 'APPROVE', pharmacistNote: 'E2E — жор бүрэн.' },
    })
    check('pharmacist approves', approved.json?.data?.status === 'VERIFIED')
  }

  console.log('\n=== 8. Prescription file access control ===')
  if (pending) {
    const asPharmacist = await call('rx', `/api/prescriptions/${pending.id}/file`)
    check('pharmacist can read the uploaded file', asPharmacist.status === 200, String(asPharmacist.status))
    const asAnon = await call('anon', `/api/prescriptions/${pending.id}/file`)
    check('anonymous access denied', asAnon.status === 401 || asAnon.status === 403, String(asAnon.status))
    const asInventoryStaff = await login('inv2', 'inventory@ilikon.mn')
    if (asInventoryStaff) {
      const asWrongStaff = await call('inv2', `/api/prescriptions/${pending.id}/file`)
      check('staff without the permission are denied', asWrongStaff.status === 403, String(asWrongStaff.status))
    }
    const audit = await call('admin', '/admin/audit')
    check('audit page reachable', audit.status === 200)
  }

  console.log('\n=== 9. Order can now advance ===')
  const prep = await call('om', `/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status: 'PREPARING' },
  })
  check('PREPARING now allowed', prep.json?.ok === true, prep.json?.error?.code ?? '')
  const shipped = await call('om', `/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status: 'SHIPPED' },
  })
  check('SHIPPED allowed', shipped.json?.ok === true)

  console.log('\n=== 10. Customer notifications ===')
  const notifications = await call('cust', '/api/notifications')
  const list = notifications.json?.data?.notifications ?? []
  check('customer has notifications', list.length > 0, `${list.length}`)
  check(
    'shipped notification present',
    list.some((n) => n.type === 'ORDER_SHIPPED'),
  )

  console.log('\n=== 11. Chatbot safety ===')
  const symptom = await call('anon', '/api/chatbot/message', {
    method: 'POST',
    body: { message: 'Толгой өвдөж байна, надад ямар эм уувал зохих вэ?', locale: 'mn' },
  })
  check('symptom question is blocked', symptom.json?.data?.intent === 'medical_advice_blocked', symptom.json?.data?.intent)
  check('escalated to a pharmacist', symptom.json?.data?.escalated === true)

  const emergency = await call('anon', '/api/chatbot/message', {
    method: 'POST',
    body: { message: 'I think I took an overdose and I cannot breathe', locale: 'en' },
  })
  check('emergency routed to 103', emergency.json?.data?.intent === 'emergency')
  check('emergency reply mentions 103', (emergency.json?.data?.content ?? '').includes('103'))

  const dosage = await call('anon', '/api/chatbot/message', {
    method: 'POST',
    body: { message: 'Сколько таблеток мне принять?', locale: 'ru' },
  })
  check('dosage question blocked (ru)', dosage.json?.data?.intent === 'medical_advice_blocked', dosage.json?.data?.intent)

  const productQuestion = await call('anon', '/api/chatbot/message', {
    method: 'POST',
    body: { message: 'Витамин C байна уу?', locale: 'mn' },
  })
  check('product search answered', productQuestion.json?.data?.intent === 'product_search')
  check(
    'grounded product card returned',
    (productQuestion.json?.data?.attachments?.products ?? []).length > 0,
  )

  const delivery = await call('anon', '/api/chatbot/message', {
    method: 'POST',
    body: { message: 'How does delivery work?', locale: 'en' },
  })
  check('delivery question answered', delivery.json?.data?.intent === 'delivery_info')

  console.log('\n=== 12. Expired stock is unsellable ===')
  const expired = await call('admin', '/api/products', {
    method: 'POST',
    body: {
      sku: `${sku}-EXP`,
      name: 'E2E хугацаа дууссан',
      categoryId: rxCat.id,
      price: 5000,
      status: 'ACTIVE',
      stockQuantity: 5,
      expiryDate: '2020-01-01',
      translations: { mn: { name: 'E2E хугацаа дууссан' } },
    },
  })
  const expiredId = expired.json?.data?.product?.id
  check('expired product created for the test', Boolean(expiredId))
  const expiredSearch = await call('anon', `/api/products?q=${sku}-EXP`)
  check('expired product hidden from the catalogue', expiredSearch.json?.data?.total === 0)
  const expiredCart = await call('cust', '/api/cart/items', {
    method: 'POST',
    body: { productId: expiredId, quantity: 1 },
  })
  check('expired product cannot be added to cart', expiredCart.status >= 400, expiredCart.json?.error?.code ?? '')

  console.log('\n=== 13. Contact masking for staff without permission ===')
  const asInventory = await login('inv', 'inventory@ilikon.mn')
  check('inventory manager login', asInventory)
  const custList = await call('inv', '/api/customers')
  check(
    'inventory manager blocked from customer list',
    custList.status === 403,
    custList.json?.error?.code ?? '',
  )
  const omCust = await call('om', '/api/customers')
  const first = omCust.json?.data?.customers?.[0]
  check('order manager sees customers', omCust.json?.ok === true)
  check('order manager sees unmasked contact', first?.contactMasked === false)

  console.log('\n=== 14. Cleanup ===')
  for (const id of [productId, expiredId].filter(Boolean)) {
    const del = await call('admin', `/api/products/${id}`, { method: 'DELETE' })
    check(`product ${id.slice(-6)} removed`, del.json?.ok === true)
  }
  const cancel = await call('admin', `/api/orders/${orderId}/cancel`, {
    method: 'POST',
    body: { reason: 'E2E тестийн дараа цуцлав' },
  })
  check('test order cancelled (stock returned)', cancel.json?.ok === true)

  console.log(`\n${'='.repeat(52)}`)
  console.log(`  ${pass} passed, ${fail} failed`)
  console.log('='.repeat(52))
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('\nE2E harness crashed:', error)
  process.exit(1)
})
