/** Adicionais, molhos e combo (src/config/options.ts). */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { COMBO_DRINKS, GROUPS, GROUPS_BY_CATEGORY, findOption, groupsFor, optionsLabel, optionsPrice } from '../src/config/options.ts'

describe('adicionais e combo', () => {
  it('preços conferidos nos prints do delivery', () => {
    assert.equal(findOption('adicional:gorgonzola')?.price, 12)
    assert.equal(findOption('adicional:bacon')?.price, 8)
    assert.equal(findOption('molho:maionese-especial')?.price, 6)
    assert.equal(findOption('acompanhamento:pao-de-alho')?.price, 20)
    assert.equal(findOption('carne-smash:110g')?.price, 10)
    assert.equal(findOption('carne-grelhado:150g')?.price, 15)
  })

  it('soma só inteiros conhecidos e ignora ids antigos', () => {
    assert.equal(optionsPrice(['adicional:bacon', 'adicional:cheddar', 'molho:chipotle']), 24)
    assert.equal(optionsPrice(['nao-existe']), 0)
    assert.equal(optionsPrice(), 0)
  })

  it('texto da comanda e da mensagem do WhatsApp', () => {
    assert.equal(optionsLabel(['ponto:vermelha', 'adicional:bacon', 'bebida:coca']), 'ponto: vermelha por dentro · + Bacon · bebida: Coca-Cola')
  })

  it('ponto da carne e bebida do combo são obrigatórios; limites do delivery', () => {
    assert.equal(GROUPS.ponto.required, true)
    assert.equal(COMBO_DRINKS.required, true)
    assert.equal(GROUPS.adicionais.max, 4)
    assert.equal(GROUPS.molhos.max, 3)
    assert.ok(!COMBO_DRINKS.options.some((o) => /fanta/i.test(o.name)), 'bebida de evento não entra')
  })

  it('cada categoria diz de onde veio a regra (visto ou inferido)', () => {
    for (const a of Object.values(GROUPS_BY_CATEGORY)) assert.ok(a.source === 'visto' || a.source === 'inferido')
    assert.deepEqual(groupsFor('bebidas'), [])
    assert.equal(groupsFor('grelhado')[0].id, 'ponto')
  })
})
