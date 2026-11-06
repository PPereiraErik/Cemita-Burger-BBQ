import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { productPatchSchema, settingsPatchSchema, statusChangeSchema, userCreateSchema, zoneSchema } from '../../src/validators/admin.js'

const ok = (s, v) => s.safeParse(v).success

describe('validação do painel', () => {
  it('produto: campos conhecidos, preço inteiro em centavos, nada vazio', () => {
    assert.ok(ok(productPatchSchema, { available: false }))
    assert.ok(ok(productPatchSchema, { priceCents: 3900, name: 'Smash' }))
    assert.ok(!ok(productPatchSchema, {}))
    assert.ok(!ok(productPatchSchema, { priceCents: 39.9 }))
    assert.ok(!ok(productPatchSchema, { priceCents: -1 }))
    assert.ok(!ok(productPatchSchema, { slug: 'outro' }))
  })
  it('configurações: formas de pagamento conhecidas (Pix e cartão no site incluídos); null = pendente', () => {
    assert.ok(ok(settingsPatchSchema, { orders_paused: true }))
    assert.ok(ok(settingsPatchSchema, { pickup_eta_minutes: null }))
    assert.ok(ok(settingsPatchSchema, { payment_methods_enabled: ['cash_on_delivery'] }))
    assert.ok(ok(settingsPatchSchema, { payment_methods_enabled: ['pix', 'card_online', 'cash_on_delivery'] }))
    assert.ok(!ok(settingsPatchSchema, { payment_methods_enabled: ['boleto'] }))
    assert.ok(!ok(settingsPatchSchema, { ordering_mode: 'outro' }))
    assert.ok(!ok(settingsPatchSchema, { store_timezone: 'UTC' }))
  })
  it('status: versão obrigatória', () => {
    assert.ok(ok(statusChangeSchema, { to: 'preparing', version: 2 }))
    assert.ok(!ok(statusChangeSchema, { to: 'preparing' }))
    assert.ok(!ok(statusChangeSchema, { to: 'voando', version: 1 }))
  })
  it('zona: bairros ou faixa de CEP coerente; prazo mínimo ≤ máximo', () => {
    const base = { name: 'Zona X', feeCents: 500, etaMinMinutes: 30, etaMaxMinutes: 50 }
    assert.ok(ok(zoneSchema, { ...base, matchType: 'neighborhood', neighborhoods: ['Centro'] }))
    assert.ok(!ok(zoneSchema, { ...base, matchType: 'neighborhood' }))
    assert.ok(ok(zoneSchema, { ...base, matchType: 'cep_range', cepStart: '89200-000', cepEnd: '89209-999' }))
    assert.ok(!ok(zoneSchema, { ...base, matchType: 'cep_range', cepStart: '89209999', cepEnd: '89200000' }))
    assert.ok(!ok(zoneSchema, { ...base, matchType: 'neighborhood', neighborhoods: ['Centro'], etaMinMinutes: 60 }))
  })
  it('conta: papel da lista e e-mail válido', () => {
    assert.ok(ok(userCreateSchema, { name: 'Ana', email: 'ANA@x.com', role: 'kitchen', password: 'x' }))
    assert.equal(userCreateSchema.parse({ name: 'Ana', email: ' ANA@x.com ', role: 'kitchen', password: 'x' }).email, 'ana@x.com')
    assert.ok(!ok(userCreateSchema, { name: 'Ana', email: 'ana', role: 'kitchen', password: 'x' }))
    assert.ok(!ok(userCreateSchema, { name: 'Ana', email: 'ana@x.com', role: 'dono', password: 'x' }))
  })
})
