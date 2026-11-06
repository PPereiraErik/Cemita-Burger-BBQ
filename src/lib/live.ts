import { useSyncExternalStore } from 'react'
import { COMBO_PRICE } from '../config/menu'
import { api, apiEnabled, type ApiStoreStatus } from './api'
import { availabilityOf, comboPriceOf, indexCatalog, priceOf, type Availability, type LiveIndex } from './liveCore'

/**
 * DADOS AO VIVO — cardápio e estado da loja vindos da API.
 * - Sem VITE_API_URL: status 'off' e o site usa só src/config (como sempre).
 * - API fora do ar: status 'error' e o site também cai para src/config, sem aviso assustador.
 * - Com dados: preço, esgotado e "aberto agora" passam a vir do banco (o que o painel mudar aparece aqui).
 * O cardápio é relido a cada 5 min e o estado da loja a cada 1 min (e quando a aba volta a ficar visível).
 */
export type LiveState = {
  status: 'off' | 'loading' | 'ready' | 'error'
  index: LiveIndex | null
  store: ApiStoreStatus | null
}

let state: LiveState = { status: apiEnabled ? 'loading' : 'off', index: null, store: null }
const listeners = new Set<() => void>()
const set = (next: Partial<LiveState>) => {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const getLive = () => state
export const useLive = () => useSyncExternalStore(subscribe, getLive, getLive)

/** Pedido pelo próprio site ligado no painel (native ou both)? */
export const nativeOrdering = (s: LiveState) => s.status === 'ready' && !!s.store && s.store.orderingMode !== 'vuca'

const CATALOG_EVERY = 5 * 60_000
const STORE_EVERY = 60_000

async function refreshCatalog() {
  try {
    const index = indexCatalog(await api.catalog())
    set({ index, status: state.store ? 'ready' : state.status })
  } catch {
    // mantém o último cardápio bom; sem nenhum, cai para o do site
    if (!state.index) set({ status: 'error' })
  }
}

async function refreshStore() {
  try {
    const store = await api.storeStatus()
    set({ store, status: state.index ? 'ready' : state.status })
  } catch {
    if (!state.store) set({ status: 'error' })
  }
}

let started = false
/** Chamado uma vez na abertura do site (main.tsx). */
export function startLive() {
  if (started || !apiEnabled || typeof window === 'undefined') return
  started = true
  void Promise.all([refreshCatalog(), refreshStore()])
  window.setInterval(() => document.visibilityState === 'visible' && void refreshCatalog(), CATALOG_EVERY)
  window.setInterval(() => document.visibilityState === 'visible' && void refreshStore(), STORE_EVERY)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshStore()
  })
}

/* ---------- atalhos para os componentes ---------- */

/** Preço em reais de um item do site (da API quando houver). */
export function useItemPrice(slug: string, fallback: number | null) {
  return priceOf(slug, fallback, useLive().index)
}
/** 'ok' | 'soldout' (esgotado hoje) | 'off' (fora do cardápio do painel). Sem API: sempre 'ok'. */
export function useAvailability(slug: string): Availability {
  return availabilityOf(slug, useLive().index)
}
/** Preço do combo em reais (da API quando o combo estiver publicado no painel). */
export function useComboPrice() {
  return comboPriceOf(useLive().index, COMBO_PRICE)
}
/** O botão "combo" aparece? No modo VUCA, como sempre; no pedido pelo site, só se o combo estiver publicado. */
export function useComboOffered(slug: string, localRule: boolean) {
  const live = useLive()
  if (!nativeOrdering(live)) return localRule
  return !!live.index?.get(slug)?.combo
}
export const AVAILABILITY_LABEL: Record<Exclude<Availability, 'ok'>, string> = { soldout: 'Esgotado hoje', off: 'Indisponível' }
