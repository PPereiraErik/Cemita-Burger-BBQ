import { createSequelize } from '../../src/config/database.js'
import { parseEnv } from '../../src/config/env.js'
import { createMigrator } from '../../src/db/migrator.js'

/**
 * Banco de teste. Proteção: só roda em banco cujo nome termina em _test,
 * porque os testes apagam todas as tabelas.
 */
export function testEnv() {
  const env = parseEnv({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: process.env.LOG_LEVEL ?? 'silent' })
  const dbName = env.DATABASE_URL.split('/').pop()
  if (!dbName.endsWith('_test')) throw new Error(`Recusado: os testes só rodam em banco *_test (configurado: ${dbName}). Veja .env.test.example`)
  return env
}

/** Falha cedo, com uma frase só, quando o MySQL de teste não está acessível. */
export async function assertDatabaseReachable(sequelize, env) {
  try {
    await sequelize.authenticate()
  } catch (err) {
    const where = env.DATABASE_URL.replace(/\/\/[^@]*@/, '//')
    throw new Error(`MySQL de teste inacessível em ${where} (${err.name}). Ligue o MySQL e rode docker/setup-local.sql antes do npm test.`)
  }
}

export async function freshDatabase() {
  const env = testEnv()
  const sequelize = createSequelize(env)
  await assertDatabaseReachable(sequelize, env)
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0')
  const [tables] = await sequelize.query('SHOW TABLES')
  for (const row of tables) await sequelize.query(`DROP TABLE IF EXISTS \`${Object.values(row)[0]}\``)
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1')
  const migrator = createMigrator(sequelize)
  return { env, sequelize, migrator }
}
