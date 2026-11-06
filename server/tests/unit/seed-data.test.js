import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildCategoryRows, buildComboRows, buildHoursRows, buildOptionRows, buildProductRows, COMBO_CATEGORY_SLUGS, COMBO_DRINK_GROUP_KEY, DEFAULT_SETTINGS } from '../../src/db/seeders/catalog.js'
import { loadCatalog } from '../../src/db/seeders/index.js'

const catalog = loadCatalog()
const ids = Object.fromEntries(catalog.categories.map((c, i) => [c.slug, i + 1]))
const products = buildProductRows(catalog, ids)

describe('dados iniciais: cardápio atual', () => {
  it('traz as 9 categorias e os 56 produtos do site, sem slug repetido', () => {
    assert.equal(buildCategoryRows(catalog).length, 9)
    assert.equal(products.length, 56)
    assert.equal(new Set(products.map((p) => p.slug)).size, 56)
  })

  it('preços em centavos inteiros, iguais ao cardápio (amostra conferida)', () => {
    const price = (slug) => products.find((p) => p.slug === slug).price_cents
    for (const p of products) assert.ok(Number.isSafeInteger(p.price_cents) && p.price_cents >= 0, p.slug)
    assert.equal(price('smash-rib'), 3900)
    assert.equal(price('smash-bacon'), 3500)
    assert.equal(price('brisket'), 18000)
    assert.equal(price('agua'), 500)
  })

  it('itens "a partir de" não podem ser pedidos pelo site até as opções existirem', () => {
    const fromItems = products.filter((p) => p.price_from).map((p) => p.slug).sort()
    assert.deepEqual(fromItems, ['fritas', 'fritas-especiais', 'monster'])
    for (const p of products) assert.equal(p.orderable, !p.price_from, p.slug)
  })

  it('marca +18 só nas cervejas e chopps (a Heineken Zero também, como no delivery)', () => {
    const adult = products.filter((p) => p.is_adult).map((p) => p.slug)
    assert.equal(adult.length, 9)
    assert.ok(adult.includes('heineken-zero'))
    assert.ok(!adult.includes('caldo-cana') && !adult.includes('coca'))
  })

  it('guarda o id do delivery VUCA para a transição (quando o produto tem um)', () => {
    const without = products.filter((p) => !Number.isInteger(p.vuca_ref)).map((p) => p.slug)
    assert.deepEqual(without, ['caldo-cana'])
  })

  it('combo entra inativo e pendente de revisão, ligado só a smash, burgers e sanduíches', () => {
    const combo = buildComboRows(catalog)
    assert.equal(combo.group.active, false)
    assert.equal(combo.group.pending_review, true)
    assert.equal(combo.item.active, false)
    assert.equal(combo.item.pending_review, true)
    assert.equal(combo.item.price_delta_cents, 1599)
    const expected = catalog.categories.filter((c) => COMBO_CATEGORY_SLUGS.includes(c.slug)).reduce((n, c) => n + c.products.length, 0)
    assert.equal(combo.productSlugs.length, expected)
    assert.equal(expected, 16)
  })
})

describe('dados iniciais: adicionais e combo com bebida', () => {
  const { groups, links } = buildOptionRows(catalog)
  const g = (key) => groups.find((x) => x.row.key === key)
  const link = (key) => links.find((l) => l.groupKey === key)

  it('cria os grupos do delivery com nomes e preços em centavos', () => {
    assert.deepEqual(groups.map((x) => x.row.key).sort(), ['acompanhamento', 'adicional', 'carne-grelhado', 'carne-smash', 'carne-vegana', COMBO_DRINK_GROUP_KEY, 'fritas', 'molho', 'ponto', 'sobremesa'].sort())
    assert.equal(g('adicional').items.find((i) => i.name === 'Bacon').price_delta_cents, 800)
    assert.equal(g('adicional').row.max_select, 4)
    for (const x of groups) for (const i of x.items) assert.ok(Number.isSafeInteger(i.price_delta_cents) && i.price_delta_cents >= 0)
  })

  it('ponto da carne é obrigatório (1 escolha) e só nos burgers grelhados', () => {
    assert.equal(g('ponto').row.min_select, 1)
    assert.equal(g('ponto').row.max_select, 1)
    assert.deepEqual(link('ponto').productSlugs, catalog.categories.find((c) => c.slug === 'grelhado').products.map((p) => p.slug))
  })

  it('combo: uma opção por bebida, ao preço do combo, em smash, grelhados e sanduíches', () => {
    const combo = g(COMBO_DRINK_GROUP_KEY)
    assert.equal(combo.items.length, catalog.combo.drinks.length)
    assert.ok(combo.items.every((i) => i.price_delta_cents === 1599 && i.name.startsWith('Combo + ')))
    assert.equal(combo.row.min_select, 0)
    assert.equal(link(COMBO_DRINK_GROUP_KEY).productSlugs.length, 16)
  })

  it('tudo nasce ativo (já é o que o site oferece) e com nomes que cabem no banco', () => {
    for (const x of groups) {
      assert.equal(x.row.active, true)
      assert.equal(x.row.pending_review, false)
      assert.ok(x.row.name.length <= 80)
      for (const i of x.items) assert.ok(i.name.length <= 80)
    }
  })
})

describe('dados iniciais: horário e configurações', () => {
  it('converte "Terça a domingo · 18h às 23h" e deixa a segunda fechada', () => {
    const rows = buildHoursRows(catalog.hours)
    assert.deepEqual(
      rows.map((r) => r.weekday),
      [0, 2, 3, 4, 5, 6],
    )
    assert.ok(rows.every((r) => r.opens_at === '18:00:00' && r.closes_at === '23:00:00'))
  })

  it('recusa horário em formato desconhecido em vez de adivinhar', () => {
    assert.throws(() => buildHoursRows([{ days: 'Fim de semana', time: '18h às 23h' }]))
    assert.throws(() => buildHoursRows([{ days: 'Terça', time: 'à noite' }]))
  })

  it('o que depende da Cemita nasce pendente (null), nunca com valor inventado', () => {
    const v = Object.fromEntries(DEFAULT_SETTINGS.map((s) => [s.key, s.value]))
    for (const key of ['pickup_eta_minutes', 'min_order_cents', 'payment_timeout_minutes', 'data_retention_days']) assert.equal(v[key], null, key)
    assert.equal(v.ordering_mode, 'vuca')
    assert.deepEqual(v.payment_methods_enabled, ['cash_on_delivery', 'card_on_delivery'])
  })
})
