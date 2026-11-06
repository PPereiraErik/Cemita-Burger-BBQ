/**
 * Regras que ligam o site à API (src/lib/liveCore.ts).
 * Rodar na raiz do projeto: npm test   (Node 22.18+ roda TypeScript direto)
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ApiCatalog, ApiStoreStatus } from '../src/lib/api.ts'
import { availabilityOf, comboPriceOf, hourLabel, indexCatalog, mapServerIssues, openNote, priceOf, toQuoteLines } from '../src/lib/liveCore.ts'

const product = (over: Record<string, unknown>) => ({
  id: 1,
  slug: 'smash-bacon',
  name: 'Smash Bacon',
  priceCents: 3500,
  priceFrom: false,
  orderable: true,
  available: true,
  isAdult: false,
  optionGroups: [],
  ...over,
})
const catalog = (products: ReturnType<typeof product>[]): ApiCatalog => ({ categories: [{ id: 1, slug: 'smash', name: 'Smash', products: products as ApiCatalog['categories'][0]['products'] }] })
const comboGroup = {
  id: 9,
  key: 'combo-bebida',
  name: 'Combo: fritas individual + bebida',
  minSelect: 0,
  maxSelect: 1,
  items: [
    { id: 77, name: 'Combo + Coca-Cola', priceDeltaCents: 1599, available: true },
    { id: 78, name: 'Combo + Sprite 350ml', priceDeltaCents: 1599, available: true },
  ],
}
const adicionais = { id: 10, key: 'adicional', name: 'Vai um adicional aí?', minSelect: 0, maxSelect: 4, items: [{ id: 101, name: 'Bacon', priceDeltaCents: 800, available: true }, { id: 102, name: 'Cheddar', priceDeltaCents: 800, available: true }] }
const ponto = { id: 11, key: 'ponto', name: 'Escolha o ponto da sua carne', minSelect: 1, maxSelect: 1, items: [{ id: 111, name: 'Vermelha por dentro', priceDeltaCents: 0, available: true }, { id: 112, name: 'Cinza por dentro', priceDeltaCents: 0, available: true }] }

describe('cardápio da API no site', () => {
  it('preço vem da API quando ela tem o item; senão fica o do site', () => {
    const index = indexCatalog(catalog([product({ priceCents: 3700 })]))
    assert.equal(priceOf('smash-bacon', 35, index), 37)
    assert.equal(priceOf('smash-rib', 39, index), 39)
    assert.equal(priceOf('smash-bacon', 35, null), 35)
  })

  it('sem API tudo segue disponível; com API, esgotado e fora do cardápio aparecem', () => {
    assert.equal(availabilityOf('smash-bacon', null), 'ok')
    const index = indexCatalog(catalog([product({}), product({ id: 2, slug: 'pudim', available: false })]))
    assert.equal(availabilityOf('smash-bacon', index), 'ok')
    assert.equal(availabilityOf('pudim', index), 'soldout')
    assert.equal(availabilityOf('item-desativado', index), 'off')
  })

  it('combo só existe quando o banco publica o grupo "combo-bebida"', () => {
    const sem = indexCatalog(catalog([product({})]))
    assert.equal(sem.get('smash-bacon')?.combo, null)
    assert.equal(comboPriceOf(sem, 15.99), 15.99)
    const com = indexCatalog(catalog([product({ optionGroups: [comboGroup] })]))
    assert.equal(com.get('smash-bacon')?.combo?.id, 77)
    assert.equal(comboPriceOf(com, 10), 15.99)
  })
})

describe('comanda → cotação no servidor', () => {
  const index = indexCatalog(catalog([product({}), product({ id: 2, slug: 'smash-rib', optionGroups: [comboGroup] })]))

  it('manda só id, quantidade, opção e observação (nunca preço)', () => {
    const r = toQuoteLines(
      [
        { key: 'a', id: 'smash-bacon', qty: 2, note: '  sem cebola ' },
        { key: 'b', id: 'smash-rib', qty: 1, combo: true, opts: ['bebida:coca'] },
      ],
      index,
    )
    assert.deepEqual(r.lines, [
      { productId: 1, quantity: 2, optionIds: [], note: 'sem cebola' },
      { productId: 2, quantity: 1, optionIds: [77] },
    ])
    assert.deepEqual(r.keys, ['a', 'b'])
    assert.deepEqual(r.problems, [])
    for (const l of r.lines) assert.ok(!Object.keys(l).some((k) => /price|total|cents/i.test(k)))
  })

  it('combo não publicado e item fora do catálogo viram aviso na linha, sem ir para o servidor', () => {
    const r = toQuoteLines(
      [
        { key: 'a', id: 'smash-bacon', qty: 1, combo: true },
        { key: 'b', id: 'nao-existe', qty: 1 },
        { key: 'c', id: 'smash-rib', qty: 3 },
      ],
      index,
    )
    assert.deepEqual(r.lines.map((l) => l.productId), [2])
    assert.deepEqual(r.keys, ['c'])
    assert.deepEqual(r.problems.map((p) => p.key), ['a', 'b'])
  })

  it('adicional não cadastrado no banco vira aviso na linha', () => {
    const r = toQuoteLines([{ key: 'a', id: 'smash-bacon', qty: 1, opts: ['adicional:bacon'] }], index)
    assert.deepEqual(r.lines, [])
    assert.equal(r.problems[0].message, 'Bacon ainda não está disponível no pedido pelo site.')
  })

  it('adicionais, ponto e combo com bebida viram os ids de opção do banco', () => {
    const idx = indexCatalog(
      catalog([
        product({ optionGroups: [comboGroup, adicionais] }),
        product({ id: 3, slug: 'burger-cemita', optionGroups: [comboGroup, ponto, adicionais] }),
      ]),
    )
    const r = toQuoteLines(
      [
        { key: 'a', id: 'smash-bacon', qty: 1, combo: true, opts: ['adicional:bacon', 'adicional:cheddar', 'bebida:sprite'] },
        { key: 'b', id: 'burger-cemita', qty: 2, opts: ['ponto:vermelha'] },
      ],
      idx,
    )
    assert.deepEqual(r.problems, [])
    assert.deepEqual(r.lines, [
      { productId: 1, quantity: 1, optionIds: [78, 101, 102] },
      { productId: 3, quantity: 2, optionIds: [111] },
    ])
  })

  it('combo sem bebida, ou com bebida que o banco não tem, vira aviso', () => {
    const r = toQuoteLines(
      [
        { key: 'a', id: 'smash-rib', qty: 1, combo: true },
        { key: 'b', id: 'smash-rib', qty: 1, combo: true, opts: ['bebida:guarana'] },
      ],
      index,
    )
    assert.deepEqual(r.lines, [])
    assert.deepEqual(r.problems.map((p) => p.message), ['Escolha a bebida do combo.', 'Combo com Guaraná Antarctica 350ml ainda não disponível no pedido pelo site.'])
  })

  it('erro do servidor volta para a linha certa da comanda', () => {
    const m = mapServerIssues(
      [
        { code: 'PRODUCT_UNAVAILABLE', message: 'Este item esgotou por hoje.', line: 1 },
        { code: 'BELOW_MINIMUM_ORDER', message: 'O pedido não atingiu o valor mínimo.' },
      ],
      ['a', 'c'],
    )
    assert.deepEqual(m.byLine, [{ key: 'c', message: 'Este item esgotou por hoje.' }])
    assert.deepEqual(m.general, ['O pedido não atingiu o valor mínimo.'])
  })
})

describe('frase do "aberto agora" a partir do horário do banco', () => {
  // terça a domingo, 18h às 23h (o que o seed grava hoje)
  const hours = [2, 3, 4, 5, 6, 0].map((weekday) => ({ weekday, opensAt: '18:00', closesAt: '23:00' }))
  const st = (open: boolean): Pick<ApiStoreStatus, 'open' | 'hours' | 'timezone'> => ({ open, hours, timezone: 'America/Sao_Paulo' })
  // horários em UTC; São Paulo = UTC-3
  const at = (iso: string) => new Date(iso)

  it('mesmas frases do site de hoje', () => {
    assert.equal(openNote(st(true), at('2026-10-07T23:00:00Z')), 'até as 23h') // quarta 20h
    assert.equal(openNote(st(false), at('2026-10-07T15:00:00Z')), 'abre hoje às 18h') // quarta 12h
    assert.equal(openNote(st(false), at('2026-10-08T02:30:00Z')), 'abre amanhã às 18h') // quarta 23h30
    assert.equal(openNote(st(false), at('2026-10-05T15:00:00Z')), 'segunda é folga · volta terça, 18h') // segunda
    assert.equal(openNote(st(false), at('2026-10-12T02:30:00Z')), 'volta terça, 18h') // domingo 23h30
  })

  it('não depende do fuso do aparelho e entende meia hora e virada da meia-noite', () => {
    assert.equal(hourLabel('18:30'), '18h30')
    const late = { open: true, timezone: 'America/Sao_Paulo', hours: [{ weekday: 5, opensAt: '18:00', closesAt: '01:30' }] }
    assert.equal(openNote(late, at('2026-10-10T04:00:00Z')), 'até as 1h30') // sábado 1h, ainda no turno de sexta
  })
})
