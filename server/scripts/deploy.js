/**
 * Preparação automática a cada publicação (roda ANTES de a nova versão entrar no ar):
 *   1. aplica as migrations pendentes;
 *   2. banco novo (sem categorias): carrega o cardápio inicial. Depois disso, nunca mais mexe no
 *      cardápio: o que a equipe muda pelo painel fica;
 *   3. nenhuma conta no painel: cria a conta de administração a partir de BOOTSTRAP_ADMIN_NAME,
 *      BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD. Já existe conta: ignora essas variáveis
 *      (apague-as do servidor depois do primeiro login);
 *   4. PRIVACY_POLICY_VERSION + PRIVACY_POLICY_URL com versão nova: publica a política (as antigas
 *      ficam no histórico dos pedidos).
 * Falhou alguma coisa: sai com erro e a versão nova NÃO entra no ar (a antiga continua).
 *
 *   npm run deploy:prepare
 */
import { createSequelize } from '../src/config/database.js'
import { env as loadEnv } from '../src/config/env.js'
import { createMigrator } from '../src/db/migrator.js'
import { seedDatabase } from '../src/db/seeders/index.js'
import { policyPlan } from '../src/domain/privacyPolicy.js'
import { initModels } from '../src/models/index.js'
import { createAuditService } from '../src/services/audit.service.js'
import { createAuthService } from '../src/services/auth.service.js'
import { createLogger } from '../src/utils/logger.js'
import { passwordProblem } from '../src/utils/password.js'
import { connectionHint } from './hint.js'

const env = loadEnv()
const logger = createLogger({ level: env.LOG_LEVEL })
const sequelize = createSequelize(env)

try {
  const done = await createMigrator(sequelize, { logger }).up()
  logger.info({ applied: done.map((m) => m.name) }, done.length ? 'migrations aplicadas' : 'banco já atualizado')

  const [[{ n: categories }]] = await sequelize.query('SELECT COUNT(*) AS n FROM categories')
  if (Number(categories) === 0) {
    const counts = await seedDatabase(sequelize)
    logger.info(counts, 'banco novo: cardápio inicial carregado')
  }

  const models = initModels(sequelize)
  const users = await models.User.count()
  if (users === 0) {
    const name = env.BOOTSTRAP_ADMIN_NAME
    const email = env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase()
    const password = env.BOOTSTRAP_ADMIN_PASSWORD
    if (!name || !email || !password) {
      logger.warn('nenhuma conta no painel: defina BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD e publique de novo')
    } else {
      const problem = passwordProblem(password, { email, name })
      if (problem) throw new Error(`BOOTSTRAP_ADMIN_PASSWORD: ${problem}`)
      const audit = createAuditService({ models, env })
      const auth = createAuthService({ models, env, clock: () => new Date(), audit })
      const user = await auth.createUser({ name, email, role: 'admin', password })
      logger.warn({ email: user.email }, 'conta de administração criada: entre no painel e APAGUE as variáveis BOOTSTRAP_ADMIN_* do servidor')
    }
  }

  const plan = policyPlan(
    (await models.PrivacyPolicyVersion.findAll({ attributes: ['version'] })).map((p) => p.version),
    { version: env.PRIVACY_POLICY_VERSION, url: env.PRIVACY_POLICY_URL },
  )
  if (plan.action === 'publish') {
    await sequelize.transaction(async (transaction) => {
      await models.PrivacyPolicyVersion.update({ active: false }, { where: { active: true }, transaction })
      await models.PrivacyPolicyVersion.create({ version: plan.version, url: plan.url, publishedAt: new Date(), active: true }, { transaction })
    })
    logger.info({ version: plan.version }, 'política de privacidade publicada')
  } else if (plan.action === 'none' && !(await models.PrivacyPolicyVersion.count({ where: { active: true } }))) {
    logger.warn('sem política de privacidade: o site não aceita pedidos até definir PRIVACY_POLICY_VERSION e PRIVACY_POLICY_URL')
  }
} catch (err) {
  const hint = connectionHint(err, env)
  if (hint) console.error(hint)
  else logger.error({ err }, 'falha ao preparar a publicação')
  process.exitCode = 1
} finally {
  await sequelize.close()
}
