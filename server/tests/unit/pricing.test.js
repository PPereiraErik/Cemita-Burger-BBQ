import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { couponDiscount, findZone, priceCart } from '../../src/domain/pricing.js'

const group = { id: 10, name: 'Adicionais', minSelect: 0, maxSelect: 2, active: true, items: [
  { id: 101, name: 'Extra A', priceDeltaCents: 500, active: true, available: true },
  { id: 102, name: 'Extra B', priceDeltaCents: 300, active: true, available: false },
  { id: 103, name: 'Extra C', priceDeltaCents: 200, active: true, available: true },
] }
const products = new Map([
  [1, { id: 1, name: 'Smash Bacon', priceCents: 3500, active: true, available: true, orderable: true, isAdult: false, groups: [group] }],
  [2, { id: 2, name: 'Fritas', priceCents: 1500, active: true, available: true, orderable: false, isAdult: false, groups: [] }],
  [3, { id: 3, name: 'Brisket', priceCents: 18000, active: true, available: false, orderable: true, isAdult: false, groups: [] }],
  [4, { id: 4, name: 'IPA', priceCents: 2100, active: true, available: true, orderable: true, isAdult: true, groups: [] }],
  [5, { id: 5, name: 'Antigo', priceCents: 1000, active: false, available: true, orderable: true, isAdult: false, groups: [] }],
])
const data = { products, zones: [], coupon: null, minOrderCents: null }
const pickup = (lines, extra = {}) => ({ lines, fulfillment: 'pickup', ...extra })
const codes = (r) => r.errors.map((e) => e.code)

describe('cálculo do pedido (só com dados do banco)', () => {
  it('2 × Smash Bacon = R$ 70,00', () => {
    const r = priceCart(pickup([{ productId: 1, quantity: 2 }]), data)
    assert.equal(r.ok, true)
    assert.equal(r.subtotalCents, 7000)
    assert.equal(r.totalCents, 7000)
  })
  it('opção soma ao preço da unidade', () => {
    const r = priceCart(pickup([{ productId: 1, quantity: 2, optionIds: [101, 103] }]), data)
    assert.equal(r.lines[0].unitPriceCents, 4200)
    assert.equal(r.totalCents, 8400)
  })
  it('produto inexistente, inativo, esgotado ou não pedível pelo site é recusado', () => {
    assert.deepEqual(codes(priceCart(pickup([{ productId: 999, quantity: 1 }]), data)), ['PRODUCT_NOT_FOUND'])
    assert.deepEqual(codes(priceCart(pickup([{ productId: 5, quantity: 1 }]), data)), ['PRODUCT_NOT_FOUND'])
    assert.deepEqual(codes(priceCart(pickup([{ productId: 3, quantity: 1 }]), data)), ['PRODUCT_UNAVAILABLE'])
    assert.deepEqual(codes(priceCart(pickup([{ productId: 2, quantity: 1 }]), data)), ['PRODUCT_NOT_ORDERABLE'])
  })
  it('opção de outro produto, esgotada ou acima do máximo é recusada', () => {
    assert.ok(codes(priceCart(pickup([{ productId: 4, quantity: 1, optionIds: [101] }]), data)).includes('OPTION_NOT_ALLOWED'))
    assert.ok(codes(priceCart(pickup([{ productId: 1, quantity: 1, optionIds: [102] }]), data)).includes('OPTION_UNAVAILABLE'))
    const tooMany = { ...data, products: new Map([[1, { ...products.get(1), groups: [{ ...group, maxSelect: 1 }] }]]) }
    assert.ok(codes(priceCart(pickup([{ productId: 1, quantity: 1, optionIds: [101, 103] }]), tooMany)).includes('OPTION_SELECTION_INVALID'))
  })
  it('avisa quando há bebida alcoólica', () => {
    assert.equal(priceCart(pickup([{ productId: 4, quantity: 1 }]), data).hasAdultItems, true)
  })
  it('entrega sem zona cadastrada não é aceita (nada de taxa inventada)', () => {
    const r = priceCart({ lines: [{ productId: 1, quantity: 1 }], fulfillment: 'delivery', address: { neighborhood: 'Centro' } }, data)
    assert.deepEqual(codes(r), ['DELIVERY_UNAVAILABLE'])
  })
  it('entrega com zona soma a taxa e respeita o pedido mínimo da zona', () => {
    const zones = [{ id: 1, name: 'Zona X', matchType: 'neighborhood', neighborhoods: ['São Marcos'], feeCents: 700, minOrderCents: 4000, etaMinMinutes: 30, etaMaxMinutes: 45 }]
    const ok = priceCart({ lines: [{ productId: 1, quantity: 2 }], fulfillment: 'delivery', address: { neighborhood: 'sao  marcos' } }, { ...data, zones })
    assert.equal(ok.deliveryFeeCents, 700)
    assert.equal(ok.totalCents, 7700)
    const low = priceCart({ lines: [{ productId: 1, quantity: 1 }], fulfillment: 'delivery', address: { neighborhood: 'São Marcos' } }, { ...data, zones })
    assert.deepEqual(codes(low), ['BELOW_MINIMUM_ORDER'])
  })
  it('zona por faixa de CEP', () => {
    const zones = [{ id: 2, name: 'Faixa', matchType: 'cep_range', cepStart: '89200000', cepEnd: '89209999', feeCents: 500 }]
    assert.equal(findZone(zones, { cep: '89201234' })?.id, 2)
    assert.equal(findZone(zones, { cep: '89210000' }), null)
  })
})

describe('cupom', () => {
  const now = new Date('2026-10-07T23:00:00Z')
  const c = { id: 1, code: 'X', type: 'percent', value: 10, minSubtotalCents: 0, startsAt: null, endsAt: null, maxUses: null, usedCount: 0, active: true }
  it('percentual arredonda para baixo e nunca passa do subtotal', () => {
    assert.equal(couponDiscount(c, 3333, now).discountCents, 333)
    assert.equal(couponDiscount({ ...c, type: 'fixed', value: 99999 }, 3000, now).discountCents, 3000)
  })
  it('recusa inativo, vencido, esgotado ou abaixo do mínimo', () => {
    assert.equal(couponDiscount({ ...c, active: false }, 1000, now).error, 'COUPON_INVALID')
    assert.equal(couponDiscount({ ...c, endsAt: '2026-10-01T00:00:00Z' }, 1000, now).error, 'COUPON_EXPIRED')
    assert.equal(couponDiscount({ ...c, maxUses: 1, usedCount: 1 }, 1000, now).error, 'COUPON_EXHAUSTED')
    assert.equal(couponDiscount({ ...c, minSubtotalCents: 5000 }, 1000, now).error, 'COUPON_MINIMUM_NOT_REACHED')
    assert.equal(couponDiscount(null, 1000, now).error, 'COUPON_INVALID')
  })
})
