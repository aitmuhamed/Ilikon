# ════════════════════════════════════════════════════════════════════════
#  Иликон (Уужим Эмийн Сан) — production image
#
#  Multi-stage build producing a standalone Next.js server that runs as a
#  non-root user. Prisma's query engine is copied explicitly because the
#  standalone tracer does not always pick up the platform binary.
# ════════════════════════════════════════════════════════════════════════

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ── dependencies ───────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ── build ──────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# DATABASE_URL is required for `prisma generate` to resolve the datasource,
# but no connection is opened at build time. AUTH_SECRET is a build-time
# placeholder only — the real value is injected at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV AUTH_SECRET="build-time-placeholder-secret-value-32chars"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build -- --no-lint || npx next build

# ── runtime ────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migrations, schema and the Prisma CLI so the container can run
# `prisma migrate deploy` and the seed script on first boot.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Local storage for uploads (prescriptions, product media) when
# STORAGE_DRIVER=local. Mount a volume here in production.
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/cart/count').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
