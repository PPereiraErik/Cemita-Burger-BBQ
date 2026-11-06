import { PAYMENT_METHODS, PAYMENT_STATUSES } from '../../domain/constants.js'
import { TABLE_OPTIONS, cents, check, fk, id, timestamps } from './_helpers.js'

/**
 * Pagamentos. Nenhum dado de cartão é guardado: só os IDs do gateway.
 * provider = 'on_delivery' para dinheiro/maquininha na entrega.
 */
export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable(
    'payments',
    {
      id: id(Sequelize),
      order_id: fk(Sequelize, 'orders'),
      provider: { type: Sequelize.STRING(30), allowNull: false },
      method: { type: Sequelize.ENUM(...PAYMENT_METHODS), allowNull: false },
      provider_payment_id: { type: Sequelize.STRING(120), allowNull: true },
      status: { type: Sequelize.ENUM(...PAYMENT_STATUSES), allowNull: false },
      amount_cents: cents(Sequelize),
      currency: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'BRL' },
      raw_status: { type: Sequelize.STRING(60), allowNull: true, comment: 'status como o gateway chama' },
      expires_at: { type: Sequelize.DATE, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('payments', ['provider', 'provider_payment_id'], { unique: true, name: 'uq_payments_provider_id' })
  await queryInterface.addIndex('payments', ['order_id'])
  await check(queryInterface, 'payments', 'chk_payments_amount', 'amount_cents >= 0')

  await queryInterface.createTable(
    'payment_events',
    {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      provider: { type: Sequelize.STRING(30), allowNull: false },
      provider_event_id: { type: Sequelize.STRING(120), allowNull: false },
      payment_id: fk(Sequelize, 'payments', { allowNull: true }),
      type: { type: Sequelize.STRING(60), allowNull: false },
      received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      processed_at: { type: Sequelize.DATE, allowNull: true },
      outcome: { type: Sequelize.STRING(40), allowNull: true },
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('payment_events', ['provider', 'provider_event_id'], { unique: true, name: 'uq_payment_events_provider_event' })
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('payment_events')
  await queryInterface.dropTable('payments')
}
