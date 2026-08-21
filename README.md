# Иликон — Уужим Эмийн Сан

Online pharmacy storefront and staff back office for a Mongolian pharmacy.
Trilingual (Монгол / English / Русский), built around one rule: **a prescription
medicine is never dispensed without a prescription verified by a licensed
pharmacist.**

Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma · Tailwind CSS

Repository: <https://github.com/aitmuhamed/Ilikon>

**Монгол гарын авлага:** [`docs/garyn-avlaga.html`](docs/garyn-avlaga.html) —
тохируулгаас AI зөвлөгөө, хостинг, асуудал шийдвэрлэх хүртэл 14 хэсэг.

Татаж авах, PDF болгох:

```bash
# Файлыг татаад хөтчөөр нээх (интернэтгүй ч ажиллана)
open docs/garyn-avlaga.html        # macOS
start docs\garyn-avlaga.html       # Windows
```

Хөтөч дээр **Ctrl+P** (macOS: **Cmd+P**) → *Save as PDF*. Хуудас нь A4-т
тохируулсан хэвлэх хэлбэртэй: агуулгын хажуугийн цэс нуугдаж, хэсэг бүр шинэ
хуудаснаас эхэлж, код блокууд таслагдахгүй мөр дамжина.

---

## Quick start

```bash
# 0. Clone
git clone https://github.com/aitmuhamed/Ilikon.git
cd Ilikon

# 1. Database (Docker)
docker compose up -d db

# 2. Configure
cp .env.example .env
#   → set AUTH_SECRET (openssl rand -base64 48)
#   → check DATABASE_URL matches the port in docker-compose.yml (5439)

# 3. Install, migrate, seed
npm install
npm run setup          # prisma generate + migrate deploy + db:seed

# 4. Run
npm run dev            # http://localhost:3000
```

| Surface    | URL                             |
| ---------- | ------------------------------- |
| Storefront | `http://localhost:3000/mn`      |
| English    | `http://localhost:3000/en`      |
| Russian    | `http://localhost:3000/ru`      |
| Admin      | `http://localhost:3000/admin`   |

### Demo accounts

The seed gives every account the same password, `Ilikon2026!`. That is fine on a
laptop and **unacceptable the moment the app is reachable from the internet** —
this file is public, so the password is too.

Rotate before exposing the app anywhere:

```bash
npm run rotate:passwords            # staff accounts
npm run rotate:passwords -- --customers   # staff + customers
```

It issues one strong random password per account and prints them once. Re-running
`npm run db:seed` will not undo it — the seed leaves an existing password hash
alone.

After rotating, the test scripts need the new values:

```bash
export TEST_PASSWORD='...'                     # if every account shares one
export TEST_PASSWORD_MAP='{"admin@ilikon.mn":"...","orders@ilikon.mn":"..."}'
npm run test:e2e 3007
```

| Role              | Login                   | Can do                                        |
| ----------------- | ----------------------- | --------------------------------------------- |
| Super Admin       | `admin@ilikon.mn`       | everything, including roles & settings        |
| Admin             | `manager@ilikon.mn`     | catalogue, orders, customers, reports         |
| **Pharmacist**    | `pharmacist@ilikon.mn`  | **verify prescriptions** + medicine data      |
| Inventory Manager | `inventory@ilikon.mn`   | stock, batches, expiry                        |
| Order Manager     | `orders@ilikon.mn`      | orders, deliveries, payments                  |
| Delivery Staff    | `delivery@ilikon.mn`    | only their own assigned deliveries            |
| Customer          | `delgermaa@example.mn`  | storefront                                    |

Rotate every password and `AUTH_SECRET` before deploying anywhere real.

### Database access (DBeaver / psql)

The Docker Postgres publishes on **5439**, not the default 5432.

| Field    | Value                 |
| -------- | --------------------- |
| Host     | `localhost`           |
| Port     | `5439`                |
| Database | `ilikon`              |
| User     | `ilikon`              |
| Password | `ilikon_dev_password` |
| Schema   | `public`              |

To register the connection in DBeaver without clicking through the wizard,
**close DBeaver** and run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dbeaver-connect.ps1
```

It merges the connection into DBeaver's `data-sources.json` (backing the file up
first) and leaves the password unsaved, so DBeaver prompts once and stores it in
its own encrypted keyring. It refuses to run while DBeaver is open, because
DBeaver rewrites that file on exit and would discard the change.

Straight psql, without a local client installed:

```bash
docker exec -it ilikon-db psql -U ilikon -d ilikon
```

---

## What is implemented

### Storefront
Home with categories, featured / popular / new / discounted shelves, themed
vitamin, wellness and device shelves, a prescription-medicine section, delivery
and pharmacy information · catalogue with search across name, brand, active
ingredient, SKU and barcode plus category / brand / price / availability /
prescription / discount / rating filters and seven sort orders · product pages
with gallery, dosage, warnings, side effects, storage, structured data and
reviews · server-side cart with stock validation and coupons · three-step
checkout · customer accounts with order history, reorder, addresses, wishlist,
notifications and prescriptions · prescription upload · about / contact / FAQ /
terms / privacy · the **Иликон** assistant · the **Иликон AI health
consultation** with pharmacist handoff and per-customer consultation history.

### Admin
Dashboard (sales, orders, customers, funnel, alerts, six chart types, date
ranges) · orders with timeline, status workflow, internal notes, courier
assignment, printable invoice · full product CRUD across five tabs with
per-language medicine copy · categories (nested) · brands · inventory with a
signed ledger, batches, low-stock and expiry write-offs · **prescription
verification queue** · customers · coupons · promotions · review moderation ·
delivery board · payments · chatbot transcripts · notification broadcast ·
**AI consultation dashboard** (triage funnel, emergency and pharmacist
referrals, common symptoms and categories, knowledge-base counts, full
per-consultation record with the AI audit trail and the pharmacist review form) ·
reports with CSV export · staff · granular role permissions · settings · audit
log.

### The chain, end to end
Admin creates a product → it appears on the storefront → customer orders →
inventory decrements through the ledger → order shows in admin → payment status
updates → pharmacist verifies the prescription when one is required → delivery
status advances → the customer is notified at each step.

---

## Pharmacy safety

These are enforced in code, not just in copy:

- **Prescription gate.** `updateOrderStatus` refuses to move an order to
  Preparing / Shipped / Delivered while `requiresPrescription && !prescriptionCleared`.
  Only `PATCH /api/prescriptions/:id/verify` can clear it, and that route
  requires the `prescriptions.verify` permission *and* a pharmacist role — the
  check is duplicated deliberately (`src/app/api/prescriptions/[id]/verify/route.ts`).
- **No auto-approval.** A prescription is created `PENDING`; no code path sets
  `VERIFIED` without a `PrescriptionReview` row naming the reviewer and reason.
- **Expired stock is unsellable.** `sellableWhere()` excludes anything past its
  expiry date, and `assertSellable()` re-checks inside the order transaction.
- **Prescription files are private.** Stored outside `public/`, never behind a
  public URL, served only by `/api/prescriptions/:id/file` after an ownership or
  permission check — and every read *and refusal* is written to the audit log.
- **The chatbot cannot practise medicine.** Messages are screened before
  anything else; symptom, dosage, interaction, pregnancy, allergy, overdose and
  emergency questions never reach the model and get a pharmacist / 103 redirect.
  Product answers are grounded in live catalogue rows, so it cannot invent a
  medicine, a price or a stock figure (`src/lib/chatbot.ts`).
- **Rx is visually unmistakable** — a solid blue badge on cards, lists, cart,
  checkout, order and admin tables; OTC is a quiet green outline.

---

## AI health consultation — «Иликон-той зөвлөлдөх»

A structured health questionnaire that triages a customer's complaint and, when
it is appropriate, offers OTC products **from the pharmacy's own catalogue**. It
is a triage and support tool, not a prescriber: it never diagnoses, never sets a
dose, and never dispenses a prescription medicine.

Entry points: the home-page banner, the header nav, `/{locale}/consultation`,
and the customer's own history under `/{locale}/account/consultations`.

### The pipeline

Every consultation runs the same fixed sequence (`src/lib/consultation/engine.ts`):

```
answers → red-flag assessment → guideline lookup → triage
        → contraindication check → interaction check → duplicate check
        → catalogue retrieval → ranking → response composition
        → safety validation → stored result
```

Two invariants hold throughout, and both are covered by tests:

- **The model never decides.** Triage comes from `triage.ts`, safety verdicts
  from the rule tables, products from the catalogue. Claude only *reads* free
  text (mapping it onto existing symptom and red-flag codes) and *phrases* the
  final wording. With no API key, or with the LLM switched off in settings, the
  engine produces the same decisions and falls back to deterministic templates —
  it degrades in fluency, never in correctness.
- **An emergency ends the pipeline.** No retrieval runs, no product row is
  written, and the response carries nothing beneath the emergency message.

### Four triage levels

| Level | Outcome |
| --- | --- |
| 1 EMERGENCY | Emergency message only. No products, ever. |
| 2 URGENT_MEDICAL_REVIEW | See a doctor today. No self-treatment encouraged. |
| 3 PHARMACIST_CONSULTATION | An OTC option may exist, held for pharmacist review. |
| 4 SELF_CARE | Self-care guidance plus OTC options. |

Triage only ever *escalates*: `mostUrgent()` makes rule order irrelevant, so
adding a rule can never make an existing consultation less cautious. The
contraindication and interaction engines run after triage, so their findings feed
back through `escalateOutcome()` — a customer on warfarin cannot get a clean
self-care verdict just because the risky product was filtered out.

### Safety enforced in code

- **Consent gate.** No question is issued until the disclaimer is accepted; the
  answer endpoint returns 409 until then, so consent cannot be skipped by
  calling the API directly.
- **Red flags are additive.** Rule answers, free-text patterns (mn/en/ru) and
  the model's second-opinion screen can only *add* flags. Nothing except a
  pharmacist can clear one, and severity comes from the catalogue rather than
  from whichever detector fired.
- **Prescription-only products are excluded by the query**, not by later
  filtering (`retrieval.ts`), alongside out-of-stock, expired and admin-blocked
  rows.
- **Missing information never becomes a PASS.** An unresolved medicine name, an
  unknown allergy or an undisclosed pregnancy where it is clinically relevant all
  produce `UNKNOWN`, which routes to a pharmacist. A male patient's null
  pregnancy status is *known*, not unknown, so it does not.
- **No generated dosages.** `validateComposition()` re-reads every generated
  sentence and rejects dose instructions, diagnosis-certainty phrasing, mentions
  of prescription-only ingredients, and any product suggestion inside an
  emergency response. A rejection falls back to the deterministic wording, and
  the violation is logged.
- **Duplicate active ingredients** are detected both against what the customer
  already takes and across the suggested set (§18).
- **Ranking cannot be bought.** `ranking.ts` orders by status → safety → clinical
  relevance → name. It never reads `costPrice`, `price` or margin.
- **The AI never overrides a pharmacist.** Once a review exists the engine
  refuses to re-run (409), and `addedByPharmacist` rows survive every
  re-assessment.

### Verified knowledge base

Nothing clinical is hardcoded in the agent. Guidelines, contraindications and
interactions are database rows, each carrying a `sourceId` pointing at a
`KnowledgeSource` with a version and an approving pharmacist:

| Table | Purpose |
| --- | --- |
| `KnowledgeSource` | Provenance: insert, protocol, interaction database |
| `ActiveIngredient` + `MedicationAlias` | Canonical ingredients plus the brand names customers actually type |
| `ProductIngredient` | What each catalogue product really contains |
| `OtcGuideline` | Per-symptom scope, self-care window, rationale — the only thing that permits an OTC suggestion |
| `ContraindicationRule` | Age / pregnancy / breastfeeding / condition / allergy limits |
| `InteractionRule` | Verified pairwise verdicts (safe / caution / significant risk / unknown) |

The seed ships pharmacist-shaped demo content (15 guidelines, 29 ingredients,
33 contraindication rules, 16 interaction rules). **It must be reviewed and
re-approved by the pharmacy's own licensed pharmacist before go-live** — the
`version` and `approvedAt` columns exist so that review is recorded.

### Pharmacist handoff and review

"Фармацевттай зөвлөх" sends a complete clinical packet (symptoms, duration,
severity, history, allergies, current medicines, pregnancy status, red flags, AI
triage and AI recommendations) to the staff queue. A pharmacist may accept,
modify, reject, note, request more information, or recommend a product
themselves. Every review stores the AI's proposal alongside the pharmacist's and
the stated reason for the change.

`consultations.review` is granted to the pharmacist role only. An admin can read
consultations and configure the agent, but cannot perform a clinical review, and
cannot touch safety rules without `consultations.safety`.

### Privacy and retention

Health answers are readable only by the owning customer, the anonymous visitor
holding the httpOnly continuation cookie, and staff with `consultations.view` —
every staff read is audit-logged. Anything else gets a 404 rather than a 403, so
a consultation id is not confirmable by someone who cannot read it.

`npm run consultations:purge` deletes free text, answers, medication and allergy
lists past the retention horizon while keeping the non-identifying outcome and
the AI audit trail. Run it on a schedule.

### Audit

`ConsultationAuditEntry` records one row per pipeline stage — red-flag
screening, triage, each safety check, retrieval, ranking, composition,
validation, handoff, review — with the model id, prompt version, rules version
and latency. The admin detail page shows the whole trail, plus every product
*considered* (not only those shown) with its safety and relevance scores.

---

## Security

bcrypt (12 rounds) password hashing · httpOnly signed JWT sessions with
double-submit CSRF and an origin check · permissions resolved from the database
on every request, so revoking a role takes effect immediately · Zod validation
on every endpoint with length caps · uploads validated by sniffed magic bytes,
not filename · path-traversal guard on storage keys · per-endpoint rate limits ·
audit log on privileged mutations · contact details masked from staff without
`customers.viewContact` · CSP and security headers in `next.config.ts` ·
secrets only in server env (`src/lib/env.ts`), never sent to the browser.

`npm run db:seed` prints a reminder that the demo credentials are not
production credentials.

---

## Layout

```
prisma/
  schema.prisma         31 models — money as Int MNT, soft deletes, *Translation tables
  seed.ts               entry point (idempotent)
  seed-core.ts          roles, permissions, taxonomy, products, users, settings
  seed-orders.ts        orders, prescriptions, reviews, notifications, analytics
  seed-products-*.ts    35 products with mn/en/ru copy
src/
  lib/                  domain layer: auth, rbac, orders, cart, inventory,
                        coupons, payments, chatbot, reports, storage, seo, api
  i18n/                 mn (reference) + en + ru; mn's shape types the others
  components/ui/        button, field, primitives, dialog, toast
  components/site/      header, footer, product card, cart, checkout, chatbot…
  components/admin/     shell, charts (hand-rolled SVG), table, forms
  app/[locale]/         storefront (locale-prefixed, hreflang, canonical)
  app/admin/            back office (locale-free, permission-filtered nav)
  app/api/              REST API — every route through the `route()` wrapper
```

### Notable choices

- **Money is `Int` MNT.** The tögrög has no circulating subunit, so integers keep
  every total exact and avoid `Decimal` serialisation hazards.
- **Translations are rows, not columns.** A fourth language is a data migration.
- **Charts are hand-rolled SVG.** Four shapes were needed; a charting library
  would have been larger than the code it replaced and needed its defaults
  overridden anyway.
- **The cart lives on the server.** Prices and stock are re-read on every
  mutation, so a tampered client cannot change what is charged or dispensed.
- **Payments are behind an interface.** `PaymentProvider` has cash, bank
  transfer, card and QPay drivers; QPay verifies via a server-to-server payment
  lookup rather than trusting the callback body. Contracting a new Mongolian
  gateway is a new file plus one entry in `PROVIDERS`.

---

## Configuration

`.env.example` documents everything. The essentials:

| Variable                | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection                              |
| `AUTH_SECRET`           | session signing key, ≥ 32 chars                    |
| `NEXT_PUBLIC_SITE_URL`  | canonical URLs, sitemap, Open Graph                |
| `STORAGE_DRIVER`        | `local` (default) or `s3`                          |
| `ANTHROPIC_API_KEY`     | optional — chatbot and consultation phrasing only  |
| `CONSULTATION_MODEL`    | consultation agent model (default `claude-opus-5`) |
| `QPAY_*`, `CARD_*`      | gateway credentials; admin shows configured or not |

Operational values — delivery fee, free-delivery threshold, working hours,
chatbot greeting, SEO defaults — are edited in **Admin → Settings**, not in code.
Consultation settings (enabled, languages, product cap, retention, escalation
threshold, disclaimer, emergency number, prompt additions) live in
**Admin → AI consultations**; the safety-critical subset requires the
`consultations.safety` permission, which no default role holds except Super
Admin.

## Commands

```bash
npm run dev            npm run build          npm start
npm run typecheck      npm run db:seed        npm run db:reset
npm run prisma:migrate npm run prisma:studio

npm run responsive:audit 3007       # horizontal-overflow traps across every admin page
npm run test:consultation           # consultation engine scenarios (no server needed)
npm run test:consultation:e2e 3007  # consultation over HTTP (server must be running)
npm run consultations:purge         # data-retention pass — run on a schedule
```

## Deployment

```bash
docker compose --profile full up -d --build   # app + postgres
```

**Cloudflare:** see [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md). The quickest route
is a Cloudflare Tunnel, which needs no code change and no public IP:

```bash
echo 'CLOUDFLARE_TUNNEL_TOKEN=...' >> .env
docker compose --profile full --profile tunnel up -d --build
```

Then, inside the container or against the same database:

```bash
npx prisma migrate deploy
npm run db:seed        # first boot only
```

Checklist before going live: rotate `AUTH_SECRET` and every seeded password ·
set `NEXT_PUBLIC_SITE_URL` to the real host · terminate TLS in front of the app ·
point `STORAGE_DRIVER=s3` at a **private** bucket for prescriptions · fill in the
gateway credentials · move the rate limiter to Redis if you run more than one
instance · have counsel review `/terms` and `/privacy`, which are working drafts.

---

## Known limits

- Password reset generates and stores a hashed token but has no SMS/email
  transport wired up; outside production the token is returned so the flow is
  testable.
- The rate limiter is in-process — correct for one instance, needs Redis behind
  a load balancer.
- Seed placeholder artwork is generated SVG, and the seeded prescription rows
  point at a placeholder object key; uploading a real file through the UI stores
  and serves it properly.
- **The consultation knowledge base is demo content.** It is modelled on standard
  OTC self-care practice and structured exactly as production data would be, but
  every guideline, contraindication and interaction row must be reviewed and
  re-approved by the pharmacy's own licensed pharmacist before the agent is
  offered to real customers.
- The consultation's LLM path (free-text symptom extraction, the second-opinion
  red-flag screen, and response phrasing) has not been exercised against the live
  API in this environment because no `ANTHROPIC_API_KEY` is configured. The
  deterministic engines — which make every safety decision — are covered by
  `npm run test:consultation` and `npm run test:consultation:e2e`.
- Barcode entry is a numeric field looked up against the catalogue, not a camera
  scanner; wiring a device scanner or `BarcodeDetector` is a UI change only, the
  API is already in place.
- **6 high-severity advisories remain in transitive dependencies** (`sharp` /
  libvips, `postcss`, both pulled in by Next.js). Clearing them needs
  `next@16`, a major upgrade that deserves its own regression pass — run
  `npm audit` for the current list. Nothing reachable from request handling:
  `sharp` is used by Next's image optimiser at build/serve time.
- The rate limiter keys anonymous callers by IP. Mongolian mobile carriers put
  many subscribers behind one address, so the caps are deliberately loose; move
  the limiter to Redis and key it per session for tighter, fairer limits.
