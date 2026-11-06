import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canTransition, customerCanCancel, STATUS_LABEL, TRANSITIONS } from '../../src/domain/orderStatus.js'
import { isOpenAt } from '../../src/domain/storeHours.js'

const order = (status, extra = {}) => ({ status, fulfillment: 'delivery', paymentMethod: 'pix', ...extra })

describe('status do pedido', () => {
  it('segue o fluxo normal da entrega', () => {
    assert.ok(canTransition(order('received'), 'preparing'))
    assert.ok(canTransition(order('preparing'), 'ready'))
    assert.ok(canTransition(order('ready'), 'out_for_delivery'))
    assert.ok(canTransition(order('out_for_delivery'), 'completed'))
  })
  it('retirada finaliza direto do "pronto" e nunca "sai para entrega"', () => {
    assert.ok(canTransition(order('ready', { fulfillment: 'pickup' }), 'completed'))
    assert.ok(!canTransition(order('ready', { fulfillment: 'pickup' }), 'out_for_delivery'))
    assert.ok(!canTransition(order('ready', { fulfillment: 'delivery' }), 'completed'))
  })
  it('recusa voltar atrás e mexer em pedido finalizado ou cancelado', () => {
    assert.ok(!canTransition(order('completed'), 'preparing'))
    assert.ok(!canTransition(order('cancelled'), 'received'))
    assert.ok(!canTransition(order('completed'), 'cancelled'))
    assert.ok(!canTransition(order('preparing'), 'received'))
  })
  it('pedido sem pagamento online não pula para a cozinha sem passar pelo pagamento', () => {
    assert.ok(!canTransition(order('awaiting_payment'), 'received'))
    assert.ok(!canTransition(order('awaiting_payment'), 'preparing'))
  })
  it('cliente só cancela antes do preparo', () => {
    assert.ok(customerCanCancel(order('pending')))
    assert.ok(customerCanCancel(order('awaiting_payment')))
    assert.ok(customerCanCancel(order('received', { paymentMethod: 'cash_on_delivery' })))
    assert.ok(!customerCanCancel(order('received', { paymentMethod: 'pix' })))
    assert.ok(!customerCanCancel(order('preparing', { paymentMethod: 'cash_on_delivery' })))
  })
  it('todo status tem rótulo com símbolo e palavra (não depende de cor)', () => {
    for (const s of Object.keys(TRANSITIONS)) assert.match(STATUS_LABEL[s], /^\S+ \p{L}/u, s)
  })
})

describe('horário da loja (fuso de São Paulo)', () => {
  const hours = [2, 3, 4, 5, 6, 0].map((weekday) => ({ weekday, opensAt: '18:00:00', closesAt: '23:00:00' }))
  const tz = 'America/Sao_Paulo'
  it('aberta numa quarta às 20h e fechada às 23h em ponto', () => {
    assert.equal(isOpenAt(new Date('2026-10-07T23:00:00Z'), hours, tz), true) // 20:00 local
    assert.equal(isOpenAt(new Date('2026-10-08T02:00:00Z'), hours, tz), false) // 23:00 local
  })
  it('fechada na segunda e antes das 18h', () => {
    assert.equal(isOpenAt(new Date('2026-10-05T23:00:00Z'), hours, tz), false) // segunda 20:00
    assert.equal(isOpenAt(new Date('2026-10-07T20:59:00Z'), hours, tz), false) // quarta 17:59
  })
  it('entende horário que vira a meia-noite', () => {
    const late = [{ weekday: 6, opensAt: '18:00:00', closesAt: '02:00:00' }]
    assert.equal(isOpenAt(new Date('2026-10-11T04:30:00Z'), late, tz), true) // domingo 01:30, aberto desde sábado
    assert.equal(isOpenAt(new Date('2026-10-11T05:30:00Z'), late, tz), false) // domingo 02:30
  })
  it('não depende do fuso do servidor', () => {
    const before = process.env.TZ
    process.env.TZ = 'Asia/Tokyo'
    try {
      assert.equal(isOpenAt(new Date('2026-10-07T23:00:00Z'), hours, tz), true)
    } finally {
      process.env.TZ = before
    }
  })
})
