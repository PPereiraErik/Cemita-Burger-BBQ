import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canonicalJson, newPublicCode, sameHash, sha256, trackingToken } from '../../src/utils/ids.js'
import { orderSchema, quoteSchema } from '../../src/validators/cart.js'
import { brPhone, publicCode } from '../../src/validators/common.js'

const line = { productId: 1, quantity: 1 }
const order = {
  lines: [line],
  fulfillment: 'pickup',
  customer: { name: 'Erik', phone: '(47) 99683-8894' },
  paymentMethod: 'cash_on_delivery',
  privacyPolicyVersionId: 1,
}

describe('entrada da comanda e do pedido', () => {
  it('recusa qualquer campo de preço enviado pelo cliente', () => {
    assert.equal(quoteSchema.safeParse({ lines: [{ ...line, priceCents: 1 }], fulfillment: 'pickup' }).success, false)
    assert.equal(orderSchema.safeParse({ ...order, totalCents: 1 }).success, false)
  })
  it('recusa quantidade 0, negativa, fracionada ou acima de 20, e comanda vazia', () => {
    for (const quantity of [0, -1, 2.5, 21, 999, '2']) assert.equal(quoteSchema.safeParse({ lines: [{ productId: 1, quantity }], fulfillment: 'pickup' }).success, false, String(quantity))
    assert.equal(quoteSchema.safeParse({ lines: [], fulfillment: 'pickup' }).success, false)
  })
  it('entrega exige endereço; retirada não aceita endereço', () => {
    assert.equal(orderSchema.safeParse({ ...order, fulfillment: 'delivery' }).success, false)
    const address = { cep: '89203-001', street: 'Rua X', number: '10', neighborhood: 'Centro' }
    assert.equal(orderSchema.safeParse({ ...order, fulfillment: 'delivery', address }).success, true)
    assert.equal(orderSchema.safeParse({ ...order, address }).success, false)
  })
  it('limpa caracteres de controle e espaços do texto livre', () => {
    const r = orderSchema.parse({ ...order, notes: '  sem\u0000 cebola \n por favor ' })
    assert.equal(r.notes, 'sem cebola por favor')
  })
})

describe('telefone', () => {
  it('normaliza celular e fixo com DDD, aceitando +55', () => {
    assert.deepEqual(brPhone.parse('+55 (47) 99683-8894'), { normalized: '47996838894', display: '(47) 99683-8894' })
    assert.deepEqual(brPhone.parse('4733334444'), { normalized: '4733334444', display: '(47) 3333-4444' })
  })
  it('recusa sem DDD ou com tamanho errado', () => {
    for (const p of ['99683-8894', '123', '0479968388940', '47 8968 38894']) assert.equal(brPhone.safeParse(p).success, false, p)
  })
})

describe('códigos e tokens', () => {
  it('código público no formato CEM-XXXXXX, sem letras ambíguas', () => {
    for (let i = 0; i < 200; i++) assert.equal(publicCode.safeParse(newPublicCode()).success, true)
  })
  it('token de acompanhamento é estável para o mesmo pedido e diferente entre pedidos', () => {
    const a = trackingToken('s'.repeat(32), 'CEM-AAAAAA', 'k'.repeat(20))
    assert.equal(a, trackingToken('s'.repeat(32), 'CEM-AAAAAA', 'k'.repeat(20)))
    assert.notEqual(a, trackingToken('s'.repeat(32), 'CEM-BBBBBB', 'k'.repeat(20)))
    assert.ok(sameHash(sha256(a), sha256(a)))
    assert.ok(!sameHash(sha256(a), sha256('outro')))
  })
  it('o mesmo pedido gera o mesmo hash, com chaves em qualquer ordem', () => {
    assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }))
  })
})
