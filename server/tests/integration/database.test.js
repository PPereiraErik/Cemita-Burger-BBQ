import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { seedDatabase } from '../../src/db/seeders/index.js'
import { initModels } from '../../src/models/index.js'
import { freshDatabase } from '../helpers/db.js'

/**
 * Banco de verdade (MySQL de teste). Apaga e recria tudo em cemita_test.
 */
const EXPECTED_TABLES = [
  'audit_logs', 'categories', 'coupons', 'delivery_zones', 'events', 'option_groups', 'option_items', 'order_item_options',
  'order_items', 'order_status_history', 'orders', 'payment_events', 'payments', 'privacy_policy_versions',
  'product_option_groups', 'products', 'schema_migrations', 'sessions', 'store_hours', 'store_settings', 'users',
]

let sequelize, migrator, models

const tables = async () => (await sequelize.query('SHOW TABLES'))[0].map((r) => Object.values(r)[0]).sort()
const count = async (table) => Number((await sequelize.query(`SELECT COUNT(*) AS n FROM \`${table}\``))[0][0].n)

/** Pedido mínimo válido, inserido direto (o serviço de pedidos chega na Etapa 2). */
async function insertOrder(overrides = {}) {
  const row = {
    public_code: `T${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    tracking_token_hash: 'a'.repeat(64),
    status: 'pending',
    fulfillment: 'pickup',
    subtotal_cents: 3900,
    discount_cents: 0,
    delivery_fee_cents: 0,
    total_cents: 3900,
    payment_method: 'cash_on_delivery',
    idempotency_key: `k-${Math.random().toString(36).slice(2)}`,
    idempotency_hash: 'b'.repeat(64),
    ...overrides,
  }
  await sequelize.getQueryInterface().bulkInsert('orders', [row])
  return (await sequelize.query('SELECT id FROM orders WHERE public_code = ?', { replacements: [row.public_code] }))[0][0].id
}

before(async () => {
  ;({ sequelize, migrator } = await freshDatabase())
})
after(async () => sequelize?.close())

describe('migrations', () => {
  it('criam as 20 tabelas (+ controle de migrations)', async () => {
    const applied = await migrator.up()
    assert.equal(applied.length, 7)
    assert.deepEqual(await tables(), EXPECTED_TABLES)
  })

  it('desfazem tudo e refazem do zero (reversíveis em desenvolvimento)', async () => {
    await migrator.down({ to: 0 })
    assert.deepEqual(await tables(), ['schema_migrations'])
    await migrator.up()
    assert.deepEqual(await tables(), EXPECTED_TABLES)
    assert.equal((await migrator.pending()).length, 0)
  })
})

describe('seed do cardápio atual', () => {
  it('carrega categorias, produtos, horário e configurações', async () => {
    const counts = await seedDatabase(sequelize)
    assert.deepEqual(counts, { categories: 9, products: 56, optionGroups: 11, optionItems: 41, hours: 6, settings: 8 })
  })

  it('não cria usuário, zona, cupom nem política de privacidade', async () => {
    for (const t of ['users', 'delivery_zones', 'coupons', 'privacy_policy_versions', 'orders']) assert.equal(await count(t), 0, t)
  })

  it('o combo antigo (sem bebida) continua inativo; combo com bebida e adicionais entram ativos', async () => {
    const [[g]] = await sequelize.query("SELECT active, pending_review FROM option_groups WHERE `key` = 'combo'")
    assert.equal(Number(g.active), 0)
    assert.equal(Number(g.pending_review), 1)
    const [[cb]] = await sequelize.query("SELECT active, pending_review, min_select, max_select FROM option_groups WHERE `key` = 'combo-bebida'")
    assert.deepEqual([Number(cb.active), Number(cb.pending_review), cb.min_select, cb.max_select], [1, 0, 0, 1])
    const [[pt]] = await sequelize.query("SELECT min_select, max_select FROM option_groups WHERE `key` = 'ponto'")
    assert.deepEqual([pt.min_select, pt.max_select], [1, 1])
    assert.equal(await count('option_groups'), 11)
    assert.equal(await count('product_option_groups'), 116)
  })

  it('é idempotente e não sobrescreve o que foi mudado depois', async () => {
    await sequelize.query("UPDATE products SET price_cents = 4100, available = 0 WHERE slug = 'smash-rib'")
    await sequelize.query("UPDATE store_settings SET value = CAST('true' AS JSON) WHERE `key` = 'orders_paused'")
    const counts = await seedDatabase(sequelize)
    assert.deepEqual(counts, { categories: 9, products: 56, optionGroups: 11, optionItems: 41, hours: 6, settings: 8 })
    const [[p]] = await sequelize.query("SELECT price_cents, available FROM products WHERE slug = 'smash-rib'")
    assert.equal(p.price_cents, 4100)
    assert.equal(Number(p.available), 0)
    const [[s]] = await sequelize.query("SELECT value FROM store_settings WHERE `key` = 'orders_paused'")
    assert.equal(s.value, true)
    assert.equal(await count('option_items'), 41)
    assert.equal(await count('product_option_groups'), 116)
  })

  it('configurações pendentes ficam NULL no banco', async () => {
    const [rows] = await sequelize.query("SELECT `key` FROM store_settings WHERE value IS NULL ORDER BY `key`")
    assert.deepEqual(
      rows.map((r) => r.key),
      ['data_retention_days', 'min_order_cents', 'payment_timeout_minutes', 'pickup_eta_minutes'],
    )
  })
})

describe('regras garantidas pelo próprio banco', () => {
  it('recusa preço negativo', async () => {
    await assert.rejects(sequelize.query("UPDATE products SET price_cents = -1 WHERE slug = 'brisket'"))
  })

  it('recusa total que não fecha com subtotal, desconto e taxa', async () => {
    await assert.rejects(insertOrder({ total_cents: 1 }))
    await assert.rejects(insertOrder({ discount_cents: 5000, total_cents: 0 }))
  })

  it('recusa troco menor que o total ou troco fora do pagamento em dinheiro', async () => {
    await assert.rejects(insertOrder({ change_for_cents: 1000 }))
    await assert.rejects(insertOrder({ payment_method: 'card_on_delivery', change_for_cents: 5000 }))
    await insertOrder({ change_for_cents: 5000 })
  })

  it('recusa a mesma chave de idempotência duas vezes (pedido duplicado)', async () => {
    await insertOrder({ idempotency_key: 'chave-unica' })
    await assert.rejects(insertOrder({ idempotency_key: 'chave-unica' }), /Duplicate|unique/i)
  })

  it('recusa quantidade fora de 1 a 20', async () => {
    const orderId = await insertOrder()
    const [[prod]] = await sequelize.query("SELECT id, name, price_cents FROM products WHERE slug = 'brisket'")
    const line = (quantity) => ({ order_id: orderId, product_id: prod.id, product_name: prod.name, unit_price_cents: prod.price_cents, quantity, line_total_cents: prod.price_cents * Math.max(quantity, 0) })
    const qi = sequelize.getQueryInterface()
    await assert.rejects(qi.bulkInsert('order_items', [line(0)]))
    await assert.rejects(qi.bulkInsert('order_items', [line(21)]))
    await qi.bulkInsert('order_items', [line(2)])
  })

  it('não deixa apagar produto que já está em pedido (histórico preservado)', async () => {
    await assert.rejects(sequelize.query("DELETE FROM products WHERE slug = 'brisket'"), /foreign key/i)
  })
})

describe('models', () => {
  before(() => {
    models = initModels(sequelize)
  })

  it('leem o cardápio com a categoria', async () => {
    const p = await models.Product.findOne({ where: { slug: 'smash-rib' }, include: [{ model: models.Category, as: 'category' }] })
    assert.equal(p.category.slug, 'smash')
    assert.equal(p.orderable, true)
  })

  it('validam antes de gravar (total errado não chega ao banco)', async () => {
    await assert.rejects(
      models.Order.create({
        publicCode: 'VALID1', trackingTokenHash: 'c'.repeat(64), status: 'pending', fulfillment: 'pickup',
        subtotalCents: 1000, totalCents: 999, paymentMethod: 'cash_on_delivery', idempotencyKey: 'v1', idempotencyHash: 'd'.repeat(64),
      }),
      /total não confere/,
    )
  })

  it('nunca devolvem o hash da senha por padrão', async () => {
    await models.User.scope('withPassword').create({ name: 'Teste', email: 'teste@example.com', passwordHash: 'x'.repeat(60), role: 'admin' })
    const u = await models.User.findOne({ where: { email: 'teste@example.com' } })
    assert.equal(u.passwordHash, undefined)
    const withPw = await models.User.scope('withPassword').findOne({ where: { email: 'teste@example.com' } })
    assert.equal(withPw.passwordHash.length, 60)
  })
})
