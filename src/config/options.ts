/**
 * ADICIONAIS, MOLHOS, ACOMPANHAMENTOS, PONTO DA CARNE E COMBO
 * ✅ Nomes e preços: prints do delivery oficial enviados pelo Erik em 08/10/2026.
 *
 * Em quais produtos cada grupo aparece:
 *   'visto'    = o grupo apareceu no print daquele tipo de produto;
 *   'inferido' = apareceu num produto parecido (ex.: no combo do grelhado) e foi estendido à categoria.
 *                ⚠️ A CONFIRMAR com a Cemita (está listado no README, em "Pendências").
 *
 * Na comanda, as escolhas são um lembrete (com o preço do delivery); o pedido continua sendo
 * finalizado no delivery. No pedido pelo próprio site, os adicionais só valem depois de cadastrados no painel.
 */

export type Option = { id: string; name: string; price: number }
export type OptionGroup = {
  id: string
  title: string
  /** quantas escolhas no máximo */
  max: number
  /** obrigatório escolher 1 (ex.: ponto da carne) */
  required?: boolean
  options: Option[]
}

const g = (id: string, title: string, max: number, options: [string, string, number][], required = false): OptionGroup => ({
  id,
  title,
  max,
  required,
  options: options.map(([oid, name, price]) => ({ id: `${id}:${oid}`, name, price })),
})

export const GROUPS = {
  ponto: g('ponto', 'Escolha o ponto da sua carne', 1, [
    ['vermelha', 'Vermelha por dentro', 0],
    ['cinza', 'Cinza por dentro', 0],
  ], true),
  adicionais: g('adicional', 'Vai um adicional aí?', 4, [
    ['gorgonzola', 'Queijo gorgonzola', 12],
    ['mucarela', 'Muçarela', 8],
    ['cheddar', 'Cheddar', 8],
    ['cebola-caramelizada', 'Cebola caramelizada', 6],
    ['bacon', 'Bacon', 8],
    ['tomate', 'Tomate', 6],
    ['alface', 'Alface', 6],
    ['frango-crocante', 'Frango crocante', 9],
    ['ovo', 'Ovo', 5],
    ['jalapeno', 'Pimenta jalapeño', 5],
    ['picles', 'Picles', 5],
  ]),
  molhos: g('molho', 'Molhos', 3, [
    ['chipotle', 'Chipotle', 8],
    ['barbecue', 'Barbecue', 8],
    ['especial', 'Molho especial da casa (sabor Mc, rsrs)', 8],
    ['maionese-grill', 'Maionese grill (defumada)', 8],
    ['cheddar', 'Cheddar', 8],
    ['maionese-especial', 'Maionese especial da casa', 6],
  ]),
  fritas: g('fritas', 'Quero batatinha frita!', 1, [['individual', 'Fritas individual', 15]]),
  carneSmash: g('carne-smash', 'Adicional de carne smash', 1, [['110g', 'Carne 110g', 10]]),
  carneGrelhado: g('carne-grelhado', 'Adicional de carne', 1, [['150g', 'Carne 150g', 15]]),
  carneVegana: g('carne-vegana', 'Adicional de carne vegana', 1, [['vegana', 'Carne vegana', 10]]),
  sobremesa: g('sobremesa', 'Sobremesa', 1, [['pudim', 'Pudim de leite condensado', 12]]),
  acompanhamentos: g('acompanhamento', 'Acompanhamento adicional', 3, [
    ['batata-canoa', 'Batata canoa (porção)', 35],
    ['coleslaw', 'Coleslaw', 12],
    ['farofa', 'Farofa', 8],
    ['jalapeno', 'Conserva de pimenta jalapeño', 10],
    ['relish', 'Relish de pepino', 10],
    ['pao-de-alho', 'Pão de alho', 20],
  ]),
} as const

/** Bebida do combo (obrigatória, sem acréscimo). A Fanta de Halloween ficou de fora: era só até o evento. */
export const COMBO_DRINKS = g('bebida', 'Escolha a bebida do combo', 1, [
  ['tonica', 'Água tônica Schweppes 350ml', 0],
  ['schweppes-citrus', 'Schweppes Citrus 350ml', 0],
  ['coca', 'Coca-Cola', 0],
  ['coca-zero', 'Coca-Cola Zero', 0],
  ['guarana', 'Guaraná Antarctica 350ml', 0],
  ['guarana-zero', 'Guaraná Antarctica Zero', 0],
  ['sprite', 'Sprite 350ml', 0],
  ['sprite-zero', 'Sprite Zero 350ml', 0],
  ['agua', 'Água Crystal 500ml', 0],
  ['agua-gas', 'Água com gás Crystal 510ml', 0],
], true)

/** O que vem no combo, além do lanche. */
export const COMBO_INCLUDES = 'Fritas individual + uma bebida à sua escolha'

type Assign = { groups: OptionGroup[]; source: 'visto' | 'inferido' }

/** Grupos por categoria do cardápio (src/config/menu.ts). */
export const GROUPS_BY_CATEGORY: Record<string, Assign> = {
  // visto no Smash Rib
  smash: { groups: [GROUPS.adicionais, GROUPS.fritas, GROUPS.carneSmash, GROUPS.carneVegana], source: 'visto' },
  // ponto, adicionais e carne 150g vistos no combo do grelhado; fritas por analogia ao smash
  grelhado: { groups: [GROUPS.ponto, GROUPS.adicionais, GROUPS.fritas, GROUPS.carneGrelhado, GROUPS.carneVegana], source: 'inferido' },
  // adicionais vistos no combo de sanduíche; fritas por analogia
  sanduiches: { groups: [GROUPS.adicionais, GROUPS.fritas], source: 'inferido' },
  // visto no Burger Veg
  vegetariano: { groups: [GROUPS.adicionais, GROUPS.molhos, GROUPS.fritas, GROUPS.sobremesa], source: 'visto' },
  // visto no Pork Ribs
  bbq: { groups: [GROUPS.fritas, GROUPS.acompanhamentos], source: 'visto' },
}

const ALL = new Map<string, Option>()
for (const grp of [...Object.values(GROUPS), COMBO_DRINKS]) for (const o of grp.options) ALL.set(o.id, o)

export const findOption = (id: string) => ALL.get(id)
export const groupsFor = (category: string) => GROUPS_BY_CATEGORY[category]?.groups ?? []
/** Soma em reais das escolhas (ids desconhecidos valem 0 — ex.: comanda antiga salva no navegador). */
export const optionsPrice = (ids: readonly string[] = []) => ids.reduce((t, id) => t + (ALL.get(id)?.price ?? 0), 0)
/** Texto curto das escolhas: "Bacon · Cheddar · ponto: vermelha por dentro". */
const ORDER = ['ponto', 'adicional', 'molho', 'carne-smash', 'carne-grelhado', 'carne-vegana', 'fritas', 'acompanhamento', 'sobremesa', 'bebida']
const rank = (id: string) => {
  const r = ORDER.indexOf(id.split(':')[0])
  return r < 0 ? ORDER.length : r
}
export const optionsLabel = (ids: readonly string[] = []) =>
  [...ids]
    .sort((a, b) => rank(a) - rank(b))
    .map((id) => {
      const o = ALL.get(id)
      if (!o) return null
      if (id.startsWith('ponto:')) return `ponto: ${o.name.toLowerCase()}`
      if (id.startsWith('bebida:')) return `bebida: ${o.name}`
      return `+ ${o.name}`
    })
    .filter(Boolean)
    .join(' · ')
