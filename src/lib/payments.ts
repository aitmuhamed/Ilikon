import 'server-only'

import type { PaymentMethod, PaymentStatus } from '@prisma/client'

import { env } from './env'

/**
 * Payment provider abstraction.
 *
 * Each Mongolian gateway (QPay, bank card acquirers, Golomt/Khan hosted pages)
 * gets a driver implementing `PaymentProvider`. The order pipeline only ever
 * talks to this interface, so contracting a new gateway is a new file plus an
 * entry in `PROVIDERS` — no checkout or order code changes.
 *
 * Credentials are read from server environment variables only. No key, token
 * or merchant secret is ever sent to the browser or stored in the database.
 */

export interface PaymentIntent {
  /** How the order should behave right after creation. */
  initialStatus: PaymentStatus
  providerName: string
  providerRef?: string
  /** Redirect the customer here to complete payment. */
  redirectUrl?: string
  /** QR payload / deeplinks for wallet payments. */
  qrText?: string
  deeplinks?: { name: string; link: string }[]
  /** Non-secret display instructions (e.g. bank account to transfer to). */
  instructions?: Record<string, string>
  /** True when nothing further is needed from the customer online. */
  settledOffline: boolean
}

export interface CreateIntentInput {
  orderId: string
  orderNumber: string
  amount: number
  customerName: string
  customerPhone: string
  description: string
  returnUrl: string
}

export interface PaymentProvider {
  method: PaymentMethod
  /** False when the gateway has no credentials configured yet. */
  isConfigured(): boolean
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>
  /** Verifies a webhook/callback body before any status change is applied. */
  verifyCallback?(payload: unknown, signature: string | null): Promise<{ ok: boolean; providerRef?: string; paid: boolean }>
}

// ───────────────────────── cash on delivery ───────────────────────────────

const cashProvider: PaymentProvider = {
  method: 'CASH_ON_DELIVERY',
  isConfigured: () => true,
  async createIntent() {
    return {
      initialStatus: 'PENDING',
      providerName: 'cash',
      settledOffline: true,
    }
  },
}

// ─────────────────────────── bank transfer ────────────────────────────────

const bankProvider: PaymentProvider = {
  method: 'BANK_TRANSFER',
  isConfigured: () => Boolean(env().BANK_TRANSFER_ACCOUNT),
  async createIntent(input) {
    const e = env()
    return {
      initialStatus: 'AWAITING_CONFIRMATION',
      providerName: 'bank_transfer',
      settledOffline: true,
      instructions: {
        bank: e.BANK_TRANSFER_BANK,
        account: e.BANK_TRANSFER_ACCOUNT,
        holder: e.BANK_TRANSFER_HOLDER,
        // The order number doubles as the reconciliation reference.
        reference: input.orderNumber,
        amount: String(input.amount),
      },
    }
  },
}

// ───────────────────────────── card gateway ───────────────────────────────

const cardProvider: PaymentProvider = {
  method: 'CARD',
  isConfigured: () => Boolean(env().CARD_GATEWAY_API_KEY && env().CARD_GATEWAY_BASE_URL),
  async createIntent(input) {
    const e = env()
    if (!cardProvider.isConfigured()) {
      // No acquirer contracted yet: the order is accepted and settled at the
      // counter or on delivery instead of silently pretending to be paid.
      return {
        initialStatus: 'AWAITING_CONFIRMATION',
        providerName: 'card_pending_integration',
        settledOffline: true,
        instructions: { note: 'CARD_GATEWAY_NOT_CONFIGURED' },
      }
    }

    const response = await fetch(`${e.CARD_GATEWAY_BASE_URL.replace(/\/$/, '')}/payments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${e.CARD_GATEWAY_API_KEY}`,
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: 'MNT',
        reference: input.orderNumber,
        description: input.description,
        return_url: input.returnUrl,
      }),
    })
    if (!response.ok) throw new Error(`CARD_GATEWAY_ERROR_${response.status}`)
    const data = (await response.json()) as { id?: string; redirect_url?: string }

    return {
      initialStatus: 'PENDING',
      providerName: 'card',
      providerRef: data.id,
      redirectUrl: data.redirect_url,
      settledOffline: false,
    }
  },
}

// ─────────────────────────────── QPay ─────────────────────────────────────

interface QpayTokenCache {
  token: string
  expiresAt: number
}
let qpayToken: QpayTokenCache | null = null

async function qpayAccessToken(): Promise<string> {
  const e = env()
  if (qpayToken && qpayToken.expiresAt > Date.now() + 30_000) return qpayToken.token

  const credentials = Buffer.from(`${e.QPAY_USERNAME}:${e.QPAY_PASSWORD}`).toString('base64')
  const response = await fetch(`${e.QPAY_BASE_URL.replace(/\/$/, '')}/auth/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/json' },
  })
  if (!response.ok) throw new Error(`QPAY_AUTH_FAILED_${response.status}`)
  const data = (await response.json()) as { access_token: string; expires_in?: number }
  qpayToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3000) * 1000,
  }
  return qpayToken.token
}

const qpayProvider: PaymentProvider = {
  method: 'QPAY',
  isConfigured: () =>
    Boolean(env().QPAY_USERNAME && env().QPAY_PASSWORD && env().QPAY_INVOICE_CODE),
  async createIntent(input) {
    const e = env()
    if (!qpayProvider.isConfigured()) {
      return {
        initialStatus: 'AWAITING_CONFIRMATION',
        providerName: 'qpay_pending_integration',
        settledOffline: true,
        instructions: { note: 'QPAY_NOT_CONFIGURED' },
      }
    }

    const token = await qpayAccessToken()
    const response = await fetch(`${e.QPAY_BASE_URL.replace(/\/$/, '')}/invoice`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        invoice_code: e.QPAY_INVOICE_CODE,
        sender_invoice_no: input.orderNumber,
        invoice_receiver_code: input.customerPhone,
        invoice_description: input.description,
        amount: input.amount,
        callback_url: input.returnUrl,
      }),
    })
    if (!response.ok) throw new Error(`QPAY_INVOICE_FAILED_${response.status}`)
    const data = (await response.json()) as {
      invoice_id?: string
      qr_text?: string
      urls?: { name: string; link: string }[]
    }

    return {
      initialStatus: 'PENDING',
      providerName: 'qpay',
      providerRef: data.invoice_id,
      qrText: data.qr_text,
      deeplinks: data.urls,
      settledOffline: false,
    }
  },
  async verifyCallback(payload) {
    // QPay posts the invoice id; the authoritative check is a server-to-server
    // payment lookup, never the callback body alone.
    const body = payload as { object_id?: string; invoice_id?: string }
    const invoiceId = body.invoice_id ?? body.object_id
    if (!invoiceId || !qpayProvider.isConfigured()) return { ok: false, paid: false }

    const e = env()
    const token = await qpayAccessToken()
    const response = await fetch(`${e.QPAY_BASE_URL.replace(/\/$/, '')}/payment/check`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 },
      }),
    })
    if (!response.ok) return { ok: false, paid: false }
    const data = (await response.json()) as { count?: number; paid_amount?: number }
    return { ok: true, providerRef: invoiceId, paid: (data.paid_amount ?? 0) > 0 }
  },
}

const PROVIDERS: Record<PaymentMethod, PaymentProvider> = {
  CASH_ON_DELIVERY: cashProvider,
  BANK_TRANSFER: bankProvider,
  CARD: cardProvider,
  QPAY: qpayProvider,
}

export function paymentProvider(method: PaymentMethod): PaymentProvider {
  return PROVIDERS[method]
}

export function availablePaymentMethods(settings: {
  paymentCashEnabled: boolean
  paymentBankEnabled: boolean
  paymentCardEnabled: boolean
  paymentQpayEnabled: boolean
}): PaymentMethod[] {
  const methods: PaymentMethod[] = []
  if (settings.paymentCashEnabled) methods.push('CASH_ON_DELIVERY')
  if (settings.paymentBankEnabled) methods.push('BANK_TRANSFER')
  if (settings.paymentCardEnabled) methods.push('CARD')
  if (settings.paymentQpayEnabled) methods.push('QPAY')
  return methods
}

/** Whether each configured gateway actually has credentials — shown in admin. */
export function paymentProviderStatus(): { method: PaymentMethod; configured: boolean }[] {
  return (Object.keys(PROVIDERS) as PaymentMethod[]).map((method) => ({
    method,
    configured: PROVIDERS[method].isConfigured(),
  }))
}
