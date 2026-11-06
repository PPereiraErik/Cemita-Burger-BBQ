import express from 'express'
import { createHealthController } from '../controllers/health.controller.js'
import { createPublicController } from '../controllers/public.controller.js'
import { validateBody } from '../middlewares/validate.js'
import { createCatalogService } from '../services/catalog.service.js'
import { createHealthService } from '../services/health.service.js'
import { createOrderService } from '../services/order.service.js'
import { createOrderTransitionService } from '../services/orderTransition.service.js'
import { createQuoteService } from '../services/quote.service.js'
import { createStoreService } from '../services/store.service.js'
import { createAdminService } from '../services/admin.service.js'
import { createAuditService } from '../services/audit.service.js'
import { createAuthService } from '../services/auth.service.js'
import { createAdminRouter } from './admin.js'
import { orderSchema, quoteSchema } from '../validators/cart.js'
import { createMercadoPago } from '../payments/mercadopago.js'
import { createPaymentService } from '../services/payment.service.js'
import { createEventsService } from '../services/events.service.js'
import { createEventExtractor } from '../ai/eventExtractor.js'
import { idParam } from '../validators/admin.js'
import { AppError } from '../utils/errors.js'

/** IA dos eventos a partir do ambiente (null = sem o botão "Preencher com IA"). */
export function extractorFromEnv(env) {
  return env.ANTHROPIC_API_KEY ? createEventExtractor({ apiKey: env.ANTHROPIC_API_KEY, ...(env.AI_MODEL ? { model: env.AI_MODEL } : {}) }) : null
}

/** Gateway de pagamento a partir do ambiente (null = só pagamento na entrega/retirada). */
export function gatewayFromEnv(env) {
  if (env.PAYMENT_PROVIDER !== 'mercadopago') return null
  return createMercadoPago({ accessToken: env.MP_ACCESS_TOKEN, webhookSecret: env.MP_WEBHOOK_SECRET, siteUrl: env.PUBLIC_SITE_URL, sandbox: env.MP_SANDBOX })
}

/**
 * Rotas da API v1.
 * Públicas (cliente convidado): cardápio, estado da loja, cotação, pedido, acompanhamento, cancelamento.
 * Painel da equipe: /admin (routes/admin.js).
 * Pagamento online (Etapa 6): POST /orders/:code/pay (link de pagamento) e o webhook do gateway.
 * `gateway` pode ser injetado (testes usam um falso); sem ele, vem do ambiente.
 */
export function createApiRouter({ sequelize, models, env, clock, logger, gateway = gatewayFromEnv(env), extractor = extractorFromEnv(env) }) {
  const router = express.Router()

  const store = createStoreService({ models, clock, onlinePayments: !!gateway })
  const catalog = createCatalogService({ models })
  const quotes = createQuoteService({ models, clock })
  const transitions = createOrderTransitionService({ sequelize, models })
  const payments = createPaymentService({ sequelize, models, gateway, transitions, clock, logger })
  const orders = createOrderService({ sequelize, models, env, clock, store, quotes, transitions, payments })

  const audit = createAuditService({ models, env })
  const events = createEventsService({ models, clock, audit, store, extractor, logger })

  const health = createHealthController(createHealthService({ sequelize }))
  const pub = createPublicController({ catalog, store, quotes, orders, payments })

  router.get('/health', health.show)
  router.get('/catalog', pub.catalog)
  router.get('/store/status', pub.storeStatus)
  router.post('/cart/quote', validateBody(quoteSchema), pub.quote)
  router.post('/orders', validateBody(orderSchema), pub.createOrder)
  router.get('/orders/:code', pub.getOrder)
  router.post('/orders/:code/cancel', pub.cancelOrder)
  router.post('/orders/:code/pay', pub.payOrder)
  // aviso do gateway: servidor → servidor (sem Origin, fora do CORS); a assinatura é conferida no serviço
  router.post('/payments/mercadopago/webhook', pub.paymentWebhook)

  // agenda de eventos (só publicados e ainda não terminados)
  router.get('/events', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60').json({ events: await events.listPublic() })
  })
  router.get('/events/:id/image', async (req, res) => {
    const r = idParam.safeParse(req.params.id)
    if (!r.success) throw new AppError(404, 'NOT_FOUND', 'Imagem não encontrada.')
    const img = await events.image(r.data)
    // a arte é mostrada pelo site (outra origem): liberada para <img>, com cache longo (a URL muda a cada troca: ?v=)
    res.set({ 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=86400', 'Cross-Origin-Resource-Policy': 'cross-origin', 'X-Content-Type-Options': 'nosniff' }).send(img.data)
  })

  const auth = createAuthService({ models, env, clock, audit })
  const admin = createAdminService({ sequelize, models, clock, audit, store, transitions })
  router.use('/admin', createAdminRouter({ env, auth, admin, audit, clock, events }))
  return router
}
