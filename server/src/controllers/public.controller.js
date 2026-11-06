import { AppError } from '../utils/errors.js'
import { idempotencyKey as keySchema, publicCode as codeSchema } from '../validators/common.js'

/** Controllers públicos: só traduzem HTTP. As regras moram nos serviços. */
export function createPublicController({ catalog, store, quotes, orders, payments }) {
  const code = (req) => {
    const r = codeSchema.safeParse(req.params.code)
    if (!r.success) throw new AppError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    return r.data
  }
  const token = (req) => req.get('x-tracking-token') ?? ''

  return {
    async catalog(_req, res) {
      res.set('Cache-Control', 'public, max-age=30').json({ categories: await catalog.list() })
    },

    async storeStatus(_req, res) {
      res.set('Cache-Control', 'no-store').json(await store.status())
    },

    async quote(req, res) {
      const [q, st] = await Promise.all([quotes.quote(req.valid), store.status()])
      res.set('Cache-Control', 'no-store').json({
        ...q,
        lines: q.lines.map(({ isAdult, ...l }) => ({ ...l, isAdult })),
        store: { acceptsOrders: st.acceptsOrders, reasons: st.reasons, paymentMethods: st.paymentMethods, deliveryAvailable: st.fulfillment.delivery.available },
      })
    },

    async createOrder(req, res) {
      const k = keySchema.safeParse(req.get('idempotency-key') ?? '')
      if (!k.success) throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Envie o cabeçalho Idempotency-Key (16 a 64 caracteres).')
      const result = await orders.create(req.valid, k.data)
      res
        .status(result.replayed ? 200 : 201)
        .set('Cache-Control', 'no-store')
        .json(result)
    },

    async getOrder(req, res) {
      res.set('Cache-Control', 'no-store').json({ order: await orders.getForCustomer(code(req), token(req)) })
    },

    async cancelOrder(req, res) {
      res.set('Cache-Control', 'no-store').json({ order: await orders.cancelByCustomer(code(req), token(req)) })
    },

    async payOrder(req, res) {
      res.set('Cache-Control', 'no-store').json(await orders.payByCustomer(code(req), token(req)))
    },

    async paymentWebhook(req, res) {
      const lower = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]))
      const r = await payments.handleWebhook({ query: req.query, headers: lower, body: req.body ?? {} })
      res.status(200).json({ ok: true, outcome: r.outcome })
    },
  }
}
