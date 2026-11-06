import { useSyncExternalStore } from 'react'

/**
 * Estado de interface compartilhado: a gaveta da comanda, o produto aberto e a categoria do cardápio.
 * Qualquer parte do site pode abrir a comanda, os detalhes de um produto ou o cardápio numa categoria.
 */
/** Abrir o produto já com combo marcado, substituindo uma linha da comanda (oferta "virar combo"). */
export type ProductPreset = { combo?: boolean; replaceKey?: string; qty?: number; note?: string; opts?: string[] }
type UI = { comanda: boolean; product: string | null; preset: ProductPreset | null; category: string; checkout: boolean }
let ui: UI = { comanda: false, product: null, preset: null, category: 'smash', checkout: false }
const subs = new Set<() => void>()
const set = (next: Partial<UI>) => {
  ui = { ...ui, ...next }
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

export const openComanda = () => set({ comanda: true, product: null, checkout: false })
/** Checkout: fecha a comanda e abre o formulário do pedido. */
export const openCheckout = () => set({ checkout: true, comanda: false, product: null })
export const closeCheckout = () => set({ checkout: false })
export const closeComanda = () => set({ comanda: false })
export const openProduct = (id: string, preset: ProductPreset | null = null) => set({ product: id, preset, comanda: false })
export const closeProduct = () => set({ product: null, preset: null })
export const setCategory = (category: string) => set({ category })
/** Leva ao cardápio já na categoria pedida (ex.: "Ver os cortes" → BBQ). Um clique, sem procurar. */
export const goToCategory = (category: string) => {
  set({ category })
  document.getElementById('cardapio-lista')?.scrollIntoView({ block: 'start' })
}

export const useUI = () => useSyncExternalStore(subscribe, () => ui, () => ui)
