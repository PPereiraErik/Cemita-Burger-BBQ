/**
 * CHECKOUT — regras puras do formulário de pedido (sem React, sem rede).
 * O servidor valida tudo de novo e recalcula os valores: aqui é só para ajudar o cliente
 * a corrigir antes de enviar e para montar o corpo do pedido (sem nenhum preço).
 * Testadas em tests/checkout.test.ts.
 */
import type { ApiStoreStatus, QuoteLineInput } from './api'

export type Fulfillment = 'pickup' | 'delivery'
export type PaymentMethod = 'cash_on_delivery' | 'card_on_delivery' | 'pix' | 'card_online'

export type CheckoutForm = {
  name: string
  phone: string
  fulfillment: Fulfillment
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  reference: string
  paymentMethod: PaymentMethod | ''
  /** "precisa de troco?" */
  needsChange: boolean
  /** troco para quanto, como a pessoa digitou ("100", "100,00", "R$ 100") */
  changeFor: string
  notes: string
  adultConfirmed: boolean
  privacyAccepted: boolean
}

export const EMPTY_FORM: CheckoutForm = {
  name: '',
  phone: '',
  fulfillment: 'pickup',
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  reference: '',
  paymentMethod: '',
  needsChange: false,
  changeFor: '',
  notes: '',
  adultConfirmed: false,
  privacyAccepted: false,
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash_on_delivery: 'Dinheiro na entrega/retirada',
  card_on_delivery: 'Cartão na maquininha (entrega/retirada)',
  pix: 'Pix',
  card_online: 'Cartão pelo site',
}

/** Pagas no site (o cliente vai para a página do Mercado Pago e volta para o acompanhamento). */
export const ONLINE_METHODS: readonly PaymentMethod[] = ['pix', 'card_online']
export const isOnlineMethod = (m: string) => (ONLINE_METHODS as readonly string[]).includes(m)
export const PAYMENT_HINT: Partial<Record<PaymentMethod, string>> = {
  pix: 'Você paga no Mercado Pago e volta para acompanhar. O pedido vai para a cozinha assim que o Pix for confirmado.',
  card_online: 'Crédito ou débito, na página segura do Mercado Pago. A Cemita não vê nem guarda os dados do cartão.',
}

/** Endereço de pagamento aceito para redirecionar: só https do Mercado Pago (nunca um link qualquer vindo da rede). */
export function safeCheckoutUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && /(^|\.)mercadopago\.com(\.br)?$|(^|\.)mercadolivre\.com(\.br)?$|(^|\.)mercadolibre\.com$/.test(u.hostname) ? u.href : null
  } catch {
    return null
  }
}

/**
 * Em que pé está o pagamento online de um pedido (para o acompanhamento):
 * 'pay' = ainda falta pagar · 'declined' = a última tentativa foi recusada (pode tentar de novo) ·
 * 'paid' = pago · 'review' = a Cemita precisa conferir · null = pagamento na entrega ou pedido encerrado.
 */
export function paymentStage(o: { status: string; payment?: { online: boolean; status: string } | null }): 'pay' | 'declined' | 'paid' | 'review' | null {
  const p = o.payment
  if (!p?.online) return null
  if (p.status === 'approved') return 'paid'
  if (p.status === 'in_review') return 'review'
  if (o.status !== 'pending' && o.status !== 'awaiting_payment') return null
  return p.status === 'declined' ? 'declined' : 'pay'
}

export const digits = (s: string) => s.replace(/\D/g, '')

/** "100", "100,5", "R$ 1.234,56" → centavos. Vazio ou inválido → null. */
export function parseMoney(input: string): number | null {
  const s = input.replace(/[R$\s]/g, '')
  if (!s) return null
  // "1.234,56" → "1234.56"; "100,5" → "100.5"; "100.50" (ponto decimal) também vale
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

/** Telefone com DDD (fixo ou celular), aceitando +55. Mesma regra do servidor. */
export function validPhone(input: string) {
  let d = digits(input)
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  return /^[1-9][1-9]\d{8}$/.test(d) || /^[1-9][1-9]9\d{8}$/.test(d)
}

/** (47) 99683-8894 enquanto digita. */
export function formatPhone(input: string) {
  const d = digits(input).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** 89203-001 enquanto digita. */
export function formatCep(input: string) {
  const d = digits(input).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export type FieldErrors = Partial<Record<keyof CheckoutForm, string>>

type Ctx = { totalCents: number | null; hasAdultItems: boolean; paymentMethods: string[]; deliveryAvailable: boolean }

/** Erros por campo, na ordem em que aparecem no formulário. Vazio = pode enviar. */
export function validateForm(f: CheckoutForm, ctx: Ctx): FieldErrors {
  const e: FieldErrors = {}
  if (f.name.trim().length < 2) e.name = 'Escreva seu nome.'
  if (!validPhone(f.phone)) e.phone = 'Telefone com DDD, ex.: (47) 99999-9999.'
  if (f.fulfillment === 'delivery') {
    if (!ctx.deliveryAvailable) e.fulfillment = 'A entrega pelo site ainda não está disponível. Escolha retirada.'
    if (digits(f.cep).length !== 8) e.cep = 'CEP com 8 números.'
    if (f.street.trim().length < 2) e.street = 'Escreva a rua.'
    if (!f.number.trim()) e.number = 'Escreva o número (ou "s/n").'
    if (f.neighborhood.trim().length < 2) e.neighborhood = 'Escreva o bairro.'
  }
  if (!f.paymentMethod) e.paymentMethod = 'Escolha como vai pagar.'
  else if (!ctx.paymentMethods.includes(f.paymentMethod)) e.paymentMethod = 'Esta forma de pagamento não está disponível.'
  if (f.paymentMethod === 'cash_on_delivery' && f.needsChange) {
    const c = parseMoney(f.changeFor)
    if (c == null) e.changeFor = 'Escreva o valor, ex.: 100,00.'
    else if (ctx.totalCents != null && c < ctx.totalCents) e.changeFor = 'O troco precisa ser para um valor maior ou igual ao total.'
  }
  if (ctx.hasAdultItems && !f.adultConfirmed) e.adultConfirmed = 'Confirme que você tem 18 anos ou mais.'
  if (!f.privacyAccepted) e.privacyAccepted = 'É preciso aceitar a política de privacidade.'
  return e
}

const opt = (s: string) => {
  const t = s.trim()
  return t ? t : undefined
}

/** Corpo do POST /orders. Só ids, quantidades e dados do cliente: nenhum preço. */
export function toOrderBody(f: CheckoutForm, lines: QuoteLineInput[], privacyPolicyVersionId: number, hasAdultItems: boolean) {
  const body: Record<string, unknown> = {
    lines,
    fulfillment: f.fulfillment,
    customer: { name: f.name.trim(), phone: f.phone },
    paymentMethod: f.paymentMethod,
    privacyPolicyVersionId,
  }
  if (f.fulfillment === 'delivery') {
    const address: Record<string, string> = { cep: digits(f.cep), street: f.street.trim(), number: f.number.trim(), neighborhood: f.neighborhood.trim() }
    const complement = opt(f.complement)
    const reference = opt(f.reference)
    if (complement) address.complement = complement
    if (reference) address.reference = reference
    body.address = address
  }
  if (f.paymentMethod === 'cash_on_delivery' && f.needsChange) {
    const c = parseMoney(f.changeFor)
    if (c != null) body.changeForCents = c
  }
  const notes = opt(f.notes)
  if (notes) body.notes = notes
  if (hasAdultItems) body.adultConfirmed = f.adultConfirmed
  return body
}

/** Endereço parcial para a cotação (taxa de entrega por CEP ou bairro). */
export function quoteAddress(f: CheckoutForm) {
  if (f.fulfillment !== 'delivery') return undefined
  const a: Record<string, string> = {}
  if (digits(f.cep).length === 8) a.cep = digits(f.cep)
  if (f.neighborhood.trim().length >= 2) a.neighborhood = f.neighborhood.trim()
  return Object.keys(a).length ? a : undefined
}

/** Campo do servidor (customer.name, address.cep…) → campo do formulário. */
const SERVER_FIELD: Record<string, keyof CheckoutForm> = {
  'customer.name': 'name',
  'customer.phone': 'phone',
  'address.cep': 'cep',
  'address.street': 'street',
  'address.number': 'number',
  'address.complement': 'complement',
  'address.neighborhood': 'neighborhood',
  'address.reference': 'reference',
  address: 'street',
  paymentMethod: 'paymentMethod',
  changeForCents: 'changeFor',
  notes: 'notes',
  fulfillment: 'fulfillment',
  adultConfirmed: 'adultConfirmed',
  privacyPolicyVersionId: 'privacyAccepted',
}

export function fieldErrorsFromServer(fields: { path: string; message: string }[] = []): FieldErrors {
  const e: FieldErrors = {}
  for (const f of fields) {
    const k = SERVER_FIELD[f.path]
    if (k && !e[k]) e[k] = 'Confira este campo.'
  }
  return e
}

/** Erros que o servidor devolve no envio → onde mostrar no formulário. */
export const SERVER_CODE_FIELD: Partial<Record<string, keyof CheckoutForm>> = {
  PRIVACY_CONSENT_REQUIRED: 'privacyAccepted',
  PAYMENT_METHOD_UNAVAILABLE: 'paymentMethod',
  DELIVERY_UNAVAILABLE: 'fulfillment',
  ADULT_CONFIRMATION_REQUIRED: 'adultConfirmed',
  INVALID_CHANGE: 'changeFor',
}

/** Motivos de a loja não aceitar pedido agora, em português de gente. */
export const STORE_REASON: Record<string, string> = {
  ORDERING_DISABLED: 'Os pedidos pelo site ainda não estão ativos. Use o delivery.',
  STORE_PAUSED: 'A cozinha pausou os pedidos por alguns minutos.',
  STORE_CLOSED: 'Estamos fechados agora. Os pedidos pelo site abrem no horário da casa.',
  PRIVACY_POLICY_MISSING: 'Os pedidos pelo site ainda não estão ativos. Use o delivery.',
  NO_PAYMENT_METHOD: 'Os pedidos pelo site ainda não estão ativos. Use o delivery.',
}

/** A loja aceita pedido pelo site agora? Se não, a frase do motivo. */
export function storeBlocker(store: Pick<ApiStoreStatus, 'acceptsOrders' | 'reasons'> | null): string | null {
  if (!store) return 'Não foi possível falar com a Cemita agora. Tente de novo em instantes.'
  if (store.acceptsOrders) return null
  return STORE_REASON[store.reasons[0]] ?? 'Não estamos aceitando pedidos pelo site agora.'
}

/** Chave que impede pedido duplicado (mesmo envio repetido = mesmo pedido). */
export const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `chk-${crypto.randomUUID()}` : `chk-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
