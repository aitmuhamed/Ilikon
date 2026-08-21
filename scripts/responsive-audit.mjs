/**
 * Responsive audit of the admin tree (and the storefront).
 *
 *   TEST_PASSWORD=... node scripts/responsive-audit.mjs <port>
 *
 * There is no headless browser in this project, so this does not measure
 * layout. It looks for the things that actually cause horizontal scroll on a
 * phone, in the HTML the server sends:
 *
 *   1. a <table> that is not inside an overflow-x container
 *   2. a `min-w-[Npx]` / `min-w-N` wider than a phone, with no scrolling ancestor
 *   3. a fixed `w-[Npx]` wider than a phone
 *   4. a missing responsive viewport meta tag
 *
 * Anything it flags is a real risk; a clean run is not proof of a perfect
 * layout, only that these specific traps are absent.
 *
 * NOT covered — check these by hand on a real phone:
 *
 *   • A `position: fixed` drawer nested inside an element with
 *     `backdrop-filter` (Tailwind `backdrop-blur`). The blurred element becomes
 *     the containing block, so the drawer collapses into it instead of filling
 *     the viewport. This bit the storefront header once. Detecting it reliably
 *     needs a JSX parser, and a line-based approximation reported "clean" while
 *     the bug was present, which is worse than not checking at all.
 *   • Anything that only misbehaves after hydration, since this reads the
 *     server-rendered HTML.
 */
const PORT = process.argv[2] ?? '3007'
const BASE = `http://localhost:${PORT}`
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'Ilikon2026!'

// Narrowest common phone. Anything forced wider than this scrolls sideways.
const PHONE_WIDTH = 360

const ADMIN_PATHS = [
  '/admin',
  '/admin/orders',
  '/admin/prescriptions',
  '/admin/delivery',
  '/admin/payments',
  '/admin/products',
  '/admin/products/new',
  '/admin/categories',
  '/admin/brands',
  '/admin/inventory',
  '/admin/customers',
  '/admin/reviews',
  '/admin/chatbot',
  '/admin/consultations',
  '/admin/notifications',
  '/admin/coupons',
  '/admin/promotions',
  '/admin/reports',
  '/admin/staff',
  '/admin/roles',
  '/admin/settings',
  '/admin/audit',
]

const PUBLIC_PATHS = [
  '/mn',
  '/mn/products',
  '/mn/consultation',
  '/mn/cart',
  '/mn/checkout',
  '/mn/account',
  '/mn/contact',
]

let cookie = ''

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@ilikon.mn', password: TEST_PASSWORD }),
  })
  cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  return res.ok
}

/**
 * Is this offset inside an element that scrolls horizontally? Walks back a
 * bounded window of markup looking for an overflow utility, which is where the
 * wrapper lives in practice.
 */
function hasScrollingAncestor(html, index) {
  const window = html.slice(Math.max(0, index - 700), index)
  return /overflow-x-auto|overflow-auto|overflow-x-scroll|overflow-scroll/.test(window)
}

function auditPage(path, html) {
  const issues = []

  // 1. tables without a scroll wrapper
  for (const m of html.matchAll(/<table\b/g)) {
    if (!hasScrollingAncestor(html, m.index)) {
      issues.push({ kind: 'table-no-scroll', detail: 'a <table> has no overflow-x ancestor' })
    }
  }

  // 2. min-widths wider than a phone
  for (const m of html.matchAll(/min-w-\[(\d+)px\]/g)) {
    const px = Number(m[1])
    if (px > PHONE_WIDTH && !hasScrollingAncestor(html, m.index)) {
      issues.push({ kind: 'min-width', detail: `min-w-[${px}px] with no overflow-x ancestor` })
    }
  }

  // 3. fixed widths wider than a phone
  for (const m of html.matchAll(/[^-]w-\[(\d+)px\]/g)) {
    const px = Number(m[1])
    if (px > PHONE_WIDTH) {
      issues.push({ kind: 'fixed-width', detail: `w-[${px}px] is wider than a ${PHONE_WIDTH}px screen` })
    }
  }

  // 4. viewport meta
  if (!/name="viewport"/.test(html)) {
    issues.push({ kind: 'viewport', detail: 'no responsive viewport meta tag' })
  }

  // Collapse duplicates — one table pattern repeated 30 times is one finding.
  const seen = new Map()
  for (const issue of issues) {
    const key = `${issue.kind}|${issue.detail}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  return [...seen.entries()].map(([key, count]) => {
    const [kind, detail] = key.split('|')
    return { kind, detail, count }
  })
}

async function main() {
  if (!(await login())) {
    console.log('Admin login failed. Set TEST_PASSWORD if the accounts were rotated.')
    process.exitCode = 1
    return
  }

  let pagesWithIssues = 0
  let totalFindings = 0

  for (const group of [
    { name: 'ADMIN', paths: ADMIN_PATHS, auth: true },
    { name: 'STOREFRONT', paths: PUBLIC_PATHS, auth: false },
  ]) {
    console.log(`\n═══ ${group.name} ═══`)
    for (const path of group.paths) {
      const res = await fetch(`${BASE}${path}`, {
        headers: group.auth ? { cookie } : {},
        redirect: 'manual',
      })
      if (res.status >= 300 && res.status < 400) {
        console.log(`  ${path.padEnd(26)} ${res.status} (redirect, skipped)`)
        continue
      }
      if (!res.ok) {
        console.log(`  ${path.padEnd(26)} ✗ HTTP ${res.status}`)
        pagesWithIssues++
        continue
      }
      const html = await res.text()
      const issues = auditPage(path, html)
      if (issues.length === 0) {
        console.log(`  ${path.padEnd(26)} ok`)
      } else {
        pagesWithIssues++
        totalFindings += issues.length
        console.log(`  ${path.padEnd(26)} ${issues.length} issue(s)`)
        for (const issue of issues) {
          console.log(`      • ${issue.detail}${issue.count > 1 ? ` (x${issue.count})` : ''}`)
        }
      }
    }
  }

  console.log(
    pagesWithIssues === 0
      ? '\nOK  No horizontal-overflow traps found\n'
      : `\n!!  ${totalFindings} finding(s) across ${pagesWithIssues} page(s)\n`,
  )
  if (pagesWithIssues > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
