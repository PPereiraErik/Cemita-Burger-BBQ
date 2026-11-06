import { ZONE_MATCH_TYPES } from '../../domain/constants.js'
import { TABLE_OPTIONS, cents, check, fk, id, timestamps } from './_helpers.js'

/**
 * Configuração da loja. Estas tabelas nascem VAZIAS de dados da Cemita
 * (zonas, taxas, prazos, política): tudo é cadastrado depois, pelo painel.
 */
export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable(
    'store_hours',
    {
      id: id(Sequelize),
      weekday: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, comment: '0 = domingo … 6 = sábado' },
      opens_at: { type: Sequelize.TIME, allowNull: false },
      closes_at: { type: Sequelize.TIME, allowNull: false, comment: 'menor que opens_at = fecha depois da meia-noite' },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('store_hours', ['weekday'])
  await check(queryInterface, 'store_hours', 'chk_store_hours_weekday', 'weekday <= 6')

  await queryInterface.createTable(
    'store_settings',
    {
      key: { type: Sequelize.STRING(64), primaryKey: true },
      value: { type: Sequelize.JSON, allowNull: true, comment: 'null = pendente de definição' },
      updated_by_user_id: fk(Sequelize, 'users', { allowNull: true }),
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )

  await queryInterface.createTable(
    'delivery_zones',
    {
      id: id(Sequelize),
      name: { type: Sequelize.STRING(80), allowNull: false },
      match_type: { type: Sequelize.ENUM(...ZONE_MATCH_TYPES), allowNull: false },
      neighborhoods: { type: Sequelize.JSON, allowNull: true, comment: 'lista de bairros (match_type = neighborhood)' },
      cep_start: { type: Sequelize.CHAR(8), allowNull: true },
      cep_end: { type: Sequelize.CHAR(8), allowNull: true },
      fee_cents: cents(Sequelize),
      min_order_cents: cents(Sequelize, { defaultValue: 0 }),
      eta_min_minutes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      eta_max_minutes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await check(queryInterface, 'delivery_zones', 'chk_zones_values', 'fee_cents >= 0 AND min_order_cents >= 0 AND eta_min_minutes <= eta_max_minutes')
  await check(
    queryInterface,
    'delivery_zones',
    'chk_zones_match',
    "(match_type = 'neighborhood' AND neighborhoods IS NOT NULL) OR (match_type = 'cep_range' AND cep_start IS NOT NULL AND cep_end IS NOT NULL AND cep_start <= cep_end)",
  )

  await queryInterface.createTable(
    'privacy_policy_versions',
    {
      id: id(Sequelize),
      version: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      url: { type: Sequelize.STRING(300), allowNull: false },
      published_at: { type: Sequelize.DATE, allowNull: false },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('privacy_policy_versions')
  await queryInterface.dropTable('delivery_zones')
  await queryInterface.dropTable('store_settings')
  await queryInterface.dropTable('store_hours')
}
