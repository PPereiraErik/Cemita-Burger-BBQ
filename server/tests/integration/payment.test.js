import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { seedDevData } from '../../src/db/seeders/dev.js'
import { seedDatabase } from '../../src/db/seeders/index.js'
import { normalizePayment, PROVIDER, verifySignature } from '../../src/payments/mercadopago.js'
import { freshDatabase } from '../helpers/db.js'
import { newKey, startApi } from '../helpers/http.js'

/**
 * Pagamento online (Etapa 6) de ponta a ponta contra MySQL de teste, com um Mercado Pago FALSO:
 * mesma assinatura de webhook e mesmo formato de pagamento da API real, sem rede.
 * Relógio fixo: quarta 07/10/2026, 20h em São Paulo (loja aberta).
 */
const OPEN = new Date('2026-10-07T23:00:00Z')
const SECRET = 'segredo-do-webhook-de-teste-0001'

/** Gateway falso: guarda as cobranças criadas e os pagamentos "do Mercado Pago". */
function fakeGateway() {
  const g = {
    provider: PROVIDER,
    created: [],
    remote: new Map(),
    failCreate: false,
    async createCheckout({ order, method }) {
      if (g.failCreate) throw new Error('fora do ar')
      g.created.push({ order, method })
      return { reference: `pref-${order.publicCode}`, checkoutUrl: `https://mp.test/checkout/${order.publicCode}` }
    },
    async getPayment(id) {
      const p = g.remote.get(String(id))
      if (!p) throw Object.assign(new Error('não achado'), { status: 404 })
      return normalizePayment(p)
    },
    verify: (args) => verifySignature({ ...args, secret: SECRET }),
  }
  return g
}

let db, api, ids, policyId, gw
const setting = (key, value) => db.sequelize.query('UPDATE store_settings SET value = ? WHERE `key` = ?', { replacements: [JSON.stringify(value), key] })
const one = async (sql, replacements = []) => (await db.sequelize.query(sql, { replacements }))[0][0]

const orderBody = (over = {}) => ({
  lines: [{ productId: ids['smash-bacon'], quantity: 2 }],
  fulfillment: 'pickup',
  customer: { name: 'Cliente Teste', phone: '(47) 99999-0000' },
  paymentMethod: 'pix',
  privacyPolicyVersionId: policyId,
  ...over,
})
const placeOrder = (body = orderBody(), key = newKey()) => api.post('/orders', body, { headers: { 'idempotency-key': key } })

/** Envia o aviso como o Mercado Pago: data.id e type na URL, x-signature e x-request-id assinados. */
async function webhook(paymentId, { secret = SECRET, requestId = crypto.randomUUID(), type = 'payment' } = {}) {
  const ts = String(Date.now())
  const v1 = crypto.createHmac('sha256', secret).update(`id:${paymentId};request-id:${requestId};ts:${ts};`).digest('hex')
  return api.request('POST', `/payments/mercadopago/webhook?data.id=${paymentId}&type=${type}`, {
    body: { action: 'payment.updated', type, data: { id: String(paymentId) } },
    headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
  })
}
const mpPayment = (id, code, over = {}) => gw.remote.set(String(id), { id, status: 'approved', external_reference: code, transaction_amount: 70, currency_id: 'BRL', date_approved: '2026-10-07T23:05:00.000Z', ...over })

before(async () => {
  db = await freshDatabase()
  await db.migrator.up()
  await seedDatabase(db.sequelize)
  await seedDevData(db.sequelize, { nodeEnv: 'test' })
  const [rows] = await db.sequelize.query('SELECT id, slug FROM products')
  ids = Object.fromEntries(rows.map((r) => [r.slug, r.id]))
  policyId = (await one("SELECT id FROM privacy_policy_versions WHERE version = 'DEV-0'")).id
  gw = fakeGateway()
  api = await startApi({ env: db.env, sequelize: db.sequelize, now: OPEN, gateway: gw })
})
after(async () => {
  await api?.close()
  await db?.sequelize.close()
})
beforeEach(async () => {
  api.clock.current = OPEN
  gw.failCreate = false
  await setting('ordering_mode', 'both')
  await setting('orders_paused', false)
  await setting('payment_methods_enabled', ['cash_on_delivery', 'card_on_delivery', 'pix', 'card_online'])
})

describe('pagamento online: criação', () => {
  it('a loja oferece Pix e cartão no site quando o gateway está configurado', async () => {
    const r = await api.get('/store/status')
    assert.deepEqual(r.body.paymentMethods, ['cash_on_delivery', 'card_on_delivery', 'pix', 'card_online'])
    assert.equal(r.body.onlinePaymentsReady, true)
  })

  it('pedido com Pix: fica AGUARDANDO PAGAMENTO, com o link do gateway, e NÃO vai para a cozinha', async () => {
    const r = await placeOrder()
    assert.equal(r.status, 201)
    assert.equal(r.body.order.status, 'awaiting_payment')
    assert.equal(r.body.order.payment.checkoutUrl, `https://mp.test/checkout/${r.body.order.code}`)
    assert.equal(r.body.order.payment.online, true)
    assert.equal(gw.created.at(-1).order.totalCents, 7000)
    assert.equal(gw.created.at(-1).method, 'pix')
    const p = await one('SELECT provider, status, amount_cents, provider_reference FROM payments WHERE order_id = (SELECT id FROM orders WHERE public_code = ?)', [r.body.order.code])
    assert.deepEqual([p.provider, p.status, p.amount_cents, p.provider_reference], ['mercadopago', 'pending', 7000, `pref-${r.body.order.code}`])
  })

  it('reenvio com a mesma chave não cria outra cobrança', async () => {
    const key = newKey()
    const before = gw.created.length
    const a = await placeOrder(orderBody(), key)
    const b = await placeOrder(orderBody(), key)
    assert.equal(b.body.order.code, a.body.order.code)
    assert.equal(gw.created.length, before + 1)
  })

  it('gateway fora do ar: o pedido fica salvo; "Pagar agora" cria a cobrança depois', async () => {
    gw.failCreate = true
    const r = await placeOrder()
    assert.equal(r.status, 201)
    assert.equal(r.body.order.status, 'pending')
    assert.equal(r.body.order.payment.checkoutUrl, null)
    assert.ok(r.body.paymentError)
    gw.failCreate = false
    const pay = await api.post(`/orders/${r.body.order.code}/pay`, {}, { headers: { 'x-tracking-token': r.body.trackingToken } })
    assert.equal(pay.status, 200)
    assert.equal(pay.body.checkoutUrl, `https://mp.test/checkout/${r.body.order.code}`)
    const again = await api.get(`/orders/${r.body.order.code}`, { headers: { 'x-tracking-token': r.body.trackingToken } })
    assert.equal(again.body.order.status, 'awaiting_payment')
  })

  it('"Pagar agora" sem o token do pedido não revela nada', async () => {
    const r = await placeOrder()
    const pay = await api.post(`/orders/${r.body.order.code}/pay`, {}, { headers: { 'x-tracking-token': 'errado' } })
    assert.equal(pay.status, 404)
  })

  it('pagamento na entrega continua igual (já RECEBIDO, sem gateway)', async () => {
    const before = gw.created.length
    const r = await placeOrder(orderBody({ paymentMethod: 'cash_on_delivery' }))
    assert.equal(r.body.order.status, 'received')
    assert.equal(r.body.order.payment.online, false)
    assert.equal(gw.created.length, before)
  })
})

describe('pagamento online: webhook', () => {
  it('assinatura errada → 401 e nada muda', async () => {
    const r = await placeOrder()
    mpPayment(1001, r.body.order.code)
    const w = await webhook(1001, { secret: 'outro-segredo-qualquer-0000' })
    assert.equal(w.status, 401)
    assert.equal((await one('SELECT status FROM orders WHERE public_code = ?', [r.body.order.code])).status, 'awaiting_payment')
  })

  it('aprovado: pedido vai para a cozinha (aprovado → recebido), com histórico do gateway', async () => {
    const r = await placeOrder()
    mpPayment(1002, r.body.order.code)
    const w = await webhook(1002)
    assert.equal(w.status, 200)
    assert.equal(w.body.outcome, 'approved')
    const o = await api.get(`/orders/${r.body.order.code}`, { headers: { 'x-tracking-token': r.body.trackingToken } })
    assert.equal(o.body.order.status, 'received')
    assert.deepEqual(o.body.order.history.map((h) => h.status), ['pending', 'awaiting_payment', 'payment_approved', 'received'])
    assert.equal(o.body.order.payment.status, 'approved')
    assert.equal(o.body.order.payment.checkoutUrl, null)
    const p = await one('SELECT provider_payment_id, paid_at FROM payments WHERE order_id = (SELECT id FROM orders WHERE public_code = ?)', [r.body.order.code])
    assert.equal(p.provider_payment_id, '1002')
    assert.ok(p.paid_at)
  })

  it('o mesmo aviso duas vezes (e dois ao mesmo tempo) não faz efeito duas vezes', async () => {
    const r = await placeOrder()
    mpPayment(1003, r.body.order.code)
    const results = await Promise.all([webhook(1003), webhook(1003), webhook(1003)])
    assert.ok(results.every((x) => x.status === 200))
    const n = await one("SELECT COUNT(*) AS n FROM order_status_history h JOIN orders o ON o.id = h.order_id WHERE o.public_code = ? AND h.to_status = 'received'", [r.body.order.code])
    assert.equal(Number(n.n), 1)
  })

  it('valor diferente do pedido → EM ANÁLISE, pedido não vai para a cozinha', async () => {
    const r = await placeOrder()
    mpPayment(1004, r.body.order.code, { transaction_amount: 1 })
    assert.equal((await webhook(1004)).body.outcome, 'amount_mismatch')
    assert.equal((await one('SELECT status FROM orders WHERE public_code = ?', [r.body.order.code])).status, 'awaiting_payment')
    assert.equal((await one('SELECT status FROM payments WHERE order_id = (SELECT id FROM orders WHERE public_code = ?)', [r.body.order.code])).status, 'in_review')
  })

  it('cliente cancelou e depois pagou → pagamento EM ANÁLISE (estornar), pedido segue cancelado', async () => {
    const r = await placeOrder()
    const c = await api.post(`/orders/${r.body.order.code}/cancel`, {}, { headers: { 'x-tracking-token': r.body.trackingToken } })
    assert.equal(c.body.order.status, 'cancelled')
    mpPayment(1005, r.body.order.code)
    assert.equal((await webhook(1005)).body.outcome, 'approved_after_cancel')
    assert.equal((await one('SELECT status FROM orders WHERE public_code = ?', [r.body.order.code])).status, 'cancelled')
  })

  it('recusado: só marca o pagamento; o cliente pode tentar de novo e o aprovado depois vale', async () => {
    const r = await placeOrder()
    mpPayment(1006, r.body.order.code, { status: 'rejected' })
    assert.equal((await webhook(1006)).body.outcome, 'declined')
    assert.equal((await one('SELECT status FROM orders WHERE public_code = ?', [r.body.order.code])).status, 'awaiting_payment')
    mpPayment(1007, r.body.order.code)
    assert.equal((await webhook(1007)).body.outcome, 'approved')
    assert.equal((await one('SELECT status FROM orders WHERE public_code = ?', [r.body.order.code])).status, 'received')
  })

  it('aviso de pagamento de outro sistema (sem pedido nosso) responde 200 e é só registrado', async () => {
    gw.remote.set('1008', { id: 1008, status: 'approved', external_reference: 'OUTRA-COISA', transaction_amount: 10, currency_id: 'BRL' })
    const w = await webhook(1008)
    assert.equal(w.status, 200)
    assert.equal(w.body.outcome, 'order_not_found')
  })

  it('tipo que não é pagamento é ignorado (200)', async () => {
    const w = await webhook(1009, { type: 'merchant_order' })
    assert.equal(w.status, 200)
    assert.equal(w.body.outcome, 'ignored')
  })
})
