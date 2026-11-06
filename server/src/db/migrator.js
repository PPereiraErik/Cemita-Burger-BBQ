import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Sequelize } from 'sequelize'
import { SequelizeStorage, Umzug } from 'umzug'

/**
 * Migrations com Umzug (o migrador mantido pela equipe do Sequelize).
 * Cada arquivo de src/db/migrations exporta up/down e roda na ordem do nome.
 * Em produção: só para frente, com backup antes.
 */
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

export function createMigrator(sequelize, { logger } = {}) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d{10}-[a-z0-9-]+\.js$/.test(f))
    .sort()
  return new Umzug({
    migrations: files.map((file) => ({
      name: file,
      up: async ({ context }) => (await import(pathToFileURL(path.join(dir, file)).href)).up({ queryInterface: context, Sequelize }),
      down: async ({ context }) => (await import(pathToFileURL(path.join(dir, file)).href)).down({ queryInterface: context, Sequelize }),
    })),
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
    logger: logger ? { info: (m) => logger.info(m), warn: (m) => logger.warn(m), error: (m) => logger.error(m), debug: () => {} } : undefined,
  })
}
