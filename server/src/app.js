import express from 'express'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { cors } from './middlewares/cors.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import { requestId } from './middlewares/requestId.js'
import { initModels } from './models/index.js'
import { createApiRouter } from './routes/index.js'
import { createSiteRouter } from './site/router.js'

/**
 * Monta o app Express sem abrir porta (os testes usam a mesma função, com relógio fixo).
 * Ordem: id da requisição → log → CORS (só as origens do site) → cabeçalhos de segurança → JSON limitado → rotas → 404 → erro.
 * Webhook de pagamento (Etapa 6): a assinatura do Mercado Pago usa o id da URL e cabeçalhos (não o corpo),
 * então a rota usa o mesmo parser JSON; e o corpo nunca é usado para decidir nada.
 * `gateway` (opcional): gateway de pagamento falso nos testes; sem ele, vem do ambiente.
 * `siteDir` (opcional): pasta do site já compilado (dist/). Com ela, o mesmo serviço entrega o site,
 * o painel e a API na mesma origem (produção). Sem ela, só a API (desenvolvimento e testes).
 */
export function createApp({ env, sequelize, logger, clock = () => new Date(), gateway, extractor, siteDir }) {
  // Não basta "sequelize.models não está vazio": o Umzug registra o próprio model de controle
  // das migrations (SequelizeMeta) na mesma instância. Conferimos um model nosso.
  const models = sequelize.isDefined('Order') ? sequelize.models : initModels(sequelize)
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY)

  app.use(requestId())
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  )
  app.use(cors(env.CORS_ORIGINS))
  const apiHelmet = helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } })
  // com o site junto, a API mantém a política dela e o site tem a própria (createSiteRouter)
  if (siteDir) app.use('/api', apiHelmet)
  else app.use(apiHelmet)
  // eventos do painel levam a arte (já reduzida no navegador): só essas rotas aceitam corpo maior
  app.use('/api/v1/admin/events', express.json({ limit: '3mb', strict: true }))
  app.use(express.json({ limit: '20kb', strict: true }))

  app.use('/api/v1', createApiRouter({ sequelize, models, env, clock, logger, ...(gateway !== undefined ? { gateway } : {}), ...(extractor !== undefined ? { extractor } : {}) }))

  if (siteDir) app.use(createSiteRouter(siteDir))

  app.use(notFoundHandler)
  app.use(errorHandler(logger))
  return app
}
