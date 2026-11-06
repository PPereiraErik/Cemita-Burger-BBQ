import { UniqueConstraintError } from 'sequelize'
import { ORDER_STATUS as S, PAYMENT_STATUS as P } from '../domain/constants.js'
import { decidePayment, isOnline } from '../domain/payment.js'
import { AppError } from '../utils/errors.js'

const PROVIDER_DOWN = () => new AppError(502, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Não conseguimos abrir o pagamento agora. Tente de novo em instantes.')

/**
 * PAGAMENTO ONLINE (Etapa 6). O gateway é injetado (Mercado Pago em produção, um falso nos testes).
 *
 * startCheckout: cria (uma vez) a cobrança no gateway e guarda o link; o pedido passa a "aguardando pagamento".
 * handleWebhook: confere a assinatura, BUSCA o pagamento no gateway (o corpo do aviso não vale nada),
 *                e aplica decidePayment numa transação, com o pedido travado. Aviso repetido não faz efeito duas vezes.
 */
export function createPaymentService({ sequelize, models, gateway, transitions, clock, logger }) {
  const { Order, Payment, PaymentEvent, StoreSetting } = models
  const ready = !!gateway

  async function latestPayment(orderId, { transaction, lock } = {}) {
    return Payment.findOne({ where: { orderId }, order: [['id', 'DESC']], transaction, lock })
  }

  /** Prazo para pagar (configuração "payment_timeout_minutes"; vazio = sem prazo, decisão pendente da Cemita). */
  async function expiresAt() {
    const s = await StoreSetting.findByPk('payment_timeout_minutes')
    return Number.isInteger(s?.value) && s.value > 0 ? new Date(clock().getTime() + s.value * 60_000) : null
  }

  async function startCheckout(orderId) {
    if (!ready) throw PROVIDER_DOWN()
    const order = await Order.findByPk(orderId)
    const payment = order && (await latestPayment(order.id))
    if (!order || !payment || !isOnline(payment.method)) throw new AppError(409, 'NOT_AN_ONLINE_PAYMENT', 'Este pedido é pago na entrega ou na retirada.')
    if (![S.PENDING, S.AWAITING_PAYMENT].includes(order.status) || payment.status === P.APPROVED) {
      throw new AppError(409, 'PAYMENT_NOT_NEEDED', 'Este pedido não está aguardando pagamento.')
    }
    if (payment.checkoutUrl) return payment.checkoutUrl

    let created
    try {
      created = await gateway.createCheckout({ order: { publicCode: order.publicCode, totalCents: order.totalCents }, method: payment.method, expiresAt: await expiresAt() })
    } catch (err) {
      logger?.warn({ err: { message: err.message, status: err.status }, order: order.publicCode }, 'falha ao criar a cobrança no gateway')
      throw PROVIDER_DOWN()
    }

    await sequelize.transaction(async (transaction) => {
      const o = await Order.findByPk(order.id, { transaction, lock: transaction.LOCK.UPDATE })
      const p = await latestPayment(order.id, { transaction, lock: transaction.LOCK.UPDATE })
      await p.update({ providerReference: created.reference, checkoutUrl: created.checkoutUrl }, { transaction })
      if (o.status === S.PENDING) await transitions.transition(o.get({ plain: true }), S.AWAITING_PAYMENT, { actorType: 'system', reason: 'cobrança criada no gateway', transaction })
    })
    return created.checkoutUrl
  }

  /**
   * Aviso do gateway. query/headers/body como chegaram.
   * Devolve { outcome } (vira 200). Assinatura inválida → 401. Gateway fora do ar → 502 (ele tenta de novo depois).
   */
  async function handleWebhook({ query = {}, headers = {}, body = {} }) {
    if (!ready) throw new AppError(404, 'NOT_FOUND', 'Recurso não encontrado.')
    const type = query.type ?? query.topic ?? body?.type
    const dataId = query['data.id'] ?? query.id ?? body?.data?.id
    if (!gateway.verify({ xSignature: headers['x-signature'], xRequestId: headers['x-request-id'], dataId: dataId == null ? '' : String(dataId) })) {
      throw new AppError(401, 'INVALID_SIGNATURE', 'Assinatura inválida.')
    }
    if (type !== 'payment' || !dataId) return { outcome: 'ignored' }

    let remote
    try {
      remote = await gateway.getPayment(String(dataId))
    } catch (err) {
      logger?.warn({ err: { message: err.message, status: err.status } }, 'falha ao consultar o pagamento no gateway')
      throw PROVIDER_DOWN()
    }
    const eventId = `${remote.id}:${remote.rawStatus}`.slice(0, 120)

    try {
      return await sequelize.transaction(async (transaction) => {
        const seen = await PaymentEvent.findOne({ where: { provider: gateway.provider, providerEventId: eventId }, transaction })
        if (seen) return { outcome: 'duplicate' }

        const order = remote.externalReference ? await Order.findOne({ where: { publicCode: remote.externalReference }, transaction, lock: transaction.LOCK.UPDATE }) : null
        const payment = order ? await latestPayment(order.id, { transaction, lock: transaction.LOCK.UPDATE }) : null
        const record = (outcome, paymentId = null) =>
          PaymentEvent.create({ provider: gateway.provider, providerEventId: eventId, paymentId, type: `payment.${remote.rawStatus}`.slice(0, 60), processedAt: clock(), outcome }, { transaction })

        if (!order || !payment || !isOnline(payment.method)) {
          await record('order_not_found')
          return { outcome: 'order_not_found' }
        }

        const d = decidePayment({ order: order.get({ plain: true }), payment: payment.get({ plain: true }), remote })
        if (d.paymentPatch) await payment.update(d.paymentPatch, { transaction })
        let current = order.get({ plain: true })
        for (const to of d.orderPath) {
          current = await transitions.transition(current, to, { actorType: 'gateway', reason: to === S.RECEIVED ? 'pago online: vai para a cozinha' : 'pagamento confirmado pelo gateway', transaction })
        }
        await record(d.outcome, payment.id)
        if (d.outcome === 'amount_mismatch' || d.outcome === 'approved_after_cancel') logger?.warn({ order: order.publicCode, outcome: d.outcome }, 'pagamento precisa de conferência')
        return { outcome: d.outcome }
      })
    } catch (err) {
      // dois avisos iguais ao mesmo tempo: o segundo bate na chave única do evento
      if (err instanceof UniqueConstraintError) return { outcome: 'duplicate' }
      throw err
    }
  }

  return { ready, provider: gateway?.provider ?? null, startCheckout, handleWebhook }
}
