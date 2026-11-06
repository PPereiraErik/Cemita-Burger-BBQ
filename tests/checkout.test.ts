/** Regras do formulário de pedido (src/lib/checkout.ts). */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EMPTY_FORM,
  isOnlineMethod,
  paymentStage,
  safeCheckoutUrl,
  fieldErrorsFromServer,
  formatCep,
  formatPhone,
  newIdempotencyKey,
  parseMoney,
  quoteAddress,
  storeBlocker,
  toOrderBody,
  validPhone,
  validateForm,
  type CheckoutForm,
} from '../src/lib/checkout.ts'

const ctx = { totalCents: 7000, hasAdultItems: false, paymentMethods: ['cash_on_delivery', 'card_on_delivery'], deliveryAvailable: true }
const ok: CheckoutForm = { ...EMPTY_FORM, name: 'Ana', phone: '(47) 99999-0000', paymentMethod: 'cash_on_delivery', privacyAccepted: true }
const lines = [{ productId: 1, quantity: 2, optionIds: [] }]

describe('formulário de pedido', () => {
  it('dinheiro digitado de vários jeitos vira centavos', () => {
    assert.equal(parseMoney('100'), 10000)
    assert.equal(parseMoney('100,5'), 10050)
    assert.equal(parseMoney('R$ 1.234,56'), 123456)
    assert.equal(parseMoney('50.00'), 5000)
    assert.equal(parseMoney(''), null)
    assert.equal(parseMoney('abc'), null)
  })

  it('telefone com DDD, fixo ou celular, com ou sem +55; máscara enquanto digita', () => {
    assert.ok(validPhone('(47) 99683-8894'))
    assert.ok(validPhone('+55 47 3422-0000'))
    assert.ok(!validPhone('99683-8894'))
    assert.equal(formatPhone('47996838894'), '(47) 99683-8894')
    assert.equal(formatPhone('4734220000'), '(47) 3422-0000')
    assert.equal(formatCep('89203001'), '89203-001')
  })

  it('retirada só pede nome, telefone, pagamento e o aceite da política', () => {
    assert.deepEqual(validateForm(ok, ctx), {})
    const e = validateForm(EMPTY_FORM, ctx)
    assert.deepEqual(Object.keys(e).sort(), ['name', 'paymentMethod', 'phone', 'privacyAccepted'])
  })

  it('entrega exige endereço; sem entrega disponível, avisa', () => {
    const e = validateForm({ ...ok, fulfillment: 'delivery' }, ctx)
    assert.deepEqual(Object.keys(e).sort(), ['cep', 'neighborhood', 'number', 'street'])
    const off = validateForm({ ...ok, fulfillment: 'delivery', cep: '89203-001', street: 'Rua A', number: '1', neighborhood: 'Centro' }, { ...ctx, deliveryAvailable: false })
    assert.ok(off.fulfillment)
  })

  it('troco só em dinheiro e nunca menor que o total; +18 precisa de confirmação', () => {
    assert.ok(validateForm({ ...ok, needsChange: true, changeFor: '50' }, ctx).changeFor)
    assert.deepEqual(validateForm({ ...ok, needsChange: true, changeFor: '100' }, ctx), {})
    assert.ok(validateForm(ok, { ...ctx, hasAdultItems: true }).adultConfirmed)
    assert.ok(validateForm({ ...ok, paymentMethod: 'pix' }, ctx).paymentMethod)
  })

  it('o corpo do pedido não leva nenhum preço e só leva o que se aplica', () => {
    const pickup = toOrderBody({ ...ok, notes: '  ', complement: 'x' }, lines, 3, false)
    assert.deepEqual(pickup, { lines, fulfillment: 'pickup', customer: { name: 'Ana', phone: '(47) 99999-0000' }, paymentMethod: 'cash_on_delivery', privacyPolicyVersionId: 3 })
    const delivery = toOrderBody(
      { ...ok, fulfillment: 'delivery', cep: '89203-001', street: ' Rua A ', number: '10', neighborhood: 'Centro', needsChange: true, changeFor: '100,00', adultConfirmed: true },
      lines,
      3,
      true,
    )
    assert.deepEqual(delivery.address, { cep: '89203001', street: 'Rua A', number: '10', neighborhood: 'Centro' })
    assert.equal(delivery.changeForCents, 10000)
    assert.equal(delivery.adultConfirmed, true)
    const json = JSON.stringify(delivery)
    assert.ok(!/price|total|fee|discount/i.test(json.replace('changeForCents', '')))
  })

  it('cotação da entrega manda só CEP completo e bairro', () => {
    assert.equal(quoteAddress(ok), undefined)
    assert.deepEqual(quoteAddress({ ...ok, fulfillment: 'delivery', cep: '89203', neighborhood: 'Centro' }), { neighborhood: 'Centro' })
    assert.deepEqual(quoteAddress({ ...ok, fulfillment: 'delivery', cep: '89203-001', neighborhood: '' }), { cep: '89203001' })
  })

  it('erros do servidor voltam para o campo certo; loja fechada vira frase', () => {
    assert.deepEqual(fieldErrorsFromServer([{ path: 'customer.phone', message: 'x' }, { path: 'address.cep', message: 'y' }]), { phone: 'Confira este campo.', cep: 'Confira este campo.' })
    assert.equal(storeBlocker({ acceptsOrders: true, reasons: [] }), null)
    assert.match(storeBlocker({ acceptsOrders: false, reasons: ['STORE_CLOSED'] }) ?? '', /fechados/)
    assert.ok(storeBlocker(null))
  })

  it('chave de idempotência aceita pelo servidor (16 a 64, letras, números, - e _)', () => {
    const k = newIdempotencyKey()
    assert.match(k, /^[A-Za-z0-9_-]{16,64}$/)
    assert.notEqual(k, newIdempotencyKey())
  })
})

describe('pagamento online (Pix/cartão no site)', () => {
  it('só redireciona para link https do Mercado Pago', () => {
    assert.equal(safeCheckoutUrl('https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1'), 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1')
    assert.equal(safeCheckoutUrl('https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=1'), 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=1')
    assert.equal(safeCheckoutUrl('http://www.mercadopago.com.br/x'), null)
    assert.equal(safeCheckoutUrl('https://mercadopago.com.br.golpe.com/x'), null)
    assert.equal(safeCheckoutUrl('https://golpe-mercadopago.com.br/x'), null)
    assert.equal(safeCheckoutUrl('javascript:alert(1)'), null)
    assert.equal(safeCheckoutUrl(null), null)
  })

  it('situação do pagamento no acompanhamento', () => {
    const o = (status: string, p: { online: boolean; status: string } | null) => paymentStage({ status, payment: p })
    assert.equal(o('awaiting_payment', { online: true, status: 'pending' }), 'pay')
    assert.equal(o('pending', { online: true, status: 'pending' }), 'pay')
    assert.equal(o('awaiting_payment', { online: true, status: 'declined' }), 'declined')
    assert.equal(o('received', { online: true, status: 'approved' }), 'paid')
    assert.equal(o('awaiting_payment', { online: true, status: 'in_review' }), 'review')
    assert.equal(o('cancelled', { online: true, status: 'cancelled' }), null)
    assert.equal(o('received', { online: false, status: 'pending' }), null)
    assert.equal(o('received', null), null)
  })

  it('Pix e cartão no site são formas online; dinheiro e maquininha não', () => {
    assert.ok(isOnlineMethod('pix') && isOnlineMethod('card_online'))
    assert.ok(!isOnlineMethod('cash_on_delivery') && !isOnlineMethod('card_on_delivery'))
  })
})
