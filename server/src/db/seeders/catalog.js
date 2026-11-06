/**
 * Transforma o cardápio exportado do site (seed-data/catalog.json) em linhas do banco.
 * Funções puras: testadas sem banco.
 *
 * Regras (sem inventar dados):
 * - produto "a partir de" (priceFrom) entra com orderable = false: o preço real
 *   depende de uma opção (tamanho) que ainda não conhecemos;
 * - o grupo antigo "combo" (sem bebida) continua INATIVO e pending_review, como nasceu;
 * - o combo de verdade é o grupo "combo-bebida": uma opção por bebida ("Combo + Coca-Cola"),
 *   ao preço do combo (R$ 15,99) — composição confirmada nos prints do delivery (08/10/2026):
 *   fritas individual + uma bebida à escolha;
 * - adicionais, molhos, ponto da carne etc. vêm de src/config/options.ts (prints do delivery),
 *   ligados às mesmas categorias em que o site já os oferece. As ligações "inferidas"
 *   (grelhado e sanduíches) continuam na lista de pendências do README para a Cemita confirmar.
 */

/** Categorias em que o site atual oferece "Monte seu Combo" (COMBO_NOTE no menu.ts). */
export const COMBO_CATEGORY_SLUGS = ['smash', 'grelhado', 'sanduiches']

export function buildCategoryRows(catalog) {
  return catalog.categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    short_name: c.shortName,
    note: c.note,
    position: c.position,
    active: true,
  }))
}

export function buildProductRows(catalog, categoryIdBySlug) {
  return catalog.categories.flatMap((c) =>
    c.products.map((p) => {
      const categoryId = categoryIdBySlug[c.slug]
      if (!categoryId) throw new Error(`categoria sem id: ${c.slug}`)
      if (!Number.isSafeInteger(p.priceCents) || p.priceCents < 0) throw new Error(`preço inválido em ${p.slug}`)
      return {
        category_id: categoryId,
        slug: p.slug,
        name: p.name,
        description: p.description,
        price_cents: p.priceCents,
        price_from: p.priceFrom,
        orderable: !p.priceFrom,
        available: true,
        active: true,
        is_adult: p.isAdult,
        image_key: `cardapio/${p.slug}`,
        vuca_ref: p.vucaRef,
        position: p.position,
      }
    }),
  )
}

export function buildComboRows(catalog) {
  return {
    group: { key: 'combo', name: 'Transformar em combo', min_select: 0, max_select: 1, active: false, pending_review: true, position: 0 },
    item: { name: 'Combo (composição a confirmar)', price_delta_cents: catalog.combo.priceCents, available: true, active: false, pending_review: true, position: 0 },
    productSlugs: catalog.categories.filter((c) => COMBO_CATEGORY_SLUGS.includes(c.slug)).flatMap((c) => c.products.map((p) => p.slug)),
  }
}

/** Grupo do combo com a bebida escolhida (o site procura este key). */
export const COMBO_DRINK_GROUP_KEY = 'combo-bebida'
export const comboItemName = (drink) => `Combo + ${drink}`

/**
 * Grupos de opção, itens e ligações produto↔grupo.
 * Saída: { groups: [{ row, items: [row] }], links: [{ groupKey, productSlugs }] }
 */
export function buildOptionRows(catalog) {
  const opts = catalog.options ?? { groups: [], byCategory: {} }
  const groups = opts.groups.map((g, gi) => {
    if (!/^[a-z0-9-]+$/.test(g.key)) throw new Error(`key de grupo inválido: ${g.key}`)
    if (!(g.maxSelect >= 1 && g.minSelect <= g.maxSelect)) throw new Error(`mínimo/máximo inválido em ${g.key}`)
    return {
      row: { key: g.key, name: g.name.slice(0, 80), min_select: g.minSelect, max_select: g.maxSelect, active: true, pending_review: false, position: gi + 1 },
      items: g.items.map((i, ii) => {
        if (!Number.isSafeInteger(i.priceCents) || i.priceCents < 0) throw new Error(`preço inválido em ${g.key}: ${i.name}`)
        return { name: i.name.slice(0, 80), price_delta_cents: i.priceCents, available: true, active: true, pending_review: false, position: ii }
      }),
    }
  })
  const slugsOf = (cat) => catalog.categories.find((c) => c.slug === cat)?.products.map((p) => p.slug) ?? []
  const links = []
  for (const [cat, a] of Object.entries(opts.byCategory)) {
    for (const key of a.groups) {
      if (!groups.some((g) => g.row.key === key)) throw new Error(`grupo ${key} ligado a ${cat} não existe`)
      links.push({ groupKey: key, productSlugs: slugsOf(cat) })
    }
  }
  const drinks = catalog.combo?.drinks ?? []
  if (drinks.length) {
    groups.unshift({
      row: { key: COMBO_DRINK_GROUP_KEY, name: 'Combo: fritas individual + bebida', min_select: 0, max_select: 1, active: true, pending_review: false, position: 0 },
      items: drinks.map((d, i) => ({ name: comboItemName(d).slice(0, 80), price_delta_cents: catalog.combo.priceCents, available: true, active: true, pending_review: false, position: i })),
    })
    links.unshift({ groupKey: COMBO_DRINK_GROUP_KEY, productSlugs: catalog.categories.filter((c) => COMBO_CATEGORY_SLUGS.includes(c.slug)).flatMap((c) => c.products.map((p) => p.slug)) })
  }
  return { groups, links }
}

const WEEKDAYS = { domingo: 0, segunda: 1, terça: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6 }

/**
 * Converte o horário textual de restaurant.ts ("Terça a domingo" · "18h às 23h")
 * em linhas de store_hours. Só entende esse formato; qualquer outro texto é recusado
 * (melhor parar do que adivinhar um horário).
 */
export function buildHoursRows(hours) {
  const rows = []
  for (const h of hours) {
    if (/^fechado$/i.test(h.time.trim())) continue
    const days = h.days.trim().toLowerCase()
    const time = h.time.trim().toLowerCase().match(/^(\d{1,2})h(?:(\d{2}))?\s*às\s*(\d{1,2})h(?:(\d{2}))?$/)
    if (!time) throw new Error(`horário não reconhecido: "${h.time}"`)
    const opens = `${time[1].padStart(2, '0')}:${time[2] ?? '00'}:00`
    const closes = `${time[3].padStart(2, '0')}:${time[4] ?? '00'}:00`
    let list
    const range = days.match(/^(\S+)\s+a\s+(\S+)$/)
    if (range && range[1] in WEEKDAYS && range[2] in WEEKDAYS) {
      const a = WEEKDAYS[range[1]]
      const b = WEEKDAYS[range[2]]
      list = []
      for (let d = a; ; d = (d + 1) % 7) {
        list.push(d)
        if (d === b) break
      }
    } else if (days in WEEKDAYS) list = [WEEKDAYS[days]]
    else throw new Error(`dias não reconhecidos: "${h.days}"`)
    for (const weekday of list) rows.push({ weekday, opens_at: opens, closes_at: closes })
  }
  return rows.sort((x, y) => x.weekday - y.weekday)
}

/**
 * Configurações iniciais. value = null significa PENDENTE de definição pela Cemita:
 * o sistema trata "pendente" de forma segura (ex.: sem prazo de retenção = não anonimiza
 * automaticamente; sem zona de entrega = só retirada).
 */
export const DEFAULT_SETTINGS = [
  { key: 'ordering_mode', value: 'vuca', why: 'transição: o site continua levando ao delivery VUCA até o pedido próprio ser ligado (vuca | native | both)' },
  { key: 'orders_paused', value: false, why: 'pausa manual de pedidos pelo painel' },
  { key: 'store_timezone', value: 'America/Sao_Paulo', why: 'fuso usado para o horário da loja' },
  { key: 'payment_methods_enabled', value: ['cash_on_delivery', 'card_on_delivery'], why: 'decidido: pagamento na entrega (dinheiro e maquininha). PIX/cartão online entram com o gateway' },
  { key: 'pickup_eta_minutes', value: null, why: 'PENDENTE (Cemita): tempo médio de retirada' },
  { key: 'min_order_cents', value: null, why: 'PENDENTE (Cemita): pedido mínimo geral' },
  { key: 'payment_timeout_minutes', value: null, why: 'PENDENTE (gateway): prazo para pagar antes de cancelar' },
  { key: 'data_retention_days', value: null, why: 'PENDENTE (Cemita + responsável jurídico): prazo para anonimizar dados de pedidos' },
]
