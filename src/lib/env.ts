/**
 * Validated environment access.
 *
 * Every secret is read here, on the server, and nowhere else. Nothing in this
 * module may be imported from a Client Component — the only values safe for the
 * browser are the `NEXT_PUBLIC_*` ones re-exported through `publicEnv`.
 */
import { z } from 'zod'

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters — generate with `openssl rand -base64 48`'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage/uploads'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('auto'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_PUBLIC_BASE_URL: z.string().optional().default(''),

  ANTHROPIC_API_KEY: z.string().optional().default(''),
  CHATBOT_MODEL: z.string().optional().default('claude-sonnet-5'),
  /** Consultation agent model. Safety-critical reasoning — keep it on a frontier model. */
  CONSULTATION_MODEL: z.string().optional().default('claude-opus-5'),

  QPAY_USERNAME: z.string().optional().default(''),
  QPAY_PASSWORD: z.string().optional().default(''),
  QPAY_INVOICE_CODE: z.string().optional().default(''),
  QPAY_BASE_URL: z.string().optional().default('https://merchant.qpay.mn/v2'),
  CARD_GATEWAY_API_KEY: z.string().optional().default(''),
  CARD_GATEWAY_BASE_URL: z.string().optional().default(''),

  BANK_TRANSFER_ACCOUNT: z.string().optional().default(''),
  BANK_TRANSFER_BANK: z.string().optional().default(''),
  BANK_TRANSFER_HOLDER: z.string().optional().default(''),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
})

type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | null = null

export function env(): ServerEnv {
  if (cached) return cached
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  cached = parsed.data
  return cached
}

/** Safe for the browser. */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
}

export const isProduction = () => env().NODE_ENV === 'production'
