/**
 * Regras puras (sem React, sem rede) que ligam o cardápio do site aos dados da API.
 * Testadas em scripts/test-live.mjs.
 */
import { findOption } from '../config/options.ts'
import type { ApiCatalog, ApiIssue, ApiOptionItem, ApiProduct, ApiStoreStatus, QuoteLineInput } from './api'

export type LiveProduct = ApiProduct & { combo: ApiOptionItem | null }
export type LiveIndex = Map<string, LiveProduct>

/**
 * Grupo do combo no banco: uma opção por bebida ("Combo + Coca-Cola"), ao preço do combo.
 * (O grupo antigo "combo", sem bebida, ficou inativo e não é mais usado.)
 */
export const COMBO_GROUP_KEY = 'combo-bebida'
export const comboItemName = (drink: string) => `Combo + ${drink}`
/** Compara nomes de opção sem diferença de maiúscula, acento ou espaço. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** slug → produto da API (só o que o servidor publicou: ativos, com grupos ativos e revisados). */
export function indexCatalog(catalog: ApiCatalog): LiveIndex {
  const index: LiveIndex = new Map()
  for (const c of catalog.categories)
    for (const p of c.products) {
      const group = p.optionGroups.find((g) => g.key === COMBO_GROUP_KEY && g.maxSelect >= 1)
      const combo = group?.items.find((i) => i.available) ?? null
      index.set(p.slug, { ...p, combo })
    }
  return index
}

export type Availability = 'ok' | 'soldout' | 'off'

/**
 * Situação de um item do cardápio do site segundo a API.
 * Sem índice (API desligada ou fora do ar) → 'ok': o site segue como sempre foi.
 * Item que o painel desativou some do catálogo → 'off'.
 */
export function availabilityOf(slug: string, index: LiveIndex | null): Availability {
  if (!index) return 'ok'
  const p = index.get(slug)
  if (!p) return 'off'
  return p.available ? 'ok' : 'soldout'
}

/** Preço em reais: o da API quando existe, senão o do cardápio do site. */
export function priceOf(slug: string, fallback: number | null, index: LiveIndex | null): number | null {
  const p = index?.get(slug)
  return p ? p.priceCents / 100 : fallback
}

/** Preço do combo em reais: o da API se algum produto tiver o combo publicado, senão o do site. */
export function comboPriceOf(index: LiveIndex | null, fallback: number): number {
  if (index) for (const p of index.values()) if (p.combo) return p.combo.priceDeltaCents / 100
  return fallback
}

export type ComandaLineLike = { key: string; id: string; qty: number; combo?: boolean; note?: string; opts?: string[] }
export type LineProblem = { key: string; message: string }

/**
 * Converte a comanda em linhas para a cotação do servidor (ids + quantidades + ids de opção, nada de preço).
 * As opções da comanda (ex.: "adicional:bacon", "ponto:vermelha", "bebida:coca") viram o id do item
 * de opção do banco: mesmo grupo (key) e mesmo nome. O combo vira a opção "Combo + <bebida>".
 * O que não dá para mandar vira problema da linha, com texto para o cliente:
 * - item fora do catálogo da API;
 * - combo ou opção que ainda não está publicado no painel/banco.
 */
export function toQuoteLines(lines: ComandaLineLike[], index: LiveIndex): { lines: QuoteLineInput[]; keys: string[]; problems: LineProblem[] } {
  const out: QuoteLineInput[] = []
  const keys: string[] = []
  const problems: LineProblem[] = []
  for (const l of lines) {
    const p = index.get(l.id)
    if (!p) {
      problems.push({ key: l.key, message: 'Este item não está disponível no pedido pelo site.' })
      continue
    }
    const optionIds: number[] = []
    let problem: string | null = null
    const opts = l.opts ?? []
    if (l.combo) {
      const group = p.optionGroups.find((g) => g.key === COMBO_GROUP_KEY)
      const drink = findOption(opts.find((o) => o.startsWith('bebida:')) ?? '')?.name
      const item = group && drink ? group.items.find((i) => norm(i.name) === norm(comboItemName(drink))) : undefined
      if (!group) problem = 'Combo ainda não disponível no pedido pelo site.'
      else if (!drink) problem = 'Escolha a bebida do combo.'
      else if (!item) problem = `Combo com ${drink} ainda não disponível no pedido pelo site.`
      else optionIds.push(item.id)
    }
    for (const o of opts) {
      if (problem) break
      if (o.startsWith('bebida:')) continue // a bebida já foi no combo
      const name = findOption(o)?.name
      const group = p.optionGroups.find((g) => g.key === o.split(':')[0])
      const item = name && group ? group.items.find((i) => norm(i.name) === norm(name)) : undefined
      if (!item) problem = `${name ?? 'Esta opção'} ainda não está disponível no pedido pelo site.`
      else optionIds.push(item.id)
    }
    if (problem) {
      problems.push({ key: l.key, message: problem })
      continue
    }
    const note = l.note?.trim()
    out.push({ productId: p.id, quantity: l.qty, optionIds, ...(note ? { note } : {}) })
    keys.push(l.key)
  }
  return { lines: out, keys, problems }
}

/** Problemas que o servidor devolveu, ligados de volta à linha da comanda (pelo índice enviado). */
export function mapServerIssues(issues: ApiIssue[], keys: string[]): { byLine: LineProblem[]; general: string[] } {
  const byLine: LineProblem[] = []
  const general: string[] = []
  for (const i of issues) {
    if (typeof i.line === 'number' && keys[i.line]) byLine.push({ key: keys[i.line], message: i.message })
    else general.push(i.message)
  }
  return { byLine, general }
}

/* ---------- aberto agora? ---------- */

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const WD_EN: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** "18:00" → "18h"; "18:30" → "18h30". */
export const hourLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':')
  return `${Number(h)}h${m && m !== '00' ? m : ''}`
}

/** Dia da semana e minuto do dia no fuso da loja (não depende do fuso do aparelho). */
export function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { weekday: WD_EN[get('weekday')] ?? 0, minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) }
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Frase curta do status, no mesmo tom do site, a partir do horário cadastrado na API.
 * `open` vem do servidor; aqui só montamos o texto ("até as 23h", "abre hoje às 18h"...).
 */
export function openNote(status: Pick<ApiStoreStatus, 'open' | 'hours' | 'timezone'>, now: Date): string {
  const { weekday, minutes } = localClock(now, status.timezone)
  const today = status.hours.filter((h) => h.weekday === weekday)
  if (status.open) {
    const current = today.find((h) => {
      const o = toMin(h.opensAt)
      const c = toMin(h.closesAt)
      return c > o ? minutes >= o && minutes < c : minutes >= o
    })
    const yesterday = status.hours.find((h) => h.weekday === (weekday + 6) % 7 && toMin(h.closesAt) <= toMin(h.opensAt))
    const closes = current?.closesAt ?? yesterday?.closesAt
    return closes ? `até as ${hourLabel(closes)}` : 'aberto agora'
  }
  const laterToday = today.filter((h) => toMin(h.opensAt) > minutes).sort((a, b) => toMin(a.opensAt) - toMin(b.opensAt))[0]
  if (laterToday) return `abre hoje às ${hourLabel(laterToday.opensAt)}`
  for (let d = 1; d <= 7; d++) {
    const wd = (weekday + d) % 7
    const next = status.hours.filter((h) => h.weekday === wd).sort((a, b) => toMin(a.opensAt) - toMin(b.opensAt))[0]
    if (!next) continue
    if (today.length === 0) return `${WEEKDAYS[weekday]} é folga · volta ${WEEKDAYS[wd]}, ${hourLabel(next.opensAt)}`
    return d === 1 ? `abre amanhã às ${hourLabel(next.opensAt)}` : `volta ${WEEKDAYS[wd]}, ${hourLabel(next.opensAt)}`
  }
  return 'fechado'
}
