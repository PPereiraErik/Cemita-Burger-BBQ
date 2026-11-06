/** Peças comuns das migrations (não é uma migration: o nome não segue o padrão). */
export const TABLE_OPTIONS = { charset: 'utf8mb4', collate: 'utf8mb4_0900_ai_ci', engine: 'InnoDB' }

export const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
})

export const id = (Sequelize) => ({ type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })

/** Chave estrangeira que NUNCA apaga em cascata (histórico de pedido não some). */
export const fk = (Sequelize, table, { allowNull = false } = {}) => ({
  type: Sequelize.INTEGER.UNSIGNED,
  allowNull,
  references: { model: table, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: allowNull ? 'SET NULL' : 'RESTRICT',
})

export const cents = (Sequelize, { allowNull = false, defaultValue } = {}) => ({
  type: Sequelize.INTEGER,
  allowNull,
  ...(defaultValue !== undefined ? { defaultValue } : {}),
})

export async function check(queryInterface, table, name, expr) {
  await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` CHECK (${expr})`)
}
