/**
 * CARDÁPIO DE LÁPIDES — regras puras (sem React). Testadas em tests/cardapio.test.ts.
 * Busca sem acento e sem maiúsculas, por nome, ingrediente e categoria.
 */
import type { MenuCategory, MenuItem } from '../config/menu'

/** "Pão Brioche, Maionese" → "pao brioche, maionese" */
export const normalize = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export type Lapide = { item: MenuItem; categoryId: string; categoryTitle: string; /** 0, 1 ou 2: qual dos 3 modelos de pedra */ variant: 0 | 1 | 2 }

/**
 * Lápides a mostrar: da categoria escolhida ou, com busca, de todas as categorias.
 * Cada termo digitado precisa aparecer (em qualquer ordem) no nome, na descrição ou na categoria.
 */
export function lapides(menu: MenuCategory[], order: string[], titles: Record<string, string>, category: string, query: string): Lapide[] {
  const q = normalize(query)
  const terms = q ? q.split(' ') : []
  const cats = order.map((id) => menu.find((c) => c.id === id)).filter((c): c is MenuCategory => !!c)
  const out: Lapide[] = []
  for (const c of cats) {
    if (!terms.length && c.id !== category) continue
    const title = titles[c.id] ?? c.label
    for (const item of c.items) {
      if (terms.length) {
        const hay = normalize(`${item.name} ${item.description ?? ''} ${title} ${c.label}`)
        if (!terms.every((t) => hay.includes(t))) continue
      }
      out.push({ item, categoryId: c.id, categoryTitle: title, variant: (out.length % 3) as 0 | 1 | 2 })
    }
  }
  return out
}

/** Linha discreta acima da grade. */
export function resumo(category: string, titles: Record<string, string>, query: string, n: number, dica?: string) {
  const q = query.trim()
  if (q) return `${n === 1 ? '1 ITEM' : `${n} ITENS`} PARA “${q.toUpperCase()}”`
  return `${(titles[category] ?? category).toUpperCase()} · ${n === 1 ? '1 ITEM' : `${n} ITENS`} · ${dica ?? 'TOQUE NA LÁPIDE PARA VER OS INGREDIENTES'}`
}
