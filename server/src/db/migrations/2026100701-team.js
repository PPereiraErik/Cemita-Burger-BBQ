import { ROLES } from '../../domain/constants.js'
import { TABLE_OPTIONS, fk, id, timestamps } from './_helpers.js'

/** Equipe, sessões do painel e auditoria. Nenhuma conta é criada aqui. */
export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable(
    'users',
    {
      id: id(Sequelize),
      name: { type: Sequelize.STRING(80), allowNull: false },
      email: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role: { type: Sequelize.ENUM(...ROLES), allowNull: false },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      failed_logins: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      locked_until: { type: Sequelize.DATE, allowNull: true },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )

  await queryInterface.createTable(
    'sessions',
    {
      sid: { type: Sequelize.STRING(128), primaryKey: true },
      user_id: fk(Sequelize, 'users', { allowNull: true }),
      expires: { type: Sequelize.DATE, allowNull: false },
      data: { type: Sequelize.TEXT, allowNull: false },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('sessions', ['expires'])

  await queryInterface.createTable(
    'audit_logs',
    {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: fk(Sequelize, 'users', { allowNull: true }),
      action: { type: Sequelize.STRING(64), allowNull: false },
      entity: { type: Sequelize.STRING(40), allowNull: false },
      entity_id: { type: Sequelize.STRING(40), allowNull: true },
      meta: { type: Sequelize.JSON, allowNull: true, comment: 'Sem dados pessoais do cliente' },
      ip_hash: { type: Sequelize.CHAR(64), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('audit_logs', ['entity', 'entity_id'])
  await queryInterface.addIndex('audit_logs', ['created_at'])
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('audit_logs')
  await queryInterface.dropTable('sessions')
  await queryInterface.dropTable('users')
}
