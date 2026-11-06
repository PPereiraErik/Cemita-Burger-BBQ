/**
 * Cliente da API do painel (/api/v1/admin).
 * - Sessão em cookie HttpOnly (o JavaScript não lê): credentials: 'include'.
 * - Token anti-CSRF só na memória (nunca em localStorage); vai no cabeçalho X-CSRF-Token
 *   de toda escrita. Recarregou a página → /me devolve um novo.
 */
import type { AdminCategory, AdminEvent, AdminOrder, AdminProduct, AdminStore, AuditEntry, Hour, Me, OrderStatus, StoreSettings, TeamUser, Zone, EventDraft } from './core'

export class AdminError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: { path: string; message: string }[]
  constructor(status: number, code: string, message: string, fields?: { path: string; message: string }[]) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

const RAW = (import.meta.env.VITE_API_URL ?? '').trim()
export const API_BASE: string | null = RAW ? RAW.replace(/\/+$/, '') + '/admin' : null

let csrf = ''
let mePending: Promise<{ user: Me }> | null = null
const listeners = new Set<() => void>()
/** Avisado quando o servidor diz que a sessão acabou (401). */
export const onSessionLost = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn))

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 10_000): Promise<T> {
  if (!API_BASE) throw new AdminError(0, 'API_DISABLED', 'Configure VITE_API_URL para usar o painel.')
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(method !== 'GET' && csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch {
    throw new AdminError(0, 'NETWORK_ERROR', 'Sem conexão com o servidor. Confira a internet e tente de novo.')
  } finally {
    window.clearTimeout(timer)
  }
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => null)) as (T & { csrfToken?: string; error?: { code?: string; message?: string; details?: { fields?: { path: string; message: string }[] } } }) | null
  if (!res.ok) {
    const code = data?.error?.code ?? 'HTTP_ERROR'
    if (res.status === 401 && path !== '/login') {
      csrf = ''
      listeners.forEach((fn) => fn())
    }
    throw new AdminError(res.status, code, data?.error?.message ?? `Erro ${res.status}`, data?.error?.details?.fields)
  }
  if (data?.csrfToken) csrf = data.csrfToken
  return data as T
}

export const adminApi = {
  login: (email: string, password: string) => request<{ user: Me }>('POST', '/login', { email, password }),
  /** Uma chamada por vez: duas /me simultâneas gerariam dois tokens anti-CSRF e um deles ficaria inválido. */
  me: () => (mePending ??= request<{ user: Me }>('GET', '/me').finally(() => (mePending = null))),
  logout: async () => {
    try {
      await request('POST', '/logout', {})
    } finally {
      csrf = ''
    }
  },
  changePassword: (current: string, next: string) => request<void>('POST', '/password', { current, next }),

  orders: (scope: 'active' | 'recent' = 'active') => request<{ orders: AdminOrder[]; serverTime: string }>('GET', `/orders?scope=${scope}`),
  setStatus: (id: number, to: OrderStatus, version: number, reason?: string) => request<{ order: AdminOrder }>('POST', `/orders/${id}/status`, { to, version, ...(reason ? { reason } : {}) }),

  catalog: () => request<{ categories: AdminCategory[] }>('GET', '/catalog'),
  patchProduct: (id: number, patch: Partial<Pick<AdminProduct, 'available' | 'active' | 'orderable' | 'priceCents' | 'name' | 'description'>>) =>
    request<{ product: AdminProduct }>('PATCH', `/products/${id}`, patch),

  store: () => request<AdminStore>('GET', '/store'),
  patchSettings: (patch: Partial<StoreSettings>) => request<AdminStore>('PATCH', '/store/settings', patch),
  putHours: (hours: Hour[]) => request<AdminStore>('PUT', '/store/hours', { hours }),

  zones: () => request<{ zones: Zone[] }>('GET', '/zones'),
  createZone: (z: Omit<Zone, 'id'>) => request<{ zone: Zone }>('POST', '/zones', z),
  updateZone: (id: number, z: Omit<Zone, 'id'>) => request<{ zone: Zone }>('PUT', `/zones/${id}`, z),
  deleteZone: (id: number) => request<void>('DELETE', `/zones/${id}`),

  users: () => request<{ users: TeamUser[] }>('GET', '/users'),
  createUser: (u: { name: string; email: string; role: string; password: string }) => request<{ user: TeamUser }>('POST', '/users', u),
  patchUser: (id: number, patch: Partial<Pick<TeamUser, 'name' | 'role' | 'active'>>) => request<{ user: TeamUser }>('PATCH', `/users/${id}`, patch),
  resetPassword: (id: number, password: string) => request<void>('POST', `/users/${id}/password`, { password }),

  audit: (limit = 150) => request<{ entries: AuditEntry[] }>('GET', `/audit?limit=${limit}`),

  events: () => request<{ events: AdminEvent[]; aiReady: boolean }>('GET', '/events'),
  createEvent: (body: unknown) => request<{ event: AdminEvent }>('POST', '/events', body, 30_000),
  updateEvent: (id: number, body: unknown) => request<{ event: AdminEvent }>('PUT', `/events/${id}`, body, 30_000),
  deleteEvent: (id: number) => request<void>('DELETE', `/events/${id}`),
  /** a IA pode levar alguns segundos lendo a arte */
  extractEvent: (caption: string, image?: string) => request<{ draft: EventDraft }>('POST', '/events/extract', { caption, ...(image ? { image } : {}) }, 60_000),
}

/** Mensagem para a tela, com os campos inválidos quando houver. */
export function errorText(e: unknown): string {
  if (e instanceof AdminError) {
    if (e.fields?.length) return `${e.message} ${e.fields.map((f) => `${f.path || 'campo'}: ${f.message}`).join('; ')}`
    return e.message
  }
  return 'Algo deu errado. Tente de novo.'
}
