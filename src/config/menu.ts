/**
 * CARDÁPIO DO CEMITA
 * ✅ Fonte: delivery oficial (cemita.com.br → VucaFood), conferido em 05/10/2026
 *    e de novo em 08/10/2026 pelos prints enviados pelo Erik (fotos, bebidas, +18, caldo de cana).
 * Nomes, descrições e preços transcritos do cardápio público. Revise antes de publicar.
 *
 * Fotos: coloque em src/assets/fotos/cardapio/<id>.jpg (ex.: smash-rib.jpg).
 * Se a foto não existir, o site mostra um espaço reservado elegante.
 */
import { restaurant } from './restaurant'

export const MENU_PRICES_CHECKED_AT = '08/10/2026'

export type MenuItem = {
  id: string
  name: string
  description?: string
  /** em reais. null = não exibir preço */
  price: number | null
  /** "A partir de" */
  priceFrom?: boolean
  /** id do produto no VucaFood (link direto do botão PEDIR) */
  orderId?: number
  tags?: string[]
}

export type MenuCategory = {
  id: string
  label: string
  /** rótulo curto para abas no mobile */
  short?: string
  note?: string
  items: MenuItem[]
}

export const menu: MenuCategory[] = [
  {
    id: 'smash',
    label: 'Smash',
    items: [
      { id: 'smash-rib', name: 'Smash Rib', price: 39, orderId: 448, description: 'Brioche, maionese da casa, smash crocante, costela defumada desfiada, catupiry, creme cheddar e cebola crua.' },
      { id: 'smash-burger', name: 'Smash Burger', price: 26, orderId: 16, description: 'Pão brioche, smash burger de 110g, cheddar, maionese da casa e cebola caramelizada.' },
      { id: 'smash-salada', name: 'Smash Salada', price: 28, orderId: 17, description: 'Pão brioche, smash burger de 110g, cheddar, relish de pepino, cebola, alface americana, tomate e molho especial.' },
      { id: 'smash-bacon', name: 'Smash Bacon', price: 35, orderId: 18, description: 'Pão brioche, smash burger de 110g, bacon, cheddar e maionese da casa.' },
      { id: 'smash-invertido', name: 'Smash Invertido', price: 32, orderId: 19, description: 'Releitura do “patty melt”, tradicional lanche americano: pão brioche invertido, smash burger de 110g “smashado” com cebola, relish de pepino, molho especial e muito cheddar.' },
      { id: 'smash-blue-cheese', name: 'Smash Blue Cheese', price: 37, orderId: 20, description: 'Pão brioche, smash burger de 110g, american cheese de gorgonzola, compota de pera defumada e mel picante.' },
    ],
  },
  {
    id: 'grelhado',
    label: 'Burger Grelhado',
    short: 'Grelhado',
    items: [
      { id: 'burger-cemita', name: 'Burger Cemita', price: 54, orderId: 25, tags: ['Leva o nome da casa'], description: 'Pão brioche, hambúrguer de 150g, catupiry, frango super crocante, bacon, geleia de pimenta e cheddar.' },
      { id: 'burger-bacon-supremo', name: 'Burger Bacon Supremo', price: 51, orderId: 21, description: 'Brioche macio, hambúrguer suculento com fatia obscena de bacon caramelizado, maionese da casa e muçarela derretida.' },
      { id: 'burger-bacon-duplo', name: 'Burger Bacon Duplo', price: 59, orderId: 22, description: 'Pão brioche, 2 hambúrgueres de 150g, bacon, cheddar e barbecue da casa.' },
      { id: 'burger-costela', name: 'Burger Costela', price: 51, orderId: 23, description: 'Pão brioche, hambúrguer de 150g, costela defumada desfiada, creme cheddar e barbecue da casa.' },
      { id: 'hot-bacon', name: 'Hot Bacon', price: 44, orderId: 24, description: 'Pão brioche, hambúrguer de 150g, catupiry, farofa de bacon, pimenta jalapeño e chipotle.' },
      { id: 'burger-egg', name: 'Burger Egg', price: 44, orderId: 26, description: 'Pão brioche, hambúrguer de 150g, american cheese de gorgonzola, bacon, ovo com gema mole, mel picante e barbecue da casa.' },
    ],
  },
  {
    id: 'bbq',
    label: 'American BBQ',
    short: 'BBQ',
    items: [
      { id: 'pork-ribs', name: 'Pork Ribs', price: 150, orderId: 12, description: 'Costelinha suína defumada ao molho barbecue da casa, farofinha, salada coleslaw, batata canoa e pão de alho.' },
      { id: 'beef-ribs', name: 'Beef Ribs', price: 170, orderId: 13, description: 'Costela bovina defumada, farofinha, salada coleslaw, batata canoa e pão de alho.' },
      { id: 'brisket', name: 'Brisket', price: 180, orderId: 14, description: 'O corte mais tradicional do churrasco americano, com farofinha, salada coleslaw, batata canoa e pão de alho.' },
    ],
  },
  {
    id: 'sanduiches',
    label: 'Sanduíches',
    items: [
      { id: 'sanduiche-costela', name: 'Sanduíche de Costela Defumada', price: 55, orderId: 28, description: 'Baguetinha de parmesão, costela desfiada e defumada, catupiry, maionese da casa e tomate defumado com chimichurri.' },
      { id: 'sanduiche-pulled-pork', name: 'Sanduíche de Pulled Pork', price: 39, orderId: 27, description: 'Baguetinha de parmesão, copa-lombo suíno, salada coleslaw e maionese da casa.' },
      { id: 'sanduiche-frango', name: 'Sanduíche de Frango Crocante', price: 36, orderId: 29, description: 'Baguetinha de parmesão, frango crocante marinado em cerveja Stannis Irish Red Ale, salada coleslaw e barbecue da casa.' },
      { id: 'choripan', name: 'Choripan', price: 40, orderId: 30, description: 'Baguetinha de parmesão, linguiça artesanal defumada, tomate defumado com chimichurri, parmesão ralado e mel picante.' },
    ],
  },
  {
    id: 'entradas',
    label: 'Entradas',
    items: [
      { id: 'croqueta-costela', name: 'Croqueta de Costela Defumada', price: 42, orderId: 6, description: '6 unidades de croqueta cremosa de costela defumada.' },
      { id: 'buffalo-wings', name: 'Buffalo Wings', price: 40, orderId: 3, description: '10 unidades de tulipa defumada ao molho barbecue da casa.' },
      { id: 'croqueta-pulled-pork', name: 'Croqueta de Pulled Pork', price: 35, orderId: 5, description: '6 unidades de croqueta cremosa de pulled pork.' },
      { id: 'panceta-crocante', name: 'Panceta Crocante', price: 35, orderId: 4, description: 'Panceta suína defumada crocante.' },
      { id: 'chick-n-chips', name: "Chick N' Chips", price: 45, orderId: 460 },
      { id: 'empanadinho-frango', name: 'Empanadinho de Frango', price: 25, orderId: 1, description: '10 unidades.' },
      { id: 'fritas-especiais', name: 'Fritas Especiais', price: 39, priceFrom: true, orderId: 8, description: 'Com tempero da casa, bacon e cheddar.' },
      { id: 'fritas', name: 'Fritas', price: 15, priceFrom: true, orderId: 10, description: 'Com tempero da casa. Individual.' },
    ],
  },
  {
    id: 'vegetariano',
    label: 'Vegetariano',
    short: 'Veg',
    items: [
      { id: 'burger-veg', name: 'Burger Veg', price: 36, orderId: 381, description: 'Pão brioche, hambúrguer do futuro, cheddar, maionese da casa e cebola caramelizada.' },
      { id: 'burger-salada-veg', name: 'Burger Salada Veg', price: 38, orderId: 380, description: 'Pão brioche, hambúrguer do futuro, cheddar, relish de pepino, cebola, alface americana, tomate e molho especial.' },
      { id: 'burger-invertido-veg', name: 'Burger Invertido Veg', price: 42, orderId: 379, description: 'Releitura do patty melt: pão brioche invertido, hambúrguer do futuro, cebola, molho especial e muito cheddar.' },
      // ⚠️ A CONFIRMAR: no delivery a descrição deste item é igual à do Burger Veg
      { id: 'burger-blue-cheese-veg', name: 'Burger Blue Cheese Veg', price: 45, orderId: 378, description: 'Pão brioche, hambúrguer do futuro, cheddar, maionese da casa e cebola caramelizada.' },
    ],
  },
  {
    id: 'sobremesas',
    label: 'Sobremesas',
    short: 'Doces',
    items: [{ id: 'pudim', name: 'Pudim', price: 15, orderId: 47, description: 'De leite condensado.', tags: ['Favorito'] }],
  },
  {
    id: 'cervejas',
    label: 'Cervejas & Chopp',
    short: 'Cervejas',
    note: 'Venda proibida para menores de 18 anos.',
    items: [
      { id: 'growler-vinho', name: 'Growler de Chopp de Vinho 1L', price: 45, orderId: 442, description: 'Chopp de vinho da cervejaria Zeit.', tags: ['+18'] },
      { id: 'growler-pilsen', name: 'Growler de Chopp Pilsen 1L', price: 40, orderId: 438, tags: ['+18'] },
      { id: 'stannis-ipa', name: 'IPA — Stannis', price: 21, orderId: 422, tags: ['+18'] },
      { id: 'stannis-blond', name: 'Belgian Blond Ale — Stannis', price: 17, orderId: 418, tags: ['+18'] },
      { id: 'stannis-apa', name: 'APA — Stannis', price: 15, orderId: 414, tags: ['+18'] },
      { id: 'stannis-weiss', name: 'Weiss — Stannis', price: 15, orderId: 410, tags: ['+18'] },
      { id: 'stannis-red', name: 'Red Ale — Stannis', price: 15, orderId: 406, tags: ['+18'] },
      { id: 'heineken', name: 'Heineken', price: 15, orderId: 434, tags: ['+18'] },
      // ✅ o delivery marca a Heineken Zero como +18 (print de 08/10/2026)
      { id: 'heineken-zero', name: 'Heineken Zero', price: 15, orderId: 430, tags: ['+18'] },
    ],
  },
  {
    id: 'bebidas',
    label: 'Bebidas',
    items: [
      { id: 'red-bull', name: 'Red Bull 250ml', price: 20, orderId: 449 },
      { id: 'monster', name: 'Monster 473ml', price: 15, priceFrom: true, orderId: 400, description: 'Lata 473ml.' },
      { id: 'suco-uva', name: 'Suco Del Valle de Uva', price: 15, orderId: 394 },
      { id: 'suco-laranja', name: 'Suco Integral de Laranja', price: 12, orderId: 395 },
      // ✅ visto no delivery em 08/10/2026 (sem id de produto conhecido: o botão leva ao delivery geral)
      { id: 'caldo-cana', name: 'Caldo de Cana', price: 15, description: 'Simmmm! Temos caldo de cana!' },
      { id: 'coca', name: 'Coca-Cola lata 310ml', price: 7, orderId: 386 },
      { id: 'coca-zero', name: 'Coca-Cola Zero lata 310ml', price: 7, orderId: 385 },
      { id: 'guarana', name: 'Guaraná Antarctica 350ml', price: 7, orderId: 389 },
      { id: 'guarana-zero', name: 'Guaraná Antarctica Zero 350ml', price: 7, orderId: 388 },
      { id: 'sprite', name: 'Sprite 350ml', price: 7, orderId: 390 },
      { id: 'sprite-zero', name: 'Sprite Zero 350ml', price: 7, orderId: 391 },
      { id: 'tonica', name: 'Água Tônica Schweppes 350ml', price: 7, orderId: 392 },
      { id: 'schweppes-citrus', name: 'Schweppes Citrus 350ml', price: 7, orderId: 393 },
      { id: 'agua', name: 'Água mineral sem gás', price: 5, orderId: 398 },
      { id: 'agua-gas', name: 'Água mineral com gás 500ml', price: 5, orderId: 397 },
    ],
  },
]

/**
 * Combos: o delivery oferece "Monte seu Combo" (smash, grelhado e sanduíche) por + R$ 15,99.
 * ✅ O combo leva fritas individual + uma bebida à escolha (prints de 08/10/2026). Detalhes em config/options.ts.
 */
export const COMBO_NOTE = 'Monte seu Combo (smash, burger grelhado ou sanduíche): fritas individual + bebida'
export const COMBO_PRICE = 15.99

/* ---------- Seleções usadas nas seções visuais ---------- */

const all = menu.flatMap((c) => c.items)
const catById: Record<string, string> = Object.fromEntries(menu.flatMap((c) => c.items.map((i) => [i.id, c.id])))
/** id da categoria de um item ("smash", "bbq"...) */
export const categoryOf = (id: string) => catById[id] ?? ''
export const findItem = (id: string) => {
  const item = all.find((i) => i.id === id)
  if (!item) throw new Error(`Item de cardápio não encontrado: ${id}`)
  return item
}

/** Seção BURGER — destaque visual (fotos grandes). */
export const featuredBurgers = [
  'smash-rib',
  'burger-bacon-supremo',
  'smash-blue-cheese',
  'hot-bacon',
  'smash-invertido',
  'burger-egg',
].map(findItem)

/**
 * ASSINATURAS / DESTAQUES (capítulo 05).
 * ⚠️ Não são "os mais vendidos": são destaques com foto real disponível.
 * Quando chegar a foto do Burger Cemita (cardapio/burger-cemita.webp), inclua 'burger-cemita' aqui.
 */
export const signatureItems = ['smash-rib', 'burger-bacon-supremo', 'smash-blue-cheese', 'buffalo-wings'].map(findItem)

/** Ingredientes exibidos ao redor do produto (vêm da descrição do cardápio). */
const CHIP_OVERRIDES: Record<string, string[]> = {
  'buffalo-wings': ['10 unidades', 'Tulipa defumada', 'Barbecue da casa'],
  'burger-bacon-supremo': ['Brioche macio', 'Hambúrguer suculento', 'Bacon caramelizado', 'Maionese da casa', 'Muçarela derretida'],
}
export const ingredientChips = (item: MenuItem): string[] => {
  if (CHIP_OVERRIDES[item.id]) return CHIP_OVERRIDES[item.id]
  return (item.description ?? '')
    .replace(/\.$/, '')
    .split(/,\s*|\s+e\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t[0].toUpperCase() + t.slice(1))
    .slice(0, 6)
}

export const bbqItems = menu.find((c) => c.id === 'bbq')!.items

/* ---------- Helpers ---------- */

export const formatPrice = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

export const orderLink = (item?: MenuItem) =>
  item?.orderId && restaurant.order.perItemLinks
    ? `${restaurant.order.url}/${item.orderId}`
    : restaurant.order.url
