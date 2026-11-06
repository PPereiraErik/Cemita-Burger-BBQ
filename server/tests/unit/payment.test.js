import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { describe, it } from 'node:test'
import { decidePayment, paymentView } from '../../src/domain/payment.js'
import { buildPreference, createMercadoPago, mapStatus, normalizePayment, verifySignature } from '../../src/payments/mercadopago.js'

const SECRET = 'segredo-de-teste-do-webhook-123456'
const sign = (manifest, secret = SECRET) => crypto.createHmac('sha256', secret).update(manifest).digest('hex')

describe('Mercado Pago: assinatura do webhook', () => {
  const ts = '1742505638683'
  const v1 = sign(`id:123456;request-id:req-abc;ts:${ts};`)

  it('aceita a assinatura certa (id da URL, x-request-id e ts)', () => {
    assert.equal(verifySignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-abc', dataId: '123456', secret: SECRET }), true)
    assert.equal(verifySignature({ xSignature: ` ts=${ts} , v1=${v1} `, xRequestId: 'req-abc', dataId: '123456', secret: SECRET }), true)
  })

  it('recusa id, request-id, ts, segredo ou assinatura trocados', () => {
    assert.equal(verifySignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-abc', dataId: '999', secret: SECRET }), false)
    assert.equal(verifySignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'outro', dataId: '123456', secret: SECRET }), false)
    assert.equal(verifySignature({ xSignature: `ts=1,v1=${v1}`, xRequestId: 'req-abc', dataId: '123456', secret: SECRET }), false)
    assert.equal(verifySignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-abc', dataId: '123456', secret: 'outro-segredo-qualquer-123' }), false)
    assert.equal(verifySignature({ xSignature: `ts=${ts},v1=${'0'.repeat(64)}`, xRequestId: 'req-abc', dataId: '123456', secret: SECRET }), false)
  })

  it('falha fechada: sem segredo, sem cabeçalho ou cabeçalho malformado, nada passa', () => {
    assert.equal(verifySignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-abc', dataId: '123456', secret: '' }), false)
    assert.equal(verifySignature({ xSignature: undefined, xRequestId: 'req-abc', dataId: '123456', secret: SECRET }), false)
    assert.equal(verifySignature({ xSignature: 'lixo', xRequestId: 'req-abc', dataId: '123456', secret: SECRET }), false)
    assert.equal(verifySignature({ xSignature: `ts=${ts},v1=xyz`, xRequestId: 'req-abc', dataId: '123456', secret: SECRET }), false)
  })

  it('id alfanumérico entra em minúsculas; sem x-request-id, o trecho sai do texto assinado', () => {
    const a = sign(`id:abc123;request-id:r1;ts:${ts};`)
    assert.equal(verifySignature({ xSignature: `ts=${ts},v1=${a}`, xRequestId: 'r1', dataId: 'ABC123', secret: SECRET }), true)
    const b = sign(`id:42;ts:${ts};`)
    assert.equal(verifySignature({ xSignature: `ts=${ts},v1=${b}`, xRequestId: undefined, dataId: '42', secret: SECRET }), true)
  })
})

describe('Mercado Pago: preferência (link de pagamento)', () => {
  const order = { publicCode: 'CEM-ABC123', totalCents: 13699 }

  it('um item com o total do servidor, referência = código do pedido, volta para o acompanhamento', () => {
    const p = buildPreference({ order, method: 'pix', siteUrl: 'https://cemita.com.br/' })
    assert.deepEqual(p.items, [{ id: 'CEM-ABC123', title: 'Pedido CEM-ABC123 · Cemita Burger & BBQ', quantity: 1, currency_id: 'BRL', unit_price: 136.99 }])
    assert.equal(p.external_reference, 'CEM-ABC123')
    assert.equal(p.back_urls.success, 'https://cemita.com.br/?pedido=CEM-ABC123')
    assert.equal(p.auto_return, 'approved')
    assert.equal(p.expires, undefined)
  })

  it('Pix tira cartão e boleto; cartão no site tira Pix e boleto', () => {
    const ex = (m) => buildPreference({ order, method: m, siteUrl: 'https://x.dev' }).payment_methods.excluded_payment_types.map((t) => t.id)
    assert.ok(ex('pix').includes('credit_card') && ex('pix').includes('ticket') && !ex('pix').includes('bank_transfer'))
    assert.ok(ex('card_online').includes('bank_transfer') && !ex('card_online').includes('credit_card'))
  })

  it('prazo para pagar vira expiração da preferência; forma na entrega é recusada', () => {
    const p = buildPreference({ order, method: 'card_online', siteUrl: 'https://x.dev', expiresAt: new Date('2026-10-30T02:00:00Z') })
    assert.equal(p.expires, true)
    assert.equal(p.expiration_date_to, '2026-10-30T02:00:00.000Z')
    assert.throws(() => buildPreference({ order, method: 'cash_on_delivery', siteUrl: 'https://x.dev' }))
  })

  it('cliente HTTP: manda o token só no cabeçalho, usa o link certo e normaliza o pagamento', async () => {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, init })
      if (url.endsWith('/checkout/preferences')) return new Response(JSON.stringify({ id: 'pref-1', init_point: 'https://mp/prod', sandbox_init_point: 'https://mp/sandbox' }), { status: 201 })
      return new Response(JSON.stringify({ id: 987, status: 'approved', external_reference: 'CEM-ABC123', transaction_amount: 136.99, currency_id: 'BRL', date_approved: '2026-10-29T23:00:00.000-03:00' }), { status: 200 })
    }
    const mp = createMercadoPago({ accessToken: 'TEST-token-de-teste-1234567890', webhookSecret: SECRET, siteUrl: 'https://x.dev', sandbox: true, fetchImpl })
    const c = await mp.createCheckout({ order, method: 'pix' })
    assert.deepEqual(c, { reference: 'pref-1', checkoutUrl: 'https://mp/sandbox' })
    assert.equal(calls[0].init.headers.Authorization, 'Bearer TEST-token-de-teste-1234567890')
    assert.ok(!calls[0].init.body.includes('TEST-token'))
    const p = await mp.getPayment('987')
    assert.equal(calls[1].url, 'https://api.mercadopago.com/v1/payments/987')
    assert.deepEqual({ ...p, approvedAt: p.approvedAt.toISOString() }, { id: '987', rawStatus: 'approved', status: 'approved', externalReference: 'CEM-ABC123', amountCents: 13699, currency: 'BRL', approvedAt: '2026-10-30T02:00:00.000Z', methodId: null })
  })

  it('erro HTTP do gateway vira erro (sem vazar o token)', async () => {
    const mp = createMercadoPago({ accessToken: 'TEST-token-de-teste-1234567890', webhookSecret: SECRET, siteUrl: 'https://x.dev', fetchImpl: async () => new Response('{"message":"invalid"}', { status: 401 }) })
    await assert.rejects(mp.getPayment('1'), (e) => e.status === 401 && !e.message.includes('TEST-token'))
  })
})

describe('Mercado Pago: status', () => {
  it('só "approved" é dinheiro confirmado', () => {
    assert.equal(mapStatus('approved'), 'approved')
    for (const s of ['pending', 'in_process', 'authorized', 'algo_novo', undefined]) assert.equal(mapStatus(s), 'pending', String(s))
    assert.equal(mapStatus('rejected'), 'declined')
    assert.equal(mapStatus('cancelled'), 'cancelled')
    assert.equal(mapStatus('refunded'), 'refunded')
    assert.equal(mapStatus('charged_back'), 'refunded')
    assert.equal(mapStatus('in_mediation'), 'in_review')
  })
  it('valor decimal vira centavos sem erro de arredondamento', () => {
    assert.equal(normalizePayment({ id: 1, status: 'approved', transaction_amount: 0.1 + 0.2 }).amountCents, 30)
    assert.equal(normalizePayment({ id: 1, status: 'approved', transaction_amount: 77.99 }).amountCents, 7799)
  })
})

describe('decisão do pagamento (webhook)', () => {
  const remote = (over = {}) => ({ id: '987', status: 'approved', rawStatus: 'approved', amountCents: 5000, currency: 'BRL', approvedAt: new Date('2026-10-29T23:00:00Z'), ...over })
  const pay = (over = {}) => ({ status: 'pending', amountCents: 5000, currency: 'BRL', ...over })

  it('aprovado com valor certo: pedido vai para a cozinha (aguardando → aprovado → recebido)', () => {
    const d = decidePayment({ order: { status: 'awaiting_payment', totalCents: 5000 }, payment: pay(), remote: remote() })
    assert.deepEqual(d.orderPath, ['payment_approved', 'received'])
    assert.equal(d.paymentPatch.status, 'approved')
    assert.equal(d.paymentPatch.providerPaymentId, '987')
    assert.equal(d.outcome, 'approved')
  })

  it('aprovado ainda com o pedido pendente passa por "aguardando" antes', () => {
    assert.deepEqual(decidePayment({ order: { status: 'pending', totalCents: 5000 }, payment: pay(), remote: remote() }).orderPath, ['awaiting_payment', 'payment_approved', 'received'])
  })

  it('aviso repetido de aprovado não faz nada', () => {
    const d = decidePayment({ order: { status: 'received', totalCents: 5000 }, payment: pay({ status: 'approved' }), remote: remote() })
    assert.deepEqual([d.paymentPatch, d.orderPath, d.outcome], [null, [], 'already_approved'])
  })

  it('valor ou moeda diferente: EM ANÁLISE e o pedido não anda', () => {
    for (const r of [remote({ amountCents: 4999 }), remote({ currency: 'USD' })]) {
      const d = decidePayment({ order: { status: 'awaiting_payment', totalCents: 5000 }, payment: pay(), remote: r })
      assert.equal(d.paymentPatch.status, 'in_review')
      assert.deepEqual(d.orderPath, [])
    }
  })

  it('aprovado depois do cancelamento: EM ANÁLISE (precisa de estorno), pedido continua cancelado', () => {
    const d = decidePayment({ order: { status: 'cancelled', totalCents: 5000 }, payment: pay({ status: 'cancelled' }), remote: remote() })
    assert.equal(d.paymentPatch.status, 'in_review')
    assert.deepEqual(d.orderPath, [])
    assert.equal(d.outcome, 'approved_after_cancel')
  })

  it('recusado só marca o pagamento (o cliente tenta de novo no mesmo link)', () => {
    const d = decidePayment({ order: { status: 'awaiting_payment', totalCents: 5000 }, payment: pay(), remote: remote({ status: 'declined', rawStatus: 'rejected' }) })
    assert.equal(d.paymentPatch.status, 'declined')
    assert.deepEqual(d.orderPath, [])
  })

  it('aviso atrasado de "pendente" não desfaz um pagamento aprovado; estorno sim', () => {
    const late = decidePayment({ order: { status: 'preparing', totalCents: 5000 }, payment: pay({ status: 'approved' }), remote: remote({ status: 'pending', rawStatus: 'in_process' }) })
    assert.equal(late.paymentPatch, null)
    const refund = decidePayment({ order: { status: 'completed', totalCents: 5000 }, payment: pay({ status: 'approved' }), remote: remote({ status: 'refunded', rawStatus: 'refunded' }) })
    assert.equal(refund.paymentPatch.status, 'refunded')
    assert.deepEqual(refund.orderPath, [])
  })
})

describe('pagamento no acompanhamento do cliente', () => {
  it('link de pagamento só aparece enquanto o pedido aguarda pagamento', () => {
    const p = { method: 'pix', status: 'pending', checkoutUrl: 'https://mp/x' }
    assert.equal(paymentView(p, 'awaiting_payment').checkoutUrl, 'https://mp/x')
    assert.equal(paymentView(p, 'received').checkoutUrl, null)
    assert.equal(paymentView({ ...p, status: 'approved' }, 'awaiting_payment').checkoutUrl, null)
    assert.equal(paymentView({ method: 'cash_on_delivery', status: 'pending', checkoutUrl: null }, 'received').online, false)
    assert.equal(paymentView(null, 'received'), null)
  })
})
