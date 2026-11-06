/**
 * Comandos do banco:
 *   node scripts/db.js migrate    aplica as migrations pendentes
 *   node scripts/db.js rollback   desfaz a última (bloqueado em produção)
 *   node scripts/db.js status     lista aplicadas e pendentes
 *   node scripts/db.js seed       carrega o cardápio atual (idempotente)
 *   node scripts/db.js seed:dev   dados FICTÍCIOS para testar pedidos (bloqueado em produção)
 */
import { createSequelize } from '../src/config/database.js'
import { env as loadEnv } from '../src/config/env.js'
import { createMigrator } from '../src/db/migrator.js'
import { seedDevData } from '../src/db/seeders/dev.js'
import { seedDatabase } from '../src/db/seeders/index.js'
import { createLogger } from '../src/utils/logger.js'
import { connectionHint } from './hint.js'

const cmd = process.argv[2]
const env = loadEnv()
const logger = createLogger({ level: env.LOG_LEVEL })
const sequelize = createSequelize(env)
const migrator = createMigrator(sequelize, { logger })

try {
  if (cmd === 'migrate') {
    const done = await migrator.up()
    logger.info({ applied: done.map((m) => m.name) }, done.length ? 'migrations aplicadas' : 'nada a aplicar')
  } else if (cmd === 'rollback') {
    if (env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_ROLLBACK !== 'yes') {
      throw new Error('rollback bloqueado em produção: faça backup e defina ALLOW_PRODUCTION_ROLLBACK=yes conscientemente')
    }
    const undone = await migrator.down()
    logger.info({ reverted: undone.map((m) => m.name) }, 'rollback feito')
  } else if (cmd === 'status') {
    const [executed, pending] = await Promise.all([migrator.executed(), migrator.pending()])
    console.log('aplicadas:', executed.map((m) => m.name))
    console.log('pendentes:', pending.map((m) => m.name))
  } else if (cmd === 'seed') {
    const counts = await seedDatabase(sequelize)
    logger.info(counts, 'seed concluído')
  } else if (cmd === 'seed:dev') {
    const r = await seedDevData(sequelize, { nodeEnv: env.NODE_ENV })
    logger.warn(r, 'dados de DESENVOLVIMENTO carregados (fictícios, não usar em produção)')
  } else {
    console.error('uso: node scripts/db.js migrate | rollback | status | seed | seed:dev')
    process.exitCode = 1
  }
} catch (err) {
  const hint = connectionHint(err, env)
  if (hint) console.error(hint)
  else logger.error({ err }, 'falha no comando do banco')
  process.exitCode = 1
} finally {
  await sequelize.close()
}
