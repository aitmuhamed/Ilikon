# Hosting Иликон on Cloudflare

Three ways to put this app behind Cloudflare, in increasing order of effort.
Pick one — they are alternatives, not steps.

**Read this first:** the app currently talks to a PostgreSQL database running in
Docker on a local machine. Nothing in the cloud can reach that. Options 1 and 2
keep the database where it is; option 3 requires a managed PostgreSQL first.

---

## Option 1 — Cloudflare Tunnel (works today, no code change)

The app keeps running as Docker on whatever machine you like — a laptop, an
office box, a VPS — and `cloudflared` dials out to Cloudflare. You get a real
hostname with TLS, WAF, DDoS protection and caching, **without opening a single
inbound port** and without a public IP.

This is the right choice for a demo, an internal pilot, or a first production
run on modest traffic.

```bash
# 1. Create the tunnel
#    Cloudflare dashboard → Zero Trust → Networks → Tunnels → Create a tunnel
#    Choose "Cloudflared", name it "ilikon", and copy the token it shows.

# 2. Store the token (never commit it — .env is gitignored)
echo 'CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...' >> .env

# 3. Point the tunnel at the app
#    In the tunnel's "Public Hostname" tab:
#      Subdomain: ilikon        Domain: yourdomain.mn
#      Service:   HTTP          URL:    app:3000
#    (`app` is the Compose service name — both containers share a network.)

# 4. Set the public URL so canonical links and Open Graph are correct
echo 'NEXT_PUBLIC_SITE_URL=https://ilikon.yourdomain.mn' >> .env

# 5. Bring everything up
docker compose --profile full --profile tunnel up -d --build

# 6. First boot only
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed
```

### Port 3000 must be free

The `app` service publishes 3000 on the host. If something already listens
there (a `next start` from development, for instance), the container will not
start:

```
Error response from daemon: ports are not available: ... bind: Only one usage
of each socket address is normally permitted.
```

Stop whatever holds the port, or drop the `ports:` block from the `app` service
entirely — with a tunnel it is not needed. cloudflared reaches the app over the
internal Compose network, and not publishing the port means the origin cannot be
hit directly, bypassing Cloudflare's WAF. That is the better setup for
production.

### Verified

The production image and the tunnel wiring were tested end to end on
2026-08-21:

- `docker compose --profile full build app` — builds clean
- the container reports `healthy` and serves `/mn`, `/mn/consultation`,
  `/mn/products`, `/mn/contact`; `/admin` correctly 307s to login
- the full suites pass **against the container**, not just the dev server:
  56/56 (`scripts/e2e.mjs`) and 37/37 (`scripts/consultation-e2e.mjs`)
- `cloudflare/cloudflared:2026.8.2` pulls and runs
- a sibling container reaches `http://app:3000/mn` over the Compose network,
  which is exactly the hop cloudflared makes

The only thing not exercised is the tunnel itself, which needs a real token.

Then, in the Cloudflare dashboard:

- **SSL/TLS → Overview:** set encryption mode to **Full (strict)**.
- **Security → WAF:** enable the Cloudflare Managed Ruleset.
- **Security → Bots:** turn on Bot Fight Mode.
- **Rules → Rate limiting:** add a rule for `/api/auth/login` (about 10 requests
  per minute per IP). The app has its own in-process limiter, but that one is
  per-instance and resets on restart.
- **Caching → Rules:** bypass cache for `/api/*` and `/admin/*`. Everything under
  `/api/consultations/*` returns health data and must never be cached.

### Do not skip

Rotate everything before this is public:

```bash
openssl rand -base64 48        # new AUTH_SECRET
```

Change `POSTGRES_PASSWORD` in `docker-compose.yml` and the matching
`DATABASE_URL`, and change every seeded account password (they are published in
the README as demo credentials).

---

## Option 2 — Cloudflare in front of a VPS

Same app, same Docker Compose, but running on a VPS with a public IP; Cloudflare
sits in front as DNS + CDN + WAF.

1. Deploy `docker compose --profile full up -d --build` on the VPS.
2. Put Caddy or nginx in front of the app for TLS on the origin.
3. In Cloudflare DNS, add an **A record** for the hostname pointing at the VPS,
   **proxied** (orange cloud).
4. SSL/TLS mode **Full (strict)**.
5. Apply the same WAF, bot, rate-limiting and cache rules as option 1.
6. Lock the VPS firewall to Cloudflare's published IP ranges so the origin
   cannot be reached directly, bypassing the WAF.

---

## Option 3 — Cloudflare Workers (OpenNext)

Running the app *on* Cloudflare's edge rather than behind it. This is a genuine
migration, not a deployment step, because Workers cannot do several things the
app currently relies on.

### What has to change first

| Blocker | Why it breaks | What it needs |
| --- | --- | --- |
| Prisma → PostgreSQL over TCP | Workers have no raw TCP sockets | A managed PostgreSQL (Neon, Supabase, RDS…) plus **Hyperdrive**, and Prisma `driverAdapters` with `@prisma/adapter-pg` |
| Local file storage | No filesystem | `STORAGE_DRIVER=s3` pointed at **R2**. The S3 driver is already fetch-based SigV4, so it is R2-compatible as written |
| In-process rate limiter | Per-isolate, so the caps stop meaning anything | Workers KV or Durable Objects |
| `output: 'standalone'` in `next.config.ts` | Node server build | Remove it; `@opennextjs/cloudflare` produces the Worker bundle |
| `node:fs` / `node:path` in the local storage driver | Not available | Only reached by the `local` driver — unused once `STORAGE_DRIVER=s3` |
| Opus calls in the consultation pipeline | Long subrequests | Verify against Workers limits, or keep the consultation assessment on a Node service |

### Rough shape

```bash
npm install --save-dev @opennextjs/cloudflare wrangler
npx wrangler login                      # interactive — you must run this yourself

# Provision
npx wrangler hyperdrive create ilikon-db --connection-string "postgresql://..."
npx wrangler r2 bucket create ilikon-media
npx wrangler kv namespace create RATE_LIMIT
```

Then add `wrangler.jsonc` with the Hyperdrive, R2 and KV bindings, switch the
Prisma client to the driver adapter, move the rate limiter to KV, and deploy with
`npx opennextjs-cloudflare build && npx wrangler deploy`.

Budget real time for this, and re-run `npm run test:consultation` and
`npm run test:consultation:e2e` afterwards — the safety engines are the part you
least want silently changed by a runtime swap.

---

## Which one

- Want it reachable on your domain today, keeping the current database →
  **option 1**.
- Already have a VPS, want a conventional setup → **option 2**.
- Want edge hosting and are willing to move the database to a managed provider →
  **option 3**.

Options 1 and 2 need no application changes. Option 3 does.
