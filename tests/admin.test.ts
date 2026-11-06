/** Regras puras do painel (src/admin/core.ts). */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ticketLines,
  paymentNote,
  EMPTY_EVENT,
  eventProblems,
  eventToBody,
  eventWhen,
  mergeDraft, actionsFor, auditDetail, centsToInput, columnsFor, hoursProblem, money, newOrderCodes, parseCents, passwordHint, since, type AdminOrder } from '../src/admin/core.ts'

const order = (id: number, code: string) => ({ id, code }) as AdminOrder

describe('painel: botões de status por papel', () => {
  it('cozinha só começa preparo e marca pronto; nunca cancela', () => {
    assert.deepEqual(actionsFor({ status: 'received', fulfillment: 'pickup' }, 'kitchen').map((a) => a.to), ['preparing'])
    assert.deepEqual(actionsFor({ status: 'preparing', fulfillment: 'delivery' }, 'kitchen').map((a) => a.to), ['ready'])
    assert.deepEqual(actionsFor({ status: 'ready', fulfillment: 'delivery' }, 'kitchen'), [])
  })
  it('pronto: entrega sai para entrega; retirada é finalizada no balcão', () => {
    assert.equal(actionsFor({ status: 'ready', fulfillment: 'delivery' }, 'staff')[0].to, 'out_for_delivery')
    assert.equal(actionsFor({ status: 'ready', fulfillment: 'pickup' }, 'staff')[0].to, 'completed')
  })
  it('atendimento pode cancelar até finalizar; pedido aguardando pagamento só tem cancelar', () => {
    assert.ok(actionsFor({ status: 'out_for_delivery', fulfillment: 'delivery' }, 'staff').some((a) => a.to === 'cancelled'))
    assert.deepEqual(actionsFor({ status: 'awaiting_payment', fulfillment: 'pickup' }, 'admin').map((a) => a.to), ['cancelled'])
    assert.deepEqual(actionsFor({ status: 'completed', fulfillment: 'pickup' }, 'admin'), [])
  })
  it('colunas: cozinha vê 3, atendimento vê 4 (com "saiu para entrega")', () => {
    assert.equal(columnsFor('kitchen').length, 3)
    assert.deepEqual(columnsFor('staff').map((c) => c.key), ['novos', 'preparo', 'prontos', 'saiu'])
    assert.ok(!columnsFor('kitchen').some((c) => c.statuses.includes('pending')))
  })
})

describe('painel: utilidades', () => {
  it('dinheiro ida e volta', () => {
    assert.equal(parseCents('39,90'), 3990)
    assert.equal(parseCents('R$ 1.234,5'), 123450)
    assert.equal(parseCents('39.9'), 3990)
    assert.equal(parseCents('0'), 0)
    assert.equal(parseCents('-1'), null)
    assert.equal(parseCents('abc'), null)
    assert.equal(parseCents(''), null)
    assert.equal(centsToInput(3990), '39,90')
    assert.equal(money(3990), 'R$ 39,90')
  })
  it('tempo desde o pedido', () => {
    const t = Date.parse('2026-10-19T20:00:00Z')
    assert.equal(since('2026-10-19T20:00:20Z', t), 'agora')
    assert.equal(since('2026-10-19T19:52:00Z', t), '8 min')
    assert.equal(since('2026-10-19T18:55:00Z', t), '1 h 05')
  })
  it('pedido novo = id que não estava na lista anterior (primeira carga não avisa)', () => {
    assert.deepEqual(newOrderCodes(null, [order(1, 'CEM-AAAAAA')]), [])
    assert.deepEqual(newOrderCodes([order(1, 'CEM-AAAAAA')], [order(1, 'CEM-AAAAAA'), order(2, 'CEM-BBBBBB')]), ['CEM-BBBBBB'])
  })
  it('horário: formato e abertura diferente do fechamento', () => {
    assert.equal(hoursProblem([{ weekday: 2, opensAt: '18:00', closesAt: '23:00' }]), null)
    assert.equal(hoursProblem([{ weekday: 5, opensAt: '18:00', closesAt: '01:00' }]), null)
    assert.match(hoursProblem([{ weekday: 2, opensAt: '18h', closesAt: '23:00' }]) ?? '', /Terça/)
    assert.match(hoursProblem([{ weekday: 2, opensAt: '18:00', closesAt: '18:00' }]) ?? '', /iguais/)
  })
  it('senha: mesmo mínimo do servidor', () => {
    assert.ok(passwordHint('curta'))
    assert.equal(passwordHint('uma frase comprida'), null)
  })
  it('registro legível, sem expor dado de cliente', () => {
    const e = { id: 1, at: '', action: 'order.status', entity: 'order', entityId: '9', meta: { code: 'CEM-AAAAAA', from: 'received', to: 'preparing' }, user: null }
    assert.equal(auditDetail(e), 'CEM-AAAAAA: Recebido → Em preparo')
    const p = { ...e, action: 'product.update', meta: { slug: 'brisket', before: { priceCents: 4900 }, after: { priceCents: 5200 } } }
    assert.equal(auditDetail(p), 'brisket: priceCents R$ 49,00 → R$ 52,00')
    const s = { ...e, action: 'setting.update', entityId: 'pickup_eta_minutes', meta: { before: null, after: 25 } }
    assert.equal(auditDetail(s), 'pickup_eta_minutes: não definido → 25')
  })
})

describe('painel: situação do pagamento online', () => {
  it('pagamento na entrega não gera aviso', () => {
    assert.equal(paymentNote('cash_on_delivery', 'pending', 'received'), null)
  })
  it('online: aguardando, pago, recusado, em análise e estorno', () => {
    assert.match(paymentNote('pix', 'pending', 'awaiting_payment')!.text, /não preparar/)
    assert.deepEqual(paymentNote('card_online', 'approved', 'received'), { text: '✓ Pago online', alerta: false })
    assert.equal(paymentNote('pix', 'in_review', 'awaiting_payment')!.alerta, true)
    assert.equal(paymentNote('pix', 'refunded', 'completed')!.alerta, true)
    assert.match(paymentNote('pix', 'declined', 'awaiting_payment')!.text, /recusado/)
  })
  it('cancelado com pagamento aprovado pede estorno', () => {
    const n = paymentNote('pix', 'approved', 'cancelled')!
    assert.ok(n.alerta && /estorno/.test(n.text))
  })
})

describe('painel: eventos', () => {
  const draft = { isEvent: true, title: 'Halloween no Cemita', date: '2026-10-31', time: null, endTime: null, summary: 'Som ao vivo', description: null, highlights: ['Concurso de fantasias', 'Monstros à solta'], reservation: 'Reservas pelo direct ou WhatsApp', confidence: 'media' as const, notes: null, warnings: [] }

  it('IA preenche só o que leu, sem apagar o que a pessoa já digitou', () => {
    const f = mergeDraft({ ...EMPTY_EVENT, time: '21:00', instagramUrl: 'https://www.instagram.com/p/abc/' }, draft)
    assert.equal(f.title, 'Halloween no Cemita')
    assert.equal(f.time, '21:00')
    assert.equal(f.highlights, 'Concurso de fantasias\nMonstros à solta')
    assert.equal(f.instagramUrl, 'https://www.instagram.com/p/abc/')
  })

  it('confere nome, data, horário e link antes de salvar', () => {
    const p = eventProblems({ ...EMPTY_EVENT, instagramUrl: 'https://outro.site/p/x' })
    assert.ok(p.title && p.date && p.time && p.instagramUrl)
    assert.deepEqual(eventProblems({ ...EMPTY_EVENT, title: 'Stand-up', date: '2026-11-07', time: '21:00', instagramUrl: 'https://www.instagram.com/p/DQ1x/?igsh=abc' }), {})
  })

  it('corpo enviado: destaques sem marcadores, vazios viram null, imagem só quando mudou', () => {
    const b = eventToBody({ ...EMPTY_EVENT, title: ' Stand-up ', date: '2026-11-07', time: '21:00', highlights: '- Ingresso na porta\n\n• Mesa reservada ' }, 'published')
    assert.deepEqual(b.highlights, ['Ingresso na porta', 'Mesa reservada'])
    assert.equal(b.title, 'Stand-up')
    assert.equal(b.summary, null)
    assert.equal(b.endTime, null)
    assert.ok(!('image' in b))
    assert.equal(eventToBody({ ...EMPTY_EVENT, image: null }, 'draft').image, null)
  })

  it('data por extenso curta', () => {
    assert.equal(eventWhen('2026-10-31', '20:00'), 'sáb 31/10 · 20h')
    assert.equal(eventWhen('2026-11-07', '21:30'), 'sáb 07/11 · 21h30')
  })
})

describe('painel: cupom impresso', () => {
  const o = {
    id: 1, code: 'CEM-ABC234', status: 'received', statusLabel: '', version: 1, fulfillment: 'delivery', source: 'site',
    customerName: 'Cliente Teste', customerPhone: '(47) 99999-0000',
    address: { cep: '89203001', street: 'Rua de Teste', number: '10', complement: 'casa 2', neighborhood: 'Bairro de Teste', reference: 'portão marrom' },
    deliveryZoneName: null, neighborhood: 'Bairro de Teste',
    items: [{ name: 'Burger Cemita', quantity: 1, note: 'sem cebola', lineTotalCents: 7799, options: [{ group: 'x', name: 'Combo + Coca-Cola' }, { group: 'y', name: 'Vermelha por dentro' }] }],
    notes: 'tocar a campainha', subtotalCents: 7799, discountCents: 0, deliveryFeeCents: 500, totalCents: 8299,
    paymentMethod: 'cash_on_delivery', changeForCents: 10000, paymentStatus: 'pending', hasAdultItems: false, cancelReason: null,
    placedAt: '2026-10-31T23:05:00.000Z', history: [],
  } as unknown as AdminOrder
  const text = (lines: { text: string }[]) => lines.map((l) => l.text).join('\n')

  it('cozinha: itens, opções e observações; sem telefone nem endereço', () => {
    const t = text(ticketLines(o, false))
    assert.match(t, /CEM-ABC234/)
    assert.match(t, /1x Burger Cemita\n   \+ Combo \+ Coca-Cola\n   \+ Vermelha por dentro\n   OBS: sem cebola/)
    assert.match(t, /OBS DO PEDIDO: tocar a campainha/)
    assert.doesNotMatch(t, /99999|Rua de Teste/)
  })
  it('atendimento/entrega: com contato, endereço, total e troco', () => {
    const t = text(ticketLines(o, true))
    assert.match(t, /Tel: \(47\) 99999-0000/)
    assert.match(t, /Rua de Teste, 10 - casa 2/)
    assert.match(t, /CEP 89203-001/)
    assert.match(t, /Troco para R\$\s?100,00 \(levar R\$\s?17,01\)/)
  })
})
