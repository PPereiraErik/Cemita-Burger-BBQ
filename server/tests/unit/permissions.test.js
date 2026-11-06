import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { can, roleCanMoveTo } from '../../src/domain/permissions.js'

describe('permissões do painel', () => {
  it('administração pode tudo', () => {
    for (const a of ['viewOrders', 'editProducts', 'editStoreSettings', 'manageZones', 'manageUsers', 'viewAudit', 'manageEvents']) assert.equal(can('admin', a), true, a)
  })
  it('atendimento: pedidos, esgotado e pausa; não mexe em preço, zonas, equipe', () => {
    for (const a of ['viewOrders', 'viewCustomerContact', 'setProductAvailability', 'pauseStore', 'manageEvents']) assert.equal(can('staff', a), true, a)
    for (const a of ['editProducts', 'editStoreSettings', 'manageZones', 'manageUsers', 'viewAudit']) assert.equal(can('staff', a), false, a)
  })
  it('cozinha: vê a fila, sem contato do cliente', () => {
    assert.equal(can('kitchen', 'viewOrders'), true)
    assert.equal(can('kitchen', 'viewCustomerContact'), false)
    assert.equal(can('kitchen', 'setProductAvailability'), false)
    assert.equal(can('kitchen', 'manageEvents'), false)
  })
  it('cozinha só leva para "em preparo" e "pronto"', () => {
    assert.equal(roleCanMoveTo('kitchen', 'preparing'), true)
    assert.equal(roleCanMoveTo('kitchen', 'ready'), true)
    for (const s of ['cancelled', 'completed', 'out_for_delivery', 'received']) assert.equal(roleCanMoveTo('kitchen', s), false, s)
    assert.equal(roleCanMoveTo('staff', 'cancelled'), true)
  })
  it('papel desconhecido e ação desconhecida: não', () => {
    assert.equal(can('visitante', 'viewOrders'), false)
    assert.equal(can('admin', 'acaoInexistente'), false)
    assert.equal(roleCanMoveTo('visitante', 'ready'), false)
  })
})
