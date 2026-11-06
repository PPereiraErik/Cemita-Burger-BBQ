/** Cardápio de lápides: busca e agrupamento (src/lib/cardapio.ts) e a troca das polaroids (src/lib/rotacao.ts). */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { lapides, normalize, resumo } from '../src/lib/cardapio.ts'
import { avancar, inicio } from '../src/lib/rotacao.ts'

const menu = [
  { id: 'smash', label: 'Smash', items: [
    { id: 'smash-rib', name: 'Smash Rib', price: 39, description: 'Brioche, costela defumada desfiada, catupiry e cebola crua.' },
    { id: 'smash-bacon', name: 'Smash Bacon', price: 35, description: 'Pão brioche, bacon, cheddar e maionese da casa.' },
  ] },
  { id: 'bbq', label: 'American BBQ', items: [{ id: 'brisket', name: 'Brisket', price: 180, description: 'O corte mais tradicional.' }] },
  { id: 'bebidas', label: 'Bebidas', items: [{ id: 'agua', name: 'Água mineral', price: 5 }] },
]
const order = ['smash', 'bbq', 'bebidas']
const titles = { smash: 'Smash', bbq: 'BBQ defumado', bebidas: 'Bebidas' }

describe('cardápio de lápides', () => {
  it('sem busca: só a categoria escolhida, com os 3 modelos de pedra alternados', () => {
    const r = lapides(menu, order, titles, 'smash', '')
    assert.deepEqual(r.map((l) => l.item.id), ['smash-rib', 'smash-bacon'])
    assert.deepEqual(r.map((l) => l.variant), [0, 1])
  })
  it('busca ignora acento e maiúscula e procura em todas as categorias', () => {
    assert.deepEqual(lapides(menu, order, titles, 'smash', 'AGUA').map((l) => l.item.id), ['agua'])
    assert.deepEqual(lapides(menu, order, titles, 'bbq', 'água').map((l) => l.item.id), ['agua'])
  })
  it('busca por ingrediente e por categoria', () => {
    assert.deepEqual(lapides(menu, order, titles, 'bbq', 'catupiry').map((l) => l.item.id), ['smash-rib'])
    assert.deepEqual(lapides(menu, order, titles, 'smash', 'defumado').map((l) => l.item.id), ['brisket'])
    assert.deepEqual(lapides(menu, order, titles, 'smash', 'defum').map((l) => l.item.id), ['smash-rib', 'brisket'])
  })
  it('vários termos: todos precisam aparecer, em qualquer ordem', () => {
    assert.deepEqual(lapides(menu, order, titles, 'smash', 'cheddar bacon').map((l) => l.item.id), ['smash-bacon'])
    assert.deepEqual(lapides(menu, order, titles, 'smash', 'bacon catupiry'), [])
  })
  it('normaliza espaços e acentos', () => {
    assert.equal(normalize('  Pão   BRIOCHE '), 'pao brioche')
  })
  it('linha de resumo', () => {
    assert.equal(resumo('smash', titles, '', 6), 'SMASH · 6 ITENS · TOQUE NA LÁPIDE PARA VER OS INGREDIENTES')
    assert.equal(resumo('smash', titles, ' bacon ', 1), '1 ITEM PARA “BACON”')
  })
})

describe('polaroids que trocam', () => {
  it('troca uma moldura por vez, em ordem, sem repetir foto visível', () => {
    let r = inicio(3, 7)
    assert.deepEqual(r.slots, [0, 1, 2])
    const seen = []
    for (let i = 0; i < 20; i++) {
      const prev = r.slots
      r = avancar(r, 7)
      const changed = r.slots.filter((v, k) => v !== prev[k]).length
      assert.equal(changed, 1)
      assert.equal(new Set(r.slots).size, 3)
      seen.push(r.slots.slice())
    }
    assert.deepEqual(seen[0], [3, 1, 2])
    assert.deepEqual(seen[1], [3, 4, 2])
  })
  it('acervo menor ou igual às molduras: nada troca', () => {
    const r = inicio(5, 3)
    assert.deepEqual(r.slots, [0, 1, 2])
    assert.deepEqual(avancar(r, 3), r)
  })
})
