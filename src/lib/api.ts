/**
 * Cliente da API de pedidos do Cemita (pasta server/).
 * Endereço em VITE_API_URL (ex.: http://localhost:3333/api/v1). Vazio = site funciona como antes,
 * só com o cardápio do próprio site: nenhuma chamada é feita.
 * Preços NUNCA saem daqui para o servidor: a API recebe só ids e quantidades e calcula tudo.
 */

export type ApiOptionItem = { id: number; name: string; priceDeltaCents: number; available: boolean }
export type ApiOptionGroup = { id: number; key: string; name: string; minSelect: number; maxSelect: number; items: ApiOptionItem[] }
export type ApiProduct = {
  id: number
  slug: string
  name: string
  priceCents: number
  priceFrom: boolean
  orderable: boolean
  available: boolean
  isAdult: boolean
  optionGroups: ApiOptionGroup[]
}
export type ApiCatalog = { categories: { id: number; slug: string; name: string; products: ApiProduct[] }[] }

/** Evento da Agenda (só os publicados e ainda não terminados). date/time no horário de Joinville. */
export type ApiEvent = {
  id: number
  title: string
  startsAt: string
  endsAt: string | null
  date: string
  time: string
  summary: string | null
  description: string | null
  highlights: string[]
  reservation: string | null
  instagramUrl: string | null
  imageUrl: string | null
}

export type OrderingMode = 'vuca' | 'native' | 'both'
export type ApiStoreStatus = {
  orderingMode: OrderingMode
  acceptsOrders: boolean
  reasons: string[]
  open: boolean
  paused: boolean
  timezone: string
  hours: { weekday: number; opensAt: string; closesAt: string }[]
  fulfillment: { pickup: { available: boolean; etaMinutes: number | null }; delivery: { available: boolean } }
  paymentMethods: string[]
  /** Pix e cartão no site configurados no servidor (Mercado Pago) */
  onlinePaymentsReady?: boolean
  minOrderCents: number | null
  privacyPolicy: { id: number; version: string; url: string } | null
}

export type QuoteLineInput = { productId: number; quantity: number; optionIds: number[]; note?: string }
export type ApiIssue = { code: string; message: string; line?: number }
export type ApiQuote = {
  ok: boolean
  errors: ApiIssue[]
  hasAdultItems?: boolean
  zone?: { id: number; name: string; etaMinMinutes: number | null; etaMaxMinutes: number | null } | null
  lines: { productId: number; quantity: number; unitPriceCents: number; lineTotalCents: number }[]
  subtotalCents: number
  discountCents: number
  deliveryFeeCents: number
  totalCents: number
  store: { acceptsOrders: boolean; reasons: string[] }
}

/** Pedido como o cliente vê (sem telefone nem endereço completo). */
export type ApiOrder = {
  code: string
  status: string
  statusLabel: string
  fulfillment: 'pickup' | 'delivery'
  deliveryZoneName: string | null
  neighborhood: string | null
  items: { name: string; quantity: number; unitPriceCents: number; lineTotalCents: number; note: string | null; options: { group: string; name: string; priceDeltaCents: number }[] }[]
  subtotalCents: number
  discountCents: number
  deliveryFeeCents: number
  totalCents: number
  paymentMethod: string
  changeForCents: number | null
  placedAt: string
  history: { status: string; label: string; at: string }[]
  canCancel: boolean
  /** pagamento do pedido; checkoutUrl só existe enquanto o pagamento online está pendente */
  payment?: { method: string; status: string; online: boolean; checkoutUrl: string | null } | null
}
/** paymentError: o pedido foi salvo, mas o link de pagamento não pôde ser criado agora ("Pagar agora" tenta de novo). */
export type ApiOrderCreated = { order: ApiOrder; trackingToken: string; replayed: boolean; paymentError?: string }

export type ApiErrorDetails = { fields?: { path: string; message: string }[]; errors?: ApiIssue[] }

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: ApiErrorDetails
  constructor(status: number, code: string, message: string, details?: ApiErrorDetails) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const RAW = (import.meta.env.VITE_API_URL ?? '').trim()
/** Endereço da API sem barra no fim; null quando não configurada. */
export const API_BASE: string | null = RAW ? RAW.replace(/\/+$/, '') : null
export const apiEnabled = API_BASE !== null
/** Endereço completo de um arquivo servido pela API (ex.: arte de evento: "/events/3/image?v=1"). */
export const apiAsset = (path: string) => (API_BASE ? API_BASE + path : path)

const TIMEOUT_MS = 6000

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, signal?: AbortSignal, headers: Record<string, string> = {}): Promise<T> {
  if (!API_BASE) throw new ApiError(0, 'API_DISABLED', 'API não configurada.')
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
    const data = (await res.json().catch(() => null)) as (T & { error?: { code?: string; message?: string; details?: ApiErrorDetails } }) | null
    if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'HTTP_ERROR', data?.error?.message ?? `Erro ${res.status}`, data?.error?.details)
    if (data === null) throw new ApiError(res.status, 'INVALID_RESPONSE', 'Resposta inválida da API.')
    return data
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(0, ctrl.signal.aborted && !signal?.aborted ? 'TIMEOUT' : 'NETWORK_ERROR', 'Sem conexão com o servidor.')
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export const api = {
  catalog: (signal?: AbortSignal) => request<ApiCatalog>('GET', '/catalog', undefined, signal),
  storeStatus: (signal?: AbortSignal) => request<ApiStoreStatus>('GET', '/store/status', undefined, signal),
  events: (signal?: AbortSignal) => request<{ events: ApiEvent[] }>('GET', '/events', undefined, signal),
  quote: (lines: QuoteLineInput[], signal?: AbortSignal, opts: { fulfillment?: 'pickup' | 'delivery'; address?: Record<string, string> } = {}) =>
    request<ApiQuote>('POST', '/cart/quote', { lines, fulfillment: opts.fulfillment ?? 'pickup', ...(opts.address ? { address: opts.address } : {}) }, signal),
  /** Cria o pedido. A mesma chave enviada de novo devolve o MESMO pedido (nunca duplica). */
  createOrder: (body: unknown, idempotencyKey: string) => request<ApiOrderCreated>('POST', '/orders', body, undefined, { 'Idempotency-Key': idempotencyKey }),
  getOrder: (code: string, token: string, signal?: AbortSignal) => request<{ order: ApiOrder }>('GET', `/orders/${encodeURIComponent(code)}`, undefined, signal, { 'X-Tracking-Token': token }),
  cancelOrder: (code: string, token: string) => request<{ order: ApiOrder }>('POST', `/orders/${encodeURIComponent(code)}/cancel`, {}, undefined, { 'X-Tracking-Token': token }),
  /** link de pagamento do pedido (Pix/cartão no site) */
  pay: (code: string, token: string) => request<{ checkoutUrl: string }>('POST', `/orders/${encodeURIComponent(code)}/pay`, {}, undefined, { 'X-Tracking-Token': token }),
}
