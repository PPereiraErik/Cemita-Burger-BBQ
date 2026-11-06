import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { COMBO_PRICE, categoryOf, findItem, formatPrice, type MenuItem } from '../config/menu'
import { groupsFor, optionsLabel, optionsPrice } from '../config/options'
import { restaurant } from '../config/restaurant'
import { api } from './api'
import { getLive, nativeOrdering, useLive } from './live'
import { availabilityOf, comboPriceOf, mapServerIssues, priceOf, toQuoteLines, type LineProblem } from './liveCore'

/**
 * COMANDA — a lista que o cliente monta enquanto olha o cardápio.
 * Cada linha guarda o produto + as escolhas (combo, observação).
 * O pedido é finalizado no delivery oficial (ou enviado como mensagem no WhatsApp).
 * Guardada só nesta aba (sessionStorage).
 * Com a API ligada, preços e "esgotado" vêm do banco; com o pedido pelo site ligado no painel,
 * o total exibido é o que o SERVIDOR calculou (a comanda nunca manda preço).
 */
/** opts: ids de config/options.ts (adicionais, molhos, ponto da carne, bebida do combo…) */
export type Line = { key: string; id: string; qty: number; combo?: boolean; note?: string; opts?: string[] }
export type AddOptions = { qty?: number; combo?: boolean; note?: string; opts?: string[] }
type Last = { name: string; qty: number; id: string; key: string; combo: boolean }
type State = { lines: Line[]; quip: string | null; last: Last | null; tick: number }

/** Categorias em que o delivery oferece "Monte seu Combo". */
export const COMBO_CATEGORIES = new Set(['smash', 'grelhado', 'sanduiches'])
export const canCombo = (id: string) => COMBO_CATEGORIES.has(categoryOf(id))
/** Tem escolha obrigatória (ex.: ponto da carne)? Então o "+" abre os detalhes em vez de anotar direto. */
export const needsChoice = (id: string) => groupsFor(categoryOf(id)).some((g) => g.required)

const KEY = 'cemita:comanda:v2'
const keyOf = (id: string, combo?: boolean, note?: string, opts?: string[]) => `${id}|${combo ? 1 : 0}|${(note ?? '').trim().toLowerCase()}|${[...(opts ?? [])].sort().join(',')}`

let state: State = { lines: [], quip: null, last: null, tick: 0 }
try {
  const raw = sessionStorage.getItem(KEY)
  if (raw) state = { ...state, lines: (JSON.parse(raw) as Line[]).filter((l) => l && l.id && l.qty > 0) }
} catch {
  /* sem storage: tudo bem */
}

const listeners = new Set<() => void>()
const save = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state.lines))
  } catch {
    /* ok */
  }
}
const set = (next: Partial<State>) => {
  state = { ...state, ...next, tick: state.tick + 1 }
  save()
  listeners.forEach((l) => l())
}
const count = (lines: Line[]) => lines.reduce((n, l) => n + l.qty, 0)

/** As piadas da comanda (aparecem conforme o pedido cresce). */
function quipFor(item: MenuItem, total: number): string {
  const category = categoryOf(item.id)
  if (category === 'bebidas' || category === 'cervejas') return total > 1 ? 'Hidratação é importante.' : 'Começou pela bebida. Respeito.'
  if (category === 'sobremesas') return 'Sobremesa não conta.'
  if (category === 'bbq') return 'Isso é compromisso.'
  if (category === 'vegetariano') return 'Até a dieta veio no Cemita.'
  if (item.id === 'burger-cemita') return 'O que leva o nome da casa. Ótimo.'
  const seq = ['Boa escolha.', 'Só mais um.', 'Mentira. Pede dois.', 'A dieta morre aqui.', 'Ninguém está contando.', 'Aqui jaz a sua fome.']
  return seq[Math.min(total - 1, seq.length - 1)]
}

export const comanda = {
  add(item: MenuItem, opts: AddOptions = {}) {
    if (availabilityOf(item.id, getLive().index) !== 'ok') return
    const qty = Math.max(1, Math.min(20, opts.qty ?? 1))
    const combo = !!opts.combo && canCombo(item.id)
    const note = opts.note?.trim().slice(0, 140) || undefined
    // a bebida do combo só existe com combo
    const chosen = (opts.opts ?? []).filter((o) => combo || !o.startsWith('bebida:'))
    const extras = chosen.length ? [...new Set(chosen)].sort() : undefined
    const key = keyOf(item.id, combo, note, extras)
    const lines = [...state.lines]
    const i = lines.findIndex((l) => l.key === key)
    if (i >= 0) lines[i] = { ...lines[i], qty: Math.min(20, lines[i].qty + qty) }
    else lines.push({ key, id: item.id, qty, combo: combo || undefined, note, opts: extras })
    set({ lines, quip: quipFor(item, count(lines)), last: { name: item.name, qty, id: item.id, key, combo } })
  },
  inc(key: string) {
    const lines = state.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + 1) } : l))
    set({ lines, last: null })
  },
  dec(key: string) {
    const lines = state.lines.map((l) => (l.key === key ? { ...l, qty: l.qty - 1 } : l)).filter((l) => l.qty > 0)
    set({ lines, last: null, quip: lines.length ? 'Desistir não combina com você.' : 'Comanda vazia. Por enquanto.' })
  },
  /** Troca uma linha por outra (ex.: "virar combo"): tira a antiga e anota a nova no lugar. */
  replace(oldKey: string, item: MenuItem, opts: AddOptions = {}) {
    state = { ...state, lines: state.lines.filter((l) => l.key !== oldKey) }
    comanda.add(item, opts)
  },
  remove(key: string) {
    const lines = state.lines.filter((l) => l.key !== key)
    set({ lines, last: null, quip: lines.length ? state.quip : 'Comanda vazia. Por enquanto.' })
  },
  clear() {
    set({ lines: [], last: null, quip: 'Comanda vazia. Por enquanto.' })
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

/** Preço da unidade em reais (da API quando disponível, senão do cardápio do site), com combo e adicionais. */
export const unitPrice = (item: MenuItem, combo?: boolean, opts?: string[]) => {
  const index = getLive().index
  return (priceOf(item.id, item.price, index) ?? 0) + (combo ? comboPriceOf(index, COMBO_PRICE) : 0) + optionsPrice(opts)
}

export function useComanda() {
  useLive() // preço novo da API redesenha a comanda
  const s = useSyncExternalStore(comanda.subscribe, () => state, () => state)
  const items = s.lines.map((l) => {
    const item = findItem(l.id)
    const unit = unitPrice(item, l.combo, l.opts)
    return { ...l, item, unit, lineTotal: unit * l.qty, extras: optionsLabel(l.opts) }
  })
  const total = items.reduce((t, l) => t + l.lineTotal, 0)
  const qty = count(s.lines)
  return { items, total, qty, quip: s.quip, last: s.last, tick: s.tick }
}

export function whatsappComandaUrl(items: ReturnType<typeof useComanda>['items'], total: number) {
  const lines = items.map((l) => {
    const extra = [l.combo ? 'em combo' : '', l.extras, l.note ? `obs.: ${l.note}` : ''].filter(Boolean).join(' · ')
    return `${l.qty}x ${l.item.name}${extra ? ` (${extra})` : ''} — ${formatPrice(l.lineTotal)}`
  })
  const text = `Olá, Cemita! Minha comanda:\n${lines.join('\n')}\nTotal: ${formatPrice(total)}`
  return `${restaurant.contact.whatsappUrl}?text=${encodeURIComponent(text)}`
}

/**
 * COTAÇÃO NO SERVIDOR — só quando o pedido pelo site está ligado (modo native/both).
 * Manda ids e quantidades; recebe o total oficial e o que não pode ser pedido.
 * Espera 400 ms depois da última mudança para não chamar a API a cada toque.
 */
export type ServerQuote =
  | { state: 'off' }
  | { state: 'loading' }
  | { state: 'ok'; totalCents: number; problems: LineProblem[]; general: string[] }
  | { state: 'error' }

export function useServerQuote(): ServerQuote {
  const live = useLive()
  const s = useSyncExternalStore(comanda.subscribe, () => state, () => state)
  const on = nativeOrdering(live) && !!live.index && s.lines.length > 0
  const payload = useMemo(() => (on && live.index ? toQuoteLines(s.lines, live.index) : null), [on, live.index, s.lines])
  const body = payload ? JSON.stringify([payload.lines, payload.problems.map((p) => p.key)]) : ''
  const [result, setResult] = useState<{ body: string; quote: ServerQuote } | null>(null)

  useEffect(() => {
    if (!payload) return
    if (!payload.lines.length) {
      setResult({ body, quote: { state: 'ok', totalCents: 0, problems: payload.problems, general: [] } })
      return
    }
    const ctrl = new AbortController()
    const t = window.setTimeout(() => {
      api
        .quote(payload.lines, ctrl.signal)
        .then((q) => {
          const server = mapServerIssues(q.errors, payload.keys)
          setResult({ body, quote: { state: 'ok', totalCents: q.totalCents, problems: [...payload.problems, ...server.byLine], general: server.general } })
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setResult({ body, quote: { state: 'error' } })
        })
    }, 400)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
    // `body` resume o payload: só recota quando ids, quantidades ou escolhas mudam
  }, [body]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!payload) return { state: 'off' }
  if (!result || result.body !== body) return { state: 'loading' }
  return result.quote
}
