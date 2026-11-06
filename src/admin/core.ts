/**
 * PAINEL — regras puras (sem React, sem rede). Testadas em tests/admin.test.ts.
 * O servidor confere tudo de novo (papel, versão, transição): aqui é só para a tela
 * mostrar os botões certos e textos claros.
 */

export type Role = 'admin' | 'staff' | 'kitchen'
export type Permission =
  | 'viewOrders'
  | 'viewCustomerContact'
  | 'setProductAvailability'
  | 'editProducts'
  | 'pauseStore'
  | 'editStoreSettings'
  | 'manageZones'
  | 'manageUsers'
  | 'viewAudit'
  | 'manageEvents'
export type Me = { id: number; name: string; email: string; role: Role; roleLabel: string; can: Record<Permission, boolean> }

export type OrderStatus = 'pending' | 'awaiting_payment' | 'payment_approved' | 'received' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'

export type AdminOrder = {
  id: number
  code: string
  status: OrderStatus
  statusLabel: string
  version: number
  fulfillment: 'pickup' | 'delivery'
  source: string
  customerName: string | null
  customerPhone?: string | null
  address?: { cep: string | null; street: string | null; number: string | null; complement: string | null; neighborhood: string | null; reference: string | null } | null
  deliveryZoneName: string | null
  neighborhood: string | null
  items: { name: string; quantity: number; note: string | null; lineTotalCents: number; options: { group: string; name: string }[] }[]
  notes: string | null
  subtotalCents: number
  discountCents: number
  deliveryFeeCents: number
  totalCents: number
  paymentMethod: string
  changeForCents: number | null
  paymentStatus: string | null
  hasAdultItems: boolean
  cancelReason: string | null
  placedAt: string
  history: { status: OrderStatus; label: string; at: string; actor: string; reason: string | null }[]
}

export type AdminProduct = { id: number; slug: string; name: string; description: string | null; priceCents: number; priceFrom: boolean; orderable: boolean; available: boolean; active: boolean; isAdult: boolean }
export type AdminCategory = { id: number; slug: string; name: string; active: boolean; products: AdminProduct[] }

export type SettingKey = 'orders_paused' | 'ordering_mode' | 'pickup_eta_minutes' | 'min_order_cents' | 'payment_methods_enabled' | 'data_retention_days'
export type StoreSettings = {
  orders_paused: boolean | null
  ordering_mode: 'vuca' | 'native' | 'both' | null
  pickup_eta_minutes: number | null
  min_order_cents: number | null
  payment_methods_enabled: string[] | null
  data_retention_days: number | null
}
export type Hour = { weekday: number; opensAt: string; closesAt: string }
export type AdminStore = { status: { acceptsOrders: boolean; reasons: string[]; open: boolean; paused: boolean; orderingMode: string; onlinePaymentsReady?: boolean }; settings: StoreSettings; timezone: string; hours: Hour[] }

export type Zone = {
  id: number
  name: string
  matchType: 'neighborhood' | 'cep_range'
  neighborhoods: string[] | null
  cepStart: string | null
  cepEnd: string | null
  feeCents: number
  minOrderCents: number
  etaMinMinutes: number
  etaMaxMinutes: number
  active: boolean
  position: number
}
export type TeamUser = { id: number; name: string; email: string; role: Role; active: boolean; lastLoginAt: string | null }
export type AuditEntry = { id: number; at: string; action: string; entity: string; entityId: string | null; meta: Record<string, unknown> | null; user: { id: number; name: string; role: Role } | null }

// ───────────────────────── dinheiro ─────────────────────────
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (cents: number) => BRL.format(cents / 100).replace(/ /g, ' ')

/** "39,90", "R$ 39,90", "39.9", "1.234,56" → centavos. Inválido → null. */
export function parseCents(input: string): number | null {
  let s = input.replace(/R\$|\s/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  return Math.round(Number(s) * 100)
}
export const centsToInput = (c: number) => (c / 100).toFixed(2).replace('.', ',')

// ───────────────────────── rótulos ─────────────────────────
export const ROLE_LABEL: Record<Role, string> = { admin: 'Administração', staff: 'Atendimento', kitchen: 'Cozinha' }

export const PAYMENT_LABEL: Record<string, string> = {
  cash_on_delivery: 'Dinheiro na entrega',
  card_on_delivery: 'Maquininha na entrega',
  pix: 'Pix',
  card_online: 'Cartão pelo site',
}

export const FULFILLMENT_LABEL = { pickup: 'Retirada', delivery: 'Entrega' } as const

/**
 * Situação do pagamento ONLINE (Pix/cartão no site) para a equipe. Pagamento na entrega → null (nada a avisar).
 * `alerta` = precisa de alguém olhar no Mercado Pago.
 */
export function paymentNote(method: string, paymentStatus: string | null, orderStatus: string): { text: string; alerta: boolean } | null {
  if (method !== 'pix' && method !== 'card_online') return null
  if (orderStatus === 'cancelled' && paymentStatus === 'approved') return { text: '⚠ Cancelado com pagamento aprovado: faça o estorno no Mercado Pago', alerta: true }
  switch (paymentStatus) {
    case 'approved':
      return { text: '✓ Pago online', alerta: false }
    case 'in_review':
      return { text: '⚠ Conferir no Mercado Pago (valor diferente, pago depois do cancelamento ou em disputa)', alerta: true }
    case 'refunded':
      return { text: '↺ Pagamento estornado', alerta: true }
    case 'declined':
      return { text: '✕ Pagamento recusado: o cliente pode tentar de novo', alerta: false }
    case 'cancelled':
      return { text: '✕ Pagamento cancelado', alerta: false }
    default:
      return { text: '⏲ Aguardando o pagamento online (não preparar ainda)', alerta: false }
  }
}

/** Por que o site não está aceitando pedidos (códigos do /store/status). */
export const REASON_LABEL: Record<string, string> = {
  ORDERING_DISABLED: 'Pedido pelo site desligado (modo VUCA).',
  STORE_PAUSED: 'Pedidos pausados pelo painel.',
  STORE_CLOSED: 'Fora do horário de funcionamento.',
  PRIVACY_POLICY_MISSING: 'Falta publicar a política de privacidade.',
  NO_PAYMENT_METHOD: 'Nenhuma forma de pagamento ligada.',
}

export const ORDERING_MODE_LABEL = {
  vuca: 'Só VUCA — o site leva para o delivery atual',
  native: 'Só pedido próprio — o site recebe os pedidos',
  both: 'Os dois — pedido próprio e link do VUCA',
} as const

export const WEEKDAY = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const AUDIT_LABEL: Record<string, string> = {
  'login.ok': 'Entrou no painel',
  'login.fail': 'Errou a senha',
  'login.lock': 'Conta travada (5 erros)',
  'login.locked': 'Tentou entrar com a conta travada',
  logout: 'Saiu do painel',
  'password.change': 'Trocou a própria senha',
  'order.status': 'Mudou o status de um pedido',
  'product.update': 'Alterou um produto',
  'setting.update': 'Alterou uma configuração da loja',
  'hours.replace': 'Alterou o horário de funcionamento',
  'zone.create': 'Criou uma zona de entrega',
  'zone.update': 'Alterou uma zona de entrega',
  'zone.delete': 'Apagou uma zona de entrega',
  'user.create': 'Criou uma conta',
  'user.update': 'Alterou uma conta',
  'user.password_reset': 'Definiu senha nova para uma conta',
}
export const auditLabel = (action: string) => AUDIT_LABEL[action] ?? action

/** Uma linha legível com o detalhe da ação (sem dado pessoal: o servidor nem guarda). */
export function auditDetail(e: AuditEntry): string {
  const m = (e.meta ?? {}) as Record<string, unknown>
  if (e.action === 'order.status') return `${m.code ?? ''}: ${STATUS_SHORT[m.from as OrderStatus] ?? m.from} → ${STATUS_SHORT[m.to as OrderStatus] ?? m.to}`
  if (e.action === 'setting.update') return `${e.entityId}: ${fmtValue(m.before)} → ${fmtValue(m.after)}`
  if (e.action === 'product.update') {
    const after = (m.after ?? {}) as Record<string, unknown>
    const before = (m.before ?? {}) as Record<string, unknown>
    return `${m.slug ?? ''}: ` + Object.keys(after).map((k) => `${k} ${fmtValue(before[k], k)} → ${fmtValue(after[k], k)}`).join(', ')
  }
  if (e.action.startsWith('zone.')) return String(m.name ?? '')
  if (e.action === 'user.create') return `papel: ${ROLE_LABEL[m.role as Role] ?? m.role}`
  return ''
}
function fmtValue(v: unknown, key = ''): string {
  if (v === null || v === undefined) return 'não definido'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'number' && /cents/i.test(key)) return money(v)
  if (Array.isArray(v)) return v.join(', ') || 'nenhum'
  return String(v)
}

// ───────────────────────── pedidos ─────────────────────────
export const STATUS_SHORT: Record<OrderStatus, string> = {
  pending: 'Pendente',
  awaiting_payment: 'Aguardando pagamento',
  payment_approved: 'Pagamento aprovado',
  received: 'Recebido',
  preparing: 'Em preparo',
  ready: 'Pronto',
  out_for_delivery: 'Saiu para entrega',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
}

export type Column = { key: string; title: string; statuses: OrderStatus[] }
/** Colunas do quadro. A cozinha vê só a fila dela. */
export function columnsFor(role: Role): Column[] {
  const kitchen: Column[] = [
    { key: 'novos', title: 'Recebidos', statuses: ['received'] },
    { key: 'preparo', title: 'Em preparo', statuses: ['preparing'] },
    { key: 'prontos', title: 'Prontos', statuses: ['ready'] },
  ]
  if (role === 'kitchen') return kitchen
  return [
    { key: 'novos', title: 'Novos', statuses: ['pending', 'awaiting_payment', 'payment_approved', 'received'] },
    kitchen[1],
    kitchen[2],
    { key: 'saiu', title: 'Saiu para entrega', statuses: ['out_for_delivery'] },
  ]
}

export type Action = { to: OrderStatus; label: string; kind: 'primary' | 'danger' }
/** Próximo passo do pedido para este papel (o servidor confere de novo). */
export function actionsFor(o: Pick<AdminOrder, 'status' | 'fulfillment'>, role: Role): Action[] {
  const out: Action[] = []
  const next: Partial<Record<OrderStatus, Action>> = {
    received: { to: 'preparing', label: 'Começar preparo', kind: 'primary' },
    preparing: { to: 'ready', label: 'Marcar pronto', kind: 'primary' },
    ready: o.fulfillment === 'delivery' ? { to: 'out_for_delivery', label: 'Saiu para entrega', kind: 'primary' } : { to: 'completed', label: 'Retirado pelo cliente', kind: 'primary' },
    out_for_delivery: { to: 'completed', label: 'Entregue', kind: 'primary' },
    payment_approved: { to: 'received', label: 'Mandar para a cozinha', kind: 'primary' },
  }
  const a = next[o.status]
  if (a && (role !== 'kitchen' || a.to === 'preparing' || a.to === 'ready')) out.push(a)
  if (role !== 'kitchen' && o.status !== 'completed' && o.status !== 'cancelled') out.push({ to: 'cancelled', label: 'Cancelar', kind: 'danger' })
  return out
}

/** Minutos desde o pedido, em texto curto ("agora", "8 min", "1 h 05"). */
export function since(iso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

/** Pedidos que não estavam na lista anterior (para avisar "pedido novo"). */
export function newOrderCodes(prev: AdminOrder[] | null, next: AdminOrder[]): string[] {
  if (!prev) return []
  const seen = new Set(prev.map((o) => o.id))
  return next.filter((o) => !seen.has(o.id)).map((o) => o.code)
}

export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

// ───────────────────────── horário ─────────────────────────
export function hoursProblem(hours: Hour[]): string | null {
  for (const h of hours) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.opensAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.closesAt)) return `${WEEKDAY[h.weekday]}: use o formato 18:00.`
    if (h.opensAt === h.closesAt) return `${WEEKDAY[h.weekday]}: abertura e fechamento iguais.`
  }
  return null
}

// ───────────────────────── senha (mesma regra do servidor) ─────────────────────────
export function passwordHint(pw: string): string | null {
  if (pw.length < 12) return 'Pelo menos 12 caracteres. Uma frase longa é melhor que símbolos.'
  if (pw.length > 128) return 'No máximo 128 caracteres.'
  return null
}

// ───────────────────────── eventos (Agenda) ─────────────────────────
export type AdminEvent = {
  id: number
  title: string
  startsAt: string
  date: string
  time: string
  endTime: string | null
  summary: string | null
  description: string | null
  highlights: string[]
  reservation: string | null
  instagramUrl: string | null
  imageUrl: string | null
  status: 'draft' | 'published'
  visible: boolean
}
/** O que a IA devolve ao ler o post (rascunho para conferir). */
export type EventDraft = {
  isEvent: boolean
  title: string | null
  date: string | null
  time: string | null
  endTime: string | null
  summary: string | null
  description: string | null
  highlights: string[]
  reservation: string | null
  confidence: 'alta' | 'media' | 'baixa'
  notes: string | null
  warnings: string[]
}
/** Formulário do painel: tudo texto (como a pessoa digita). image: data URL nova | null (tirar) | undefined (manter). */
export type EventForm = {
  title: string
  date: string
  time: string
  endTime: string
  summary: string
  description: string
  highlights: string
  reservation: string
  instagramUrl: string
  image?: string | null
}
export const EMPTY_EVENT: EventForm = { title: '', date: '', time: '', endTime: '', summary: '', description: '', highlights: '', reservation: '', instagramUrl: '' }

export const eventToForm = (e: AdminEvent): EventForm => ({
  title: e.title,
  date: e.date,
  time: e.time,
  endTime: e.endTime ?? '',
  summary: e.summary ?? '',
  description: e.description ?? '',
  highlights: e.highlights.join('\n'),
  reservation: e.reservation ?? '',
  instagramUrl: e.instagramUrl ?? '',
})

/** Junta o que a IA leu ao formulário: só preenche o que veio (não apaga o que a pessoa já digitou). */
export function mergeDraft(f: EventForm, d: EventDraft): EventForm {
  const pick = (cur: string, v: string | null | undefined) => (v ? v : cur)
  return {
    ...f,
    title: pick(f.title, d.title),
    date: pick(f.date, d.date),
    time: pick(f.time, d.time),
    endTime: pick(f.endTime, d.endTime),
    summary: pick(f.summary, d.summary),
    description: pick(f.description, d.description),
    highlights: d.highlights?.length ? d.highlights.join('\n') : f.highlights,
    reservation: pick(f.reservation, d.reservation),
  }
}

/** Problemas do formulário antes de salvar (o servidor confere de novo). Publicar exige data e hora. */
export function eventProblems(f: EventForm): Partial<Record<keyof EventForm, string>> {
  const e: Partial<Record<keyof EventForm, string>> = {}
  if (f.title.trim().length < 2) e.title = 'Dê um nome ao evento.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = 'Escolha a data.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time)) e.time = 'Informe o horário de início.'
  if (f.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.endTime)) e.endTime = 'Use o formato 23:00, ou deixe vazio.'
  if (f.instagramUrl.trim() && !/^https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9._]+\/)?(p|reel|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/.test(f.instagramUrl.trim()))
    e.instagramUrl = 'Cole o link do post (https://www.instagram.com/p/...).'
  if (f.highlights.split('\n').filter((l) => l.trim()).length > 8) e.highlights = 'No máximo 8 destaques.'
  return e
}

export function eventToBody(f: EventForm, status: 'draft' | 'published') {
  return {
    title: f.title.trim(),
    date: f.date,
    time: f.time,
    endTime: f.endTime || null,
    summary: f.summary.trim() || null,
    description: f.description.trim() || null,
    highlights: f.highlights
      .split('\n')
      .map((l) => l.replace(/^[-•·*]\s*/, '').trim())
      .filter(Boolean)
      .map((l) => l.slice(0, 80)),
    reservation: f.reservation.trim() || null,
    instagramUrl: f.instagramUrl.trim() || null,
    status,
    ...(f.image !== undefined ? { image: f.image } : {}),
  }
}

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/** "sáb 31/10 · 20h" */
export function eventWhen(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number)
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const [hh, mm] = time.split(':')
  return `${wd} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${Number(hh)}h${mm === '00' ? '' : mm}`
}

// ───────────────────────── comanda impressa (impressora térmica 58/80 mm) ─────────────────────────
/**
 * Linhas do cupom da cozinha/entrega. Pura (testada). `withContact`: telefone e endereço
 * (só para quem pode ver o contato do cliente — a cozinha imprime sem).
 */
export function ticketLines(o: AdminOrder, withContact: boolean): { text: string; strong?: boolean; big?: boolean; rule?: boolean }[] {
  const L: { text: string; strong?: boolean; big?: boolean; rule?: boolean }[] = []
  L.push({ text: 'CEMITA BURGER & BBQ', strong: true })
  L.push({ text: o.code, big: true })
  L.push({ text: `${o.fulfillment === 'delivery' ? 'ENTREGA' : 'RETIRADA'} · ${hhmm(o.placedAt)}`, strong: true })
  if (o.customerName) L.push({ text: o.customerName })
  L.push({ text: '', rule: true })
  for (const i of o.items) {
    L.push({ text: `${i.quantity}x ${i.name}`, strong: true })
    for (const x of i.options) L.push({ text: `   + ${x.name}` })
    if (i.note) L.push({ text: `   OBS: ${i.note}`, strong: true })
  }
  if (o.notes) {
    L.push({ text: '', rule: true })
    L.push({ text: `OBS DO PEDIDO: ${o.notes}`, strong: true })
  }
  if (o.hasAdultItems) L.push({ text: '18+ confirmado pelo cliente' })
  if (withContact) {
    L.push({ text: '', rule: true })
    if (o.customerPhone) L.push({ text: `Tel: ${o.customerPhone}` })
    if (o.address) {
      L.push({ text: `${o.address.street}, ${o.address.number}${o.address.complement ? ` - ${o.address.complement}` : ''}` })
      L.push({ text: `${o.address.neighborhood}${o.address.cep ? ` · CEP ${o.address.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : ''}` })
      if (o.address.reference) L.push({ text: `Ref.: ${o.address.reference}` })
    }
    L.push({ text: `${PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod}: ${money(o.totalCents)}`, strong: true })
    if (o.changeForCents != null) L.push({ text: `Troco para ${money(o.changeForCents)} (levar ${money(o.changeForCents - o.totalCents)})`, strong: true })
    const n = paymentNote(o.paymentMethod, o.paymentStatus, o.status)
    if (n) L.push({ text: n.text })
  }
  return L
}
