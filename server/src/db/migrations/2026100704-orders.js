import { ACTOR_TYPES, COUPON_TYPES, FULFILLMENTS, LIMITS, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_METHODS } from '../../domain/constants.js'
import { TABLE_OPTIONS, cents, check, fk, id, timestamps } from './_helpers.js'

/**
 * Pedidos. O pedido guarda CÓPIAS de nome e preço de tudo que foi comprado:
 * mudar o cardápio depois não muda pedido antigo.
 */
export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable(
    'coupons',
    {
      id: id(Sequelize),
      code: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      type: { type: Sequelize.ENUM(...COUPON_TYPES), allowNull: false },
      value: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, comment: 'percent: 1-100 · fixed: centavos' },
      min_subtotal_cents: cents(Sequelize, { defaultValue: 0 }),
      starts_at: { type: Sequelize.DATE, allowNull: true },
      ends_at: { type: Sequelize.DATE, allowNull: true },
      max_uses: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, comment: 'null = sem limite' },
      used_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await check(queryInterface, 'coupons', 'chk_coupons_value', "(type = 'percent' AND value BETWEEN 1 AND 100) OR (type = 'fixed' AND value >= 1)")
  await check(queryInterface, 'coupons', 'chk_coupons_uses', 'max_uses IS NULL OR used_count <= max_uses')

  await queryInterface.createTable(
    'orders',
    {
      id: id(Sequelize),
      public_code: { type: Sequelize.STRING(16), allowNull: false, unique: true },
      tracking_token_hash: { type: Sequelize.CHAR(64), allowNull: false },
      status: { type: Sequelize.ENUM(...ORDER_STATUSES), allowNull: false },
      version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, comment: 'trava otimista das transições' },
      fulfillment: { type: Sequelize.ENUM(...FULFILLMENTS), allowNull: false },
      source: { type: Sequelize.ENUM(...ORDER_SOURCES), allowNull: false, defaultValue: 'site' },
      // cliente convidado (dados pessoais: anonimizáveis)
      customer_name: { type: Sequelize.STRING(80), allowNull: true },
      customer_phone: { type: Sequelize.STRING(20), allowNull: true },
      phone_normalized: { type: Sequelize.STRING(15), allowNull: true, comment: 'só dígitos, para busca no histórico' },
      // endereço em cópia (só entrega)
      address_cep: { type: Sequelize.CHAR(8), allowNull: true },
      address_street: { type: Sequelize.STRING(120), allowNull: true },
      address_number: { type: Sequelize.STRING(12), allowNull: true },
      address_complement: { type: Sequelize.STRING(60), allowNull: true },
      address_neighborhood: { type: Sequelize.STRING(80), allowNull: true },
      address_reference: { type: Sequelize.STRING(120), allowNull: true },
      delivery_zone_id: fk(Sequelize, 'delivery_zones', { allowNull: true }),
      delivery_zone_name: { type: Sequelize.STRING(80), allowNull: true },
      // valores calculados no servidor
      subtotal_cents: cents(Sequelize),
      discount_cents: cents(Sequelize, { defaultValue: 0 }),
      delivery_fee_cents: cents(Sequelize, { defaultValue: 0 }),
      total_cents: cents(Sequelize),
      payment_method: { type: Sequelize.ENUM(...PAYMENT_METHODS), allowNull: false },
      change_for_cents: cents(Sequelize, { allowNull: true }),
      coupon_id: fk(Sequelize, 'coupons', { allowNull: true }),
      coupon_code: { type: Sequelize.STRING(30), allowNull: true },
      notes: { type: Sequelize.STRING(LIMITS.NOTE_MAX), allowNull: true },
      // consentimentos e conformidade
      adult_confirmed_at: { type: Sequelize.DATE, allowNull: true },
      privacy_policy_version_id: fk(Sequelize, 'privacy_policy_versions', { allowNull: true }),
      privacy_accepted_at: { type: Sequelize.DATE, allowNull: true },
      // anti-duplicação
      idempotency_key: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      idempotency_hash: { type: Sequelize.CHAR(64), allowNull: false },
      cancel_reason: { type: Sequelize.STRING(200), allowNull: true },
      anonymized_at: { type: Sequelize.DATE, allowNull: true },
      placed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('orders', ['status', 'placed_at'])
  await queryInterface.addIndex('orders', ['placed_at'])
  await queryInterface.addIndex('orders', ['phone_normalized'])
  await queryInterface.addIndex('orders', ['payment_method'])
  await queryInterface.addIndex('orders', ['fulfillment'])
  await check(
    queryInterface,
    'orders',
    'chk_orders_money',
    'subtotal_cents >= 0 AND discount_cents >= 0 AND delivery_fee_cents >= 0 AND total_cents >= 0 AND discount_cents <= subtotal_cents AND total_cents = subtotal_cents - discount_cents + delivery_fee_cents',
  )
  await check(queryInterface, 'orders', 'chk_orders_change', "change_for_cents IS NULL OR (payment_method = 'cash_on_delivery' AND change_for_cents >= total_cents)")

  await queryInterface.createTable(
    'order_items',
    {
      id: id(Sequelize),
      order_id: fk(Sequelize, 'orders'),
      product_id: fk(Sequelize, 'products'),
      product_name: { type: Sequelize.STRING(120), allowNull: false },
      unit_price_cents: cents(Sequelize),
      quantity: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      note: { type: Sequelize.STRING(LIMITS.NOTE_MAX), allowNull: true },
      line_total_cents: cents(Sequelize),
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await check(queryInterface, 'order_items', 'chk_order_items_qty', `quantity BETWEEN 1 AND ${LIMITS.MAX_QTY_PER_LINE}`)
  await check(queryInterface, 'order_items', 'chk_order_items_money', 'unit_price_cents >= 0 AND line_total_cents >= 0')

  await queryInterface.createTable(
    'order_item_options',
    {
      id: id(Sequelize),
      order_item_id: fk(Sequelize, 'order_items'),
      option_item_id: fk(Sequelize, 'option_items'),
      group_name: { type: Sequelize.STRING(80), allowNull: false },
      option_name: { type: Sequelize.STRING(80), allowNull: false },
      price_delta_cents: cents(Sequelize),
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await check(queryInterface, 'order_item_options', 'chk_order_item_options_money', 'price_delta_cents >= 0')

  await queryInterface.createTable(
    'order_status_history',
    {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      order_id: fk(Sequelize, 'orders'),
      from_status: { type: Sequelize.ENUM(...ORDER_STATUSES), allowNull: true },
      to_status: { type: Sequelize.ENUM(...ORDER_STATUSES), allowNull: false },
      actor_type: { type: Sequelize.ENUM(...ACTOR_TYPES), allowNull: false },
      actor_user_id: fk(Sequelize, 'users', { allowNull: true }),
      reason: { type: Sequelize.STRING(200), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('order_status_history', ['order_id', 'created_at'])
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('order_status_history')
  await queryInterface.dropTable('order_item_options')
  await queryInterface.dropTable('order_items')
  await queryInterface.dropTable('orders')
  await queryInterface.dropTable('coupons')
}
