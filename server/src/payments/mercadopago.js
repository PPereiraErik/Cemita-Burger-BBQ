import crypto from 'node:crypto'
import { PAYMENT_METHOD, PAYMENT_STATUS } from '../domain/constants.js'

/**
 * MERCADO PAGO — Checkout Pro (página de pagamento do próprio Mercado Pago).
 * O cliente paga na página deles: o site e a API NUNCA veem nem guardam dado de cartão.
 * Pix e cartão de crédito/débito pelo mesmo caminho; a forma escolhida no site limita o que aparece lá.
 *
 * Confirmação de pagamento: SÓ pelo webhook, com a assinatura conferida, e mesmo assim o corpo do
 * aviso não é usado: a API busca o pagamento direto no Mercado Pago (GET /v1/payments/:id) com o token.
 *
 * Funções puras exportadas (testadas sem rede): buildPreference, verifySignature, mapStatus, normalizePayment.
 */
export const PROVIDER = 'mercadopago'
const API = 'https://api.mercadopago.com'

/** Tipos de pagamento do Mercado Pago que saem da tela para cada forma escolhida no site. */
const EXCLUDE = {
  [PAYMENT_METHOD.PIX]: ['credit_card', 'debit_card', 'prepaid_card', 'ticket', 'atm'],
  [PAYMENT_METHOD.CARD_ONLINE]: ['bank_transfer', 'ticket', 'atm'],
}

/**
 * Corpo da preferência. Um item só, com o total calculado pelo servidor (já com taxa e desconto):
 * evita diferença de arredondamento entre itens e o valor cobrado.
 */
export function buildPreference({ order, method, siteUrl, expiresAt = null }) {
  if (!EXCLUDE[method]) throw new Error(`forma de pagamento não é online: ${method}`)
  const back = `${siteUrl.replace(/\/+$/, '')}/?pedido=${encodeURIComponent(order.publicCode)}`
  const pref = {
    items: [
      {
        id: order.publicCode,
        title: `Pedido ${order.publicCode} · Cemita Burger & BBQ`,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: order.totalCents / 100,
      },
    ],
    external_reference: order.publicCode,
    payment_methods: {
      excluded_payment_types: EXCLUDE[method].map((id) => ({ id })),
      installments: 1,
    },
    back_urls: { success: back, pending: back, failure: back },
    auto_return: 'approved',
    statement_descriptor: 'CEMITA',
  }
  if (expiresAt) {
    pref.expires = true
    pref.expiration_date_to = new Date(expiresAt).toISOString()
  }
  return pref
}

/**
 * Assinatura do webhook (cabeçalho x-signature: "ts=...,v1=...").
 * Texto assinado: "id:<data.id da URL>;request-id:<x-request-id>;ts:<ts>;" — HMAC-SHA256 em hexadecimal
 * com a "assinatura secreta" do painel do Mercado Pago. data.id alfanumérico entra em minúsculas.
 * Sem segredo configurado, nada passa (falha fechada).
 */
export function verifySignature({ xSignature, xRequestId, dataId, secret }) {
  if (!secret || !xSignature || !dataId) return false
  const parts = Object.fromEntries(
    String(xSignature)
      .split(',')
      .map((p) => p.split('=').map((s) => s.trim()))
      .filter((kv) => kv.length === 2),
  )
  const { ts, v1 } = parts
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false
  const id = /^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : String(dataId)
  let manifest = `id:${id};`
  if (xRequestId) manifest += `request-id:${xRequestId};`
  manifest += `ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(v1.toLowerCase(), 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Status do Mercado Pago → status do nosso pagamento. */
export function mapStatus(mpStatus) {
  switch (mpStatus) {
    case 'approved':
      return PAYMENT_STATUS.APPROVED
    case 'rejected':
      return PAYMENT_STATUS.DECLINED
    case 'cancelled':
      return PAYMENT_STATUS.CANCELLED
    case 'refunded':
    case 'charged_back':
      return PAYMENT_STATUS.REFUNDED
    case 'in_mediation':
      return PAYMENT_STATUS.IN_REVIEW
    default:
      // pending, in_process, authorized e qualquer status novo: ainda não é dinheiro confirmado
      return PAYMENT_STATUS.PENDING
  }
}

/** Pagamento como a API do Mercado Pago devolve → só o que usamos (valores em centavos). */
export function normalizePayment(p) {
  return {
    id: String(p.id),
    rawStatus: String(p.status ?? ''),
    status: mapStatus(p.status),
    externalReference: p.external_reference ?? null,
    amountCents: Math.round(Number(p.transaction_amount) * 100),
    currency: p.currency_id ?? null,
    approvedAt: p.date_approved ? new Date(p.date_approved) : null,
    methodId: p.payment_method_id ?? null,
  }
}

/**
 * Cliente HTTP do Mercado Pago (fetch injetável para testes).
 * createCheckout → { reference, checkoutUrl }; getPayment → normalizePayment(...)
 */
export function createMercadoPago({ accessToken, webhookSecret, siteUrl, sandbox = false, fetchImpl = fetch, timeoutMs = 10_000 }) {
  async function call(method, path, body, idempotencyKey) {
    const res = await fetchImpl(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      /* corpo não-JSON */
    }
    if (!res.ok) {
      const err = new Error(`Mercado Pago ${method} ${path}: HTTP ${res.status}`)
      err.status = res.status
      err.providerMessage = json?.message ?? null
      throw err
    }
    return json
  }

  return {
    provider: PROVIDER,
    async createCheckout({ order, method, expiresAt }) {
      const pref = await call('POST', '/checkout/preferences', buildPreference({ order, method, siteUrl, expiresAt }), `cemita-${order.publicCode}-${method}`)
      const checkoutUrl = sandbox ? pref.sandbox_init_point || pref.init_point : pref.init_point
      if (!pref?.id || !checkoutUrl) throw new Error('Mercado Pago não devolveu o link de pagamento')
      return { reference: String(pref.id), checkoutUrl }
    },
    async getPayment(id) {
      return normalizePayment(await call('GET', `/v1/payments/${encodeURIComponent(id)}`))
    },
    verify: (args) => verifySignature({ ...args, secret: webhookSecret }),
  }
}
