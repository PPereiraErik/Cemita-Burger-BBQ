import fs from 'node:fs'
import path from 'node:path'
import { createApp } from './app.js'
import { createSequelize } from './config/database.js'
import { env as loadEnv, EnvError } from './config/env.js'
import { initModels } from './models/index.js'
import { createLogger } from './utils/logger.js'

/** Sobe a API e fecha com cuidado (termina as requisições em andamento, fecha o pool). */
let env
try {
  env = loadEnv()
} catch (err) {
  if (err instanceof EnvError) {
    console.error(err.message)
    process.exit(1)
  }
  throw err
}

const logger = createLogger({ level: env.LOG_LEVEL })
const sequelize = createSequelize(env, { logger })
initModels(sequelize)
// SITE_DIR: pasta do site compilado (no Docker: /app/dist). Sem ela, sobe só a API.
let siteDir
if (env.SITE_DIR) {
  siteDir = path.resolve(env.SITE_DIR)
  if (!fs.existsSync(path.join(siteDir, 'index.html'))) {
    logger.warn({ siteDir }, 'SITE_DIR sem index.html: subindo só a API')
    siteDir = undefined
  }
}
const app = createApp({ env, sequelize, logger, siteDir })

const server = app.listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV, site: Boolean(siteDir) }, siteDir ? 'Site, painel e API do Cemita no ar' : 'API do Cemita no ar'))

let closing = false
async function shutdown(signal) {
  if (closing) return
  closing = true
  logger.info({ signal }, 'encerrando')
  server.close(async () => {
    await sequelize.close().catch(() => {})
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
process.on('unhandledRejection', (err) => logger.error({ err }, 'promise rejeitada sem tratamento'))
