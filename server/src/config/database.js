import { Sequelize } from 'sequelize'

/**
 * Conexão Sequelize/MySQL. Tudo em UTC; o horário da loja é calculado
 * em America/Sao_Paulo na regra de negócio, nunca no banco.
 */
export function createSequelize(env, { logger } = {}) {
  return new Sequelize(env.DATABASE_URL, {
    dialect: 'mysql',
    timezone: '+00:00',
    logging: env.LOG_LEVEL === 'trace' && logger ? (sql) => logger.trace({ sql }, 'sql') : false,
    pool: { max: env.DB_POOL_MAX, min: 0, acquire: 15_000, idle: 10_000 },
    dialectOptions: {
      charset: 'utf8mb4',
      dateStrings: false,
      decimalNumbers: true,
      ...(env.DB_SSL ? { ssl: { rejectUnauthorized: true } } : {}),
    },
    define: { underscored: true, charset: 'utf8mb4', collate: 'utf8mb4_0900_ai_ci' },
  })
}
