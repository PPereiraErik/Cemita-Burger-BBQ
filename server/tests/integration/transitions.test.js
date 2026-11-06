import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { seedDatabase } from '../../src/db/seeders/index.js'
import { initModels } from '../../src/models/index.js'
import { createOrderTransitionService } from '../../src/services/orderTransition.service.js'
import { freshDatabase } from '../helpers/db.js'

/** Trava otimista: dois funcionários mudando o mesmo pedido ao mesmo tempo. */
let db, models, transitions

async function newOrder(status = 'received', fulfillment = 'pickup') {
  const code = `CEM-T${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(0, 10)
  await db.sequelize.getQueryInterface().bulkInsert('orders', [
    {
      public_code: code, tracking_token_hash: 'a'.repeat(64), status, fulfillment, subtotal_cents: 1000, total_cents: 1000,
      payment_method: 'cash_on_delivery', idempotency_key: `k-${code}`, idempotency_hash: 'b'.repeat(64),
    },
  ])
  return (await models.Order.findOne({ where: { publicCode: code } })).get({ plain: true })
}

before(async () => {
  db = await freshDatabase()
  await db.migrator.up()
  await seedDatabase(db.sequelize)
  models = initModels(db.sequelize)
  transitions = createOrderTransitionService({ sequelize: db.sequelize, models })
})
after(async () => db?.sequelize.close())

describe('mudança de status', () => {
  it('grava a mudança e o histórico', async () => {
    const o = await newOrder()
    const next = await transitions.transition(o, 'preparing', { actorType: 'staff' })
    assert.equal(next.version, 1)
    const row = await models.Order.findByPk(o.id)
    assert.equal(row.status, 'preparing')
    assert.equal(await models.OrderStatusHistory.count({ where: { orderId: o.id } }), 1)
  })
  it('dois cliques simultâneos: um vence, o outro recebe 409 e nada fica pela metade', async () => {
    const o = await newOrder()
    const results = await Promise.allSettled([
      db.sequelize.transaction((t) => transitions.transition(o, 'preparing', { actorType: 'staff', transaction: t })),
      db.sequelize.transaction((t) => transitions.transition(o, 'cancelled', { actorType: 'staff', transaction: t })),
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    const lost = results.find((r) => r.status === 'rejected')
    assert.equal(lost.reason.code, 'ORDER_CHANGED')
    assert.equal(await models.OrderStatusHistory.count({ where: { orderId: o.id } }), 1)
  })
  it('versão antiga (tela desatualizada) é recusada', async () => {
    const o = await newOrder()
    await transitions.transition(o, 'preparing', { actorType: 'staff' })
    await assert.rejects(transitions.transition(o, 'cancelled', { actorType: 'staff' }), (e) => e.code === 'ORDER_CHANGED')
  })
  it('transição fora da tabela é recusada antes de tocar o banco', async () => {
    const o = await newOrder('completed')
    await assert.rejects(transitions.transition(o, 'preparing', { actorType: 'staff' }), (e) => e.code === 'INVALID_TRANSITION')
    const pickup = await newOrder('ready', 'pickup')
    await assert.rejects(transitions.transition(pickup, 'out_for_delivery', { actorType: 'staff' }), (e) => e.code === 'INVALID_TRANSITION')
  })
})
