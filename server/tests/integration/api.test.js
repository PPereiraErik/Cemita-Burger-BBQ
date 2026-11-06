import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { seedDevData } from '../../src/db/seeders/dev.js'
import { seedDatabase } from '../../src/db/seeders/index.js'
import { freshDatabase } from '../helpers/db.js'
import { newKey, startApi } from '../helpers/http.js'

/**
 * API pública de ponta a ponta contra MySQL de teste.
 * Relógio fixo: quarta 07/10/2026, 20h em São Paulo (loja aberta, horário real do site).
 */
const OPEN = new Date('2026-10-07T23:00:00Z')
const CLOSED_MONDAY = new Date('2026-10-05T23:00:00Z')

let db, api, ids, policyId

const setting = (key, value) => db.sequelize.query('UPDATE store_settings SET value = ? WHERE `key` = ?', { replacements: [JSON.stringify(value), key] })
const one = async (sql, replacements = []) => (await db.sequelize.query(sql, { replacements }))[0][0]

function orderBody(over = {}) {
  return {
    lines: [{ productId: ids['smash-bacon'], quantity: 2 }],
    fulfillment: 'pickup',
    customer: { name: 'Cliente Teste', phone: '(47) 99999-0000' },
    paymentMethod: 'cash_on_delivery',
    privacyPolicyVersionId: policyId,
    ...over,
  }
}
const placeOrder = (body = orderBody(), key = newKey()) => api.post('/orders', body, { headers: { 'idempotency-key': key } })

before(async () => {
  db = await freshDatabase()
  await db.migrator.up()
  await seedDatabase(db.sequelize)
  await seedDevData(db.sequelize, { nodeEnv: 'test' })
  const [rows] = await db.sequelize.query('SELECT id, slug FROM products')
  ids = Object.fromEntries(rows.map((r) => [r.slug, r.id]))
  policyId = (await one("SELECT id FROM privacy_policy_versions WHERE version = 'DEV-0'")).id
  api = await startApi({ env: db.env, sequelize: db.sequelize, now: OPEN })
})
after(async () => {
  await api?.close()
  await db?.sequelize.close()
})
beforeEach(async () => {
  api.clock.current = OPEN
  await setting('ordering_mode', 'both')
  await setting('orders_paused', false)
})

describe('GET /catalog', () => {
  it('lista as 9 categorias e os 56 produtos, com preço em centavos', async () => {
    const r = await api.get('/catalog')
    assert.equal(r.status, 200)
    assert.equal(r.body.categories.length, 9)
    const all = r.body.categories.flatMap((c) => c.products)
    assert.equal(all.length, 56)
    assert.equal(all.find((p) => p.slug === 'smash-rib').priceCents, 3900)
  })
  it('publica combo com bebida e adicionais; esconde o combo antigo; "a partir de" não é pedível', async () => {
    const all = (await api.get('/catalog')).body.categories.flatMap((c) => c.products)
    const keys = (slug) => all.find((p) => p.slug === slug).optionGroups.map((g) => g.key)
    assert.ok(all.every((p) => !p.optionGroups.some((g) => g.key === 'combo')))
    assert.deepEqual(keys('smash-bacon').sort(), ['adicional', 'carne-smash', 'carne-vegana', 'combo-bebida', 'fritas'])
    assert.ok(keys('burger-cemita').includes('ponto'))
    assert.deepEqual(keys('coca'), [])
    assert.equal(all.find((p) => p.slug === 'fritas').orderable, false)
  })
})

describe('GET /store/status', () => {
  it('no modo VUCA o site não aceita pedido próprio', async () => {
    await setting('ordering_mode', 'vuca')
    const r = await api.get('/store/status')
    assert.equal(r.body.acceptsOrders, false)
    assert.ok(r.body.reasons.includes('ORDERING_DISABLED'))
  })
  it('aberta na quarta às 20h, fechada na segunda', async () => {
    assert.equal((await api.get('/store/status')).body.open, true)
    api.clock.current = CLOSED_MONDAY
    const r = await api.get('/store/status')
    assert.equal(r.body.open, false)
    assert.ok(r.body.reasons.includes('STORE_CLOSED'))
  })
  it('mostra só os pagamentos já operáveis (na entrega) e retirada sem prazo inventado', async () => {
    const r = await api.get('/store/status')
    assert.deepEqual(r.body.paymentMethods, ['cash_on_delivery', 'card_on_delivery'])
    assert.equal(r.body.fulfillment.pickup.etaMinutes, null)
  })
})

describe('POST /cart/quote', () => {
  it('calcula no servidor: 2 × Smash Bacon = R$ 70,00', async () => {
    const r = await api.post('/cart/quote', { lines: [{ productId: ids['smash-bacon'], quantity: 2 }], fulfillment: 'pickup' })
    assert.equal(r.status, 200)
    assert.equal(r.body.ok, true)
    assert.equal(r.body.totalCents, 7000)
  })
  it('preço manipulado no corpo é recusado (o campo nem é aceito)', async () => {
    const r = await api.post('/cart/quote', { lines: [{ productId: ids['smash-bacon'], quantity: 2, priceCents: 1 }], fulfillment: 'pickup' })
    assert.equal(r.status, 400)
    assert.equal(r.body.error.code, 'VALIDATION_ERROR')
  })
  it('produto inexistente e item "a partir de" voltam como problema da linha', async () => {
    const r = await api.post('/cart/quote', { lines: [{ productId: 999999, quantity: 1 }, { productId: ids.fritas, quantity: 1 }], fulfillment: 'pickup' })
    assert.equal(r.body.ok, false)
    assert.deepEqual(
      r.body.errors.map((e) => [e.code, e.line]),
      [['PRODUCT_NOT_FOUND', 0], ['PRODUCT_NOT_ORDERABLE', 1]],
    )
  })
  it('combo com bebida + adicional somam no servidor: Smash Bacon + combo + bacon = R$ 58,99', async () => {
    const all = (await api.get('/catalog')).body.categories.flatMap((c) => c.products)
    const sb = all.find((p) => p.slug === 'smash-bacon')
    const item = (key, name) => sb.optionGroups.find((g) => g.key === key).items.find((i) => i.name === name).id
    const r = await api.post('/cart/quote', { lines: [{ productId: sb.id, quantity: 1, optionIds: [item('combo-bebida', 'Combo + Coca-Cola'), item('adicional', 'Bacon')] }], fulfillment: 'pickup' })
    assert.equal(r.body.ok, true)
    assert.equal(r.body.totalCents, 3500 + 1599 + 800)
    assert.deepEqual(r.body.lines[0].options.map((o) => o.optionName).sort(), ['Bacon', 'Combo + Coca-Cola'])
  })
  it('burger grelhado sem o ponto da carne é recusado; opção de outro produto também', async () => {
    const all = (await api.get('/catalog')).body.categories.flatMap((c) => c.products)
    const bc = all.find((p) => p.slug === 'burger-cemita')
    const acomp = all.find((p) => p.slug === 'pork-ribs').optionGroups.find((g) => g.key === 'acompanhamento').items[0].id
    const sem = await api.post('/cart/quote', { lines: [{ productId: bc.id, quantity: 1 }], fulfillment: 'pickup' })
    assert.equal(sem.body.ok, false)
    assert.equal(sem.body.errors[0].code, 'OPTION_SELECTION_INVALID')
    const ponto = bc.optionGroups.find((g) => g.key === 'ponto').items[0].id
    const com = await api.post('/cart/quote', { lines: [{ productId: bc.id, quantity: 1, optionIds: [ponto] }], fulfillment: 'pickup' })
    assert.equal(com.body.ok, true)
    const errado = await api.post('/cart/quote', { lines: [{ productId: bc.id, quantity: 1, optionIds: [ponto, acomp] }], fulfillment: 'pickup' })
    assert.equal(errado.body.errors[0].code, 'OPTION_NOT_ALLOWED')
  })
  it('entrega numa zona de teste soma a taxa da zona', async () => {
    const r = await api.post('/cart/quote', { lines: [{ productId: ids['smash-bacon'], quantity: 1 }], fulfillment: 'delivery', address: { neighborhood: 'Bairro de Teste' } })
    assert.equal(r.body.deliveryFeeCents, 500)
    assert.equal(r.body.totalCents, 4000)
  })
})

describe('POST /orders', () => {
  it('cria pedido de retirada com pagamento na entrega, já RECEBIDO, com os valores do banco', async () => {
    const r = await placeOrder()
    assert.equal(r.status, 201)
    assert.match(r.body.order.code, /^CEM-[2-9A-HJ-NP-Z]{6}$/)
    assert.equal(r.body.order.status, 'received')
    assert.equal(r.body.order.totalCents, 7000)
    assert.equal(typeof r.body.trackingToken, 'string')
    assert.deepEqual(r.body.order.history.map((h) => h.status), ['pending', 'received'])
    const row = await one('SELECT customer_phone, phone_normalized, tracking_token_hash FROM orders WHERE public_code = ?', [r.body.order.code])
    assert.equal(row.customer_phone, '(47) 99999-0000')
    assert.notEqual(row.tracking_token_hash, r.body.trackingToken)
  })
  it('exige Idempotency-Key', async () => {
    const r = await api.post('/orders', orderBody())
    assert.equal(r.status, 400)
    assert.equal(r.body.error.code, 'IDEMPOTENCY_KEY_REQUIRED')
  })
  it('mesmo envio repetido devolve o MESMO pedido, sem duplicar', async () => {
    const key = newKey()
    const a = await placeOrder(orderBody(), key)
    const b = await placeOrder(orderBody(), key)
    assert.equal(a.status, 201)
    assert.equal(b.status, 200)
    assert.equal(b.body.replayed, true)
    assert.equal(b.body.order.code, a.body.order.code)
    assert.equal(b.body.trackingToken, a.body.trackingToken)
    assert.equal((await one('SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?', [key])).n, 1)
  })
  it('5 envios simultâneos com a mesma chave geram 1 pedido', async () => {
    const key = newKey()
    const results = await Promise.all(Array.from({ length: 5 }, () => placeOrder(orderBody(), key)))
    assert.ok(results.every((r) => r.status === 200 || r.status === 201), JSON.stringify(results.map((r) => r.status)))
    assert.equal(new Set(results.map((r) => r.body.order.code)).size, 1)
    assert.equal((await one('SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?', [key])).n, 1)
  })
  it('mesma chave com outro conteúdo é recusada', async () => {
    const key = newKey()
    await placeOrder(orderBody(), key)
    const r = await placeOrder(orderBody({ lines: [{ productId: ids['smash-bacon'], quantity: 3 }] }), key)
    assert.equal(r.status, 409)
    assert.equal(r.body.error.code, 'IDEMPOTENCY_KEY_REUSED')
  })
  it('recusa pedido vazio e quantidade inválida', async () => {
    assert.equal((await placeOrder(orderBody({ lines: [] }))).status, 400)
    assert.equal((await placeOrder(orderBody({ lines: [{ productId: ids['smash-bacon'], quantity: 0 }] }))).status, 400)
  })
  it('recusa produto indisponível', async () => {
    await db.sequelize.query("UPDATE products SET available = 0 WHERE slug = 'brisket'")
    try {
      const r = await placeOrder(orderBody({ lines: [{ productId: ids.brisket, quantity: 1 }] }))
      assert.equal(r.status, 422)
      assert.equal(r.body.error.details.errors[0].code, 'PRODUCT_UNAVAILABLE')
    } finally {
      await db.sequelize.query("UPDATE products SET available = 1 WHERE slug = 'brisket'")
    }
  })
  it('recusa quando o site está no modo VUCA, pausado ou fechado', async () => {
    await setting('ordering_mode', 'vuca')
    assert.equal((await placeOrder()).body.error.code, 'ORDERING_DISABLED')
    await setting('ordering_mode', 'both')
    await setting('orders_paused', true)
    assert.equal((await placeOrder()).body.error.code, 'STORE_PAUSED')
    await setting('orders_paused', false)
    api.clock.current = CLOSED_MONDAY
    assert.equal((await placeOrder()).body.error.code, 'STORE_CLOSED')
  })
  it('exige aceite da versão atual da política de privacidade', async () => {
    const r = await placeOrder(orderBody({ privacyPolicyVersionId: policyId + 999 }))
    assert.equal(r.body.error.code, 'PRIVACY_CONSENT_REQUIRED')
  })
  it('bebida alcoólica exige confirmação de maioridade, que fica gravada', async () => {
    const lines = [{ productId: ids['stannis-ipa'], quantity: 1 }]
    assert.equal((await placeOrder(orderBody({ lines }))).body.error.code, 'ADULT_CONFIRMATION_REQUIRED')
    const ok = await placeOrder(orderBody({ lines, adultConfirmed: true }))
    assert.equal(ok.status, 201)
    assert.ok((await one('SELECT adult_confirmed_at FROM orders WHERE public_code = ?', [ok.body.order.code])).adult_confirmed_at)
  })
  it('PIX/cartão online ficam indisponíveis até existir gateway', async () => {
    assert.equal((await placeOrder(orderBody({ paymentMethod: 'pix' }))).body.error.code, 'PAYMENT_METHOD_UNAVAILABLE')
  })
  it('troco: só em dinheiro e maior ou igual ao total', async () => {
    assert.equal((await placeOrder(orderBody({ changeForCents: 5000 }))).body.error.code, 'INVALID_CHANGE')
    assert.equal((await placeOrder(orderBody({ paymentMethod: 'card_on_delivery', changeForCents: 10000 }))).body.error.code, 'INVALID_CHANGE')
    assert.equal((await placeOrder(orderBody({ changeForCents: 10000 }))).status, 201)
  })
  it('entrega fora das zonas é recusada; dentro soma a taxa', async () => {
    const address = { cep: '89203001', street: 'Rua Ottokar Doerffel', number: '165', neighborhood: 'Anita Garibaldi' }
    const out = await placeOrder(orderBody({ fulfillment: 'delivery', address }))
    assert.equal(out.body.error.details.errors[0].code, 'DELIVERY_UNAVAILABLE')
    const inside = await placeOrder(orderBody({ fulfillment: 'delivery', address: { ...address, neighborhood: 'Bairro de Teste' } }))
    assert.equal(inside.status, 201)
    assert.equal(inside.body.order.deliveryFeeCents, 500)
    assert.equal(inside.body.order.totalCents, 7500)
  })
  it('pedido antigo mantém o preço mesmo depois de o cardápio mudar', async () => {
    const r = await placeOrder()
    await db.sequelize.query("UPDATE products SET price_cents = 9900 WHERE slug = 'smash-bacon'")
    try {
      const again = await api.get(`/orders/${r.body.order.code}`, { headers: { 'x-tracking-token': r.body.trackingToken } })
      assert.equal(again.body.order.items[0].unitPriceCents, 3500)
      assert.equal(again.body.order.totalCents, 7000)
    } finally {
      await db.sequelize.query("UPDATE products SET price_cents = 3500 WHERE slug = 'smash-bacon'")
    }
  })
})

describe('cupom com limite de uso', () => {
  it('dois pedidos simultâneos não passam do limite', async () => {
    await db.sequelize.query("INSERT INTO coupons (code, type, value, max_uses, active) VALUES ('TESTE1', 'fixed', 500, 1, 1)")
    const body = orderBody({ couponCode: 'teste1' })
    const [a, b] = await Promise.all([placeOrder(body), placeOrder(body)])
    const statuses = [a.status, b.status].sort()
    assert.deepEqual(statuses, [201, 422])
    const won = [a, b].find((r) => r.status === 201)
    assert.equal(won.body.order.discountCents, 500)
    assert.equal((await one("SELECT used_count FROM coupons WHERE code = 'TESTE1'")).used_count, 1)
  })
})

describe('acompanhamento e cancelamento pelo cliente', () => {
  it('sem token, com token errado ou código inexistente: 404 (não revela se existe)', async () => {
    const r = await placeOrder()
    assert.equal((await api.get(`/orders/${r.body.order.code}`)).status, 404)
    assert.equal((await api.get(`/orders/${r.body.order.code}`, { headers: { 'x-tracking-token': 'errado' } })).status, 404)
    assert.equal((await api.get('/orders/CEM-ZZZZZZ', { headers: { 'x-tracking-token': r.body.trackingToken } })).status, 404)
    assert.equal((await api.get('/orders/qualquer-coisa')).status, 404)
  })
  it('com o token certo mostra o pedido sem telefone nem endereço completo', async () => {
    const r = await placeOrder()
    const g = await api.get(`/orders/${r.body.order.code}`, { headers: { 'x-tracking-token': r.body.trackingToken } })
    assert.equal(g.status, 200)
    const text = JSON.stringify(g.body)
    assert.ok(!text.includes('99999'))
    assert.equal(g.body.order.statusLabel, '✓ Recebido')
  })
  it('cliente cancela antes do preparo; depois do preparo, não', async () => {
    const r = await placeOrder()
    const h = { headers: { 'x-tracking-token': r.body.trackingToken } }
    const c = await api.post(`/orders/${r.body.order.code}/cancel`, undefined, h)
    assert.equal(c.status, 200)
    assert.equal(c.body.order.status, 'cancelled')
    const again = await api.post(`/orders/${r.body.order.code}/cancel`, undefined, h)
    assert.equal(again.status, 409)

    const r2 = await placeOrder()
    await db.sequelize.query("UPDATE orders SET status = 'preparing', version = version + 1 WHERE public_code = ?", { replacements: [r2.body.order.code] })
    const late = await api.post(`/orders/${r2.body.order.code}/cancel`, undefined, { headers: { 'x-tracking-token': r2.body.trackingToken } })
    assert.equal(late.status, 409)
    assert.equal(late.body.error.code, 'ORDER_CANNOT_BE_CANCELLED')
  })
})

describe('CORS (o site em outra porta/domínio)', () => {
  const SITE = 'http://localhost:5173' // CORS_ORIGINS do .env.test

  it('libera a origem do site e expõe o X-Request-Id', async () => {
    const r = await api.get('/catalog', { headers: { origin: SITE } })
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('access-control-allow-origin'), SITE)
    assert.match(r.headers.get('access-control-expose-headers') ?? '', /X-Request-Id/)
    assert.match(r.headers.get('vary') ?? '', /Origin/i)
    assert.equal(r.headers.get('access-control-allow-credentials'), null)
  })

  it('pré-verificação do pedido aceita os cabeçalhos de idempotência e de acompanhamento', async () => {
    const r = await api.request('OPTIONS', '/orders', {
      headers: { origin: SITE, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,idempotency-key' },
    })
    assert.equal(r.status, 204)
    assert.equal(r.headers.get('access-control-allow-origin'), SITE)
    const allowed = (r.headers.get('access-control-allow-headers') ?? '').toLowerCase()
    for (const h of ['content-type', 'idempotency-key', 'x-tracking-token']) assert.ok(allowed.includes(h), h)
    assert.match(r.headers.get('access-control-allow-methods') ?? '', /POST/)
  })

  it('outra origem não recebe liberação; a pré-verificação dela é recusada', async () => {
    const r = await api.get('/catalog', { headers: { origin: 'https://site-estranho.example' } })
    assert.equal(r.headers.get('access-control-allow-origin'), null)
    const pre = await api.request('OPTIONS', '/orders', { headers: { origin: 'https://site-estranho.example', 'access-control-request-method': 'POST' } })
    assert.equal(pre.status, 403)
    assert.equal(pre.body.error.code, 'CORS_ORIGIN_DENIED')
    assert.equal(pre.headers.get('access-control-allow-origin'), null)
  })
})
