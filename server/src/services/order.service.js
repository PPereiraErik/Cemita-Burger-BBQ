import { UniqueConstraintError } from 'sequelize'
import { ORDER_STATUS as S } from '../domain/constants.js'
import { customerCanCancel, ON_DELIVERY_METHODS, STATUS_LABEL } from '../domain/orderStatus.js'
import { isOnline, paymentView } from '../domain/payment.js'
import { AppError, notFound } from '../utils/errors.js'
import { affectedRows } from './orderTransition.service.js'
import { canonicalJson, newPublicCode, sameHash, sha256, trackingToken } from '../utils/ids.js'

const STORE_ERRORS = {
  ORDERING_DISABLED: [409, 'Os pedidos pelo site ainda não estão ativos. Use o delivery.'],
  STORE_PAUSED: [409, 'A cozinha pausou os pedidos por alguns minutos.'],
  STORE_CLOSED: [409, 'Estamos fechados agora.'],
  PRIVACY_POLICY_MISSING: [409, 'Os pedidos pelo site ainda não estão ativos.'],
  NO_PAYMENT_METHOD: [409, 'Os pedidos pelo site ainda não estão ativos.'],
}

/**
 * Criação, consulta e cancelamento de pedidos pelo cliente (convidado, sem conta).
 * Tudo que tem valor é recalculado aqui, a partir do banco.
 */
export function createOrderService({ sequelize, models, env, clock, store, quotes, transitions, payments = null }) {
  const { Order, OrderItem, OrderItemOption, OrderStatusHistory, Payment, Coupon } = models

  const includeAll = [
    { model: OrderItem, as: 'items', include: [{ model: OrderItemOption, as: 'options' }] },
    { model: Payment, as: 'payments' },
    { model: OrderStatusHistory, as: 'history' },
  ]

  /** O que o cliente vê do próprio pedido (sem telefone e sem endereço completo). */
  function publicView(o) {
    return {
      code: o.publicCode,
      status: o.status,
      statusLabel: STATUS_LABEL[o.status],
      fulfillment: o.fulfillment,
      deliveryZoneName: o.deliveryZoneName,
      neighborhood: o.addressNeighborhood,
      items: (o.items ?? [])
        .sort((a, b) => a.id - b.id)
        .map((i) => ({
          name: i.productName,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          lineTotalCents: i.lineTotalCents,
          note: i.note,
          options: (i.options ?? []).map((x) => ({ group: x.groupName, name: x.optionName, priceDeltaCents: x.priceDeltaCents })),
        })),
      subtotalCents: o.subtotalCents,
      discountCents: o.discountCents,
      deliveryFeeCents: o.deliveryFeeCents,
      totalCents: o.totalCents,
      paymentMethod: o.paymentMethod,
      changeForCents: o.changeForCents,
      placedAt: o.placedAt,
      history: (o.history ?? []).sort((a, b) => Number(a.id) - Number(b.id)).map((h) => ({ status: h.toStatus, label: STATUS_LABEL[h.toStatus], at: h.createdAt })),
      canCancel: customerCanCancel(o),
      payment: paymentView((o.payments ?? []).sort((a, b) => b.id - a.id)[0] ?? null, o.status),
    }
  }

  async function findReplay(idempotencyKey, requestHash) {
    const existing = await Order.findOne({ where: { idempotencyKey }, include: includeAll })
    if (!existing) return null
    if (existing.idempotencyHash !== requestHash) {
      throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Esta chave já foi usada em outro pedido. Gere uma nova para um pedido diferente.')
    }
    return { order: publicView(existing), trackingToken: trackingToken(env.TRACKING_TOKEN_SECRET, existing.publicCode, idempotencyKey), replayed: true }
  }

  /**
   * Pedido online ainda sem link de pagamento (acabou de ser criado, ou a criação da cobrança falhou antes):
   * cria a cobrança agora. Se o gateway falhar, o pedido continua salvo e o cliente tenta de novo pelo
   * acompanhamento ("Pagar agora") — nada é cobrado duas vezes: a cobrança é uma só por pedido.
   */
  async function withCheckout(result) {
    const pay = result.order.payment
    if (!payments?.ready || !pay?.online || pay.checkoutUrl || pay.status === 'approved' || ![S.PENDING, S.AWAITING_PAYMENT].includes(result.order.status)) return result
    const row = await Order.findOne({ where: { publicCode: result.order.code }, attributes: ['id'] })
    try {
      await payments.startCheckout(row.id)
    } catch (err) {
      return { ...result, paymentError: err.message }
    }
    const fresh = await Order.findByPk(row.id, { include: includeAll })
    return { ...result, order: publicView(fresh) }
  }

  async function create(input, idempotencyKey) {
    return withCheckout(await createOrReplay(input, idempotencyKey))
  }

  async function createOrReplay(input, idempotencyKey) {
    const requestHash = sha256(canonicalJson(input))
    const replay = await findReplay(idempotencyKey, requestHash)
    if (replay) return replay

    try {
      return await sequelize.transaction(async (transaction) => {
        // 1. a loja aceita pedidos agora?
        const st = await store.status({ transaction })
        if (!st.acceptsOrders) {
          const code = st.reasons[0]
          const [http, message] = STORE_ERRORS[code] ?? [409, 'Não estamos aceitando pedidos agora.']
          throw new AppError(http, code, message)
        }
        if (input.privacyPolicyVersionId !== st.privacyPolicy.id) throw new AppError(422, 'PRIVACY_CONSENT_REQUIRED', 'Confirme a versão atual da política de privacidade.')
        if (!st.paymentMethods.includes(input.paymentMethod)) throw new AppError(422, 'PAYMENT_METHOD_UNAVAILABLE', 'Esta forma de pagamento não está disponível.')
        if (input.fulfillment === 'delivery' && !st.fulfillment.delivery.available) throw new AppError(422, 'DELIVERY_UNAVAILABLE', 'Ainda não estamos entregando pelo site. Você pode retirar no balcão.')

        // 2. valores: SEMPRE do banco
        const q = await quotes.quote(input, { transaction })
        if (!q.ok) throw new AppError(422, 'ORDER_INVALID', 'Alguns itens precisam de atenção.', { errors: q.errors })
        if (q.hasAdultItems && input.adultConfirmed !== true) throw new AppError(422, 'ADULT_CONFIRMATION_REQUIRED', 'Confirme que você tem 18 anos ou mais para pedir bebida alcoólica.')
        if (input.changeForCents != null && (input.paymentMethod !== 'cash_on_delivery' || input.changeForCents < q.totalCents)) {
          throw new AppError(422, 'INVALID_CHANGE', 'O troco precisa ser para pagamento em dinheiro e maior ou igual ao total.')
        }

        // 3. cupom: baixa atômica (nunca passa do limite, nem com pedidos simultâneos)
        if (q.coupon) {
          const [result] = await sequelize.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND active = 1 AND (max_uses IS NULL OR used_count < max_uses)', {
            replacements: [q.coupon.id],
            transaction,
          })
          if (affectedRows(result) !== 1) throw new AppError(422, 'ORDER_INVALID', 'Alguns itens precisam de atenção.', { errors: [{ code: 'COUPON_EXHAUSTED', message: 'Este cupom já atingiu o limite de usos.' }] })
        }

        // 4. grava o pedido com cópia de nomes e preços
        const now = clock()
        const a = input.address
        let order
        for (let attempt = 0; ; attempt++) {
          const publicCode = newPublicCode()
          try {
            order = await Order.create(
              {
                publicCode,
                trackingTokenHash: sha256(trackingToken(env.TRACKING_TOKEN_SECRET, publicCode, idempotencyKey)),
                status: S.PENDING,
                fulfillment: input.fulfillment,
                source: 'site',
                customerName: input.customer.name,
                customerPhone: input.customer.phone.display,
                phoneNormalized: input.customer.phone.normalized,
                addressCep: a?.cep ?? null,
                addressStreet: a?.street ?? null,
                addressNumber: a?.number ?? null,
                addressComplement: a?.complement ?? null,
                addressNeighborhood: a?.neighborhood ?? null,
                addressReference: a?.reference ?? null,
                deliveryZoneId: q.zone?.id ?? null,
                deliveryZoneName: q.zone?.name ?? null,
                subtotalCents: q.subtotalCents,
                discountCents: q.discountCents,
                deliveryFeeCents: q.deliveryFeeCents,
                totalCents: q.totalCents,
                paymentMethod: input.paymentMethod,
                changeForCents: input.changeForCents ?? null,
                couponId: q.coupon?.id ?? null,
                couponCode: q.coupon?.code ?? null,
                notes: input.notes ?? null,
                adultConfirmedAt: q.hasAdultItems ? now : null,
                privacyPolicyVersionId: st.privacyPolicy.id,
                privacyAcceptedAt: now,
                idempotencyKey,
                idempotencyHash: requestHash,
                placedAt: now,
              },
              { transaction },
            )
            break
          } catch (err) {
            const codeClash = err instanceof UniqueConstraintError && err.errors?.some((e) => e.path === 'public_code' || e.path === 'publicCode')
            if (!codeClash || attempt >= 4) throw err
          }
        }

        for (const l of q.lines) {
          const item = await OrderItem.create(
            { orderId: order.id, productId: l.productId, productName: l.productName, unitPriceCents: l.unitPriceCents, quantity: l.quantity, note: l.note, lineTotalCents: l.lineTotalCents },
            { transaction },
          )
          if (l.options.length)
            await OrderItemOption.bulkCreate(
              l.options.map((o) => ({ orderItemId: item.id, optionItemId: o.optionItemId, groupName: o.groupName, optionName: o.optionName, priceDeltaCents: o.priceDeltaCents })),
              { transaction },
            )
        }
        await OrderStatusHistory.create({ orderId: order.id, fromStatus: null, toStatus: S.PENDING, actorType: 'customer' }, { transaction })

        // 5. pagamento na entrega: o pedido já chega à cozinha como RECEBIDO
        if (ON_DELIVERY_METHODS.includes(input.paymentMethod)) {
          await Payment.create({ orderId: order.id, provider: 'on_delivery', method: input.paymentMethod, status: 'pending', amountCents: q.totalCents }, { transaction })
          await transitions.transition(order.get({ plain: true }), S.RECEIVED, { actorType: 'system', reason: 'pagamento na entrega', transaction })
        } else if (isOnline(input.paymentMethod)) {
          // pagamento online: o pedido fica PENDENTE; a cobrança é criada no gateway logo depois (fora da transação)
          // e ele só vai para a cozinha quando o webhook confirmar o pagamento
          if (!payments?.ready) throw new AppError(422, 'PAYMENT_METHOD_UNAVAILABLE', 'Esta forma de pagamento não está disponível.')
          await Payment.create({ orderId: order.id, provider: payments.provider, method: input.paymentMethod, status: 'pending', amountCents: q.totalCents }, { transaction })
        }

        const full = await Order.findByPk(order.id, { include: includeAll, transaction })
        return { order: publicView(full), trackingToken: trackingToken(env.TRACKING_TOKEN_SECRET, order.publicCode, idempotencyKey), replayed: false }
      })
    } catch (err) {
      // dois envios simultâneos com a mesma chave: o segundo recebe o pedido do primeiro
      if (err instanceof UniqueConstraintError && err.errors?.some((e) => /idempotency/.test(e.path))) {
        const again = await findReplay(idempotencyKey, requestHash)
        if (again) return again
      }
      throw err
    }
  }

  /** Busca pelo código + token. Código ou token errado = 404 (não revela se o pedido existe). */
  async function findForCustomer(publicCode, token, { transaction, lock } = {}) {
    const order = await Order.findOne({ where: { publicCode }, include: lock ? [] : includeAll, transaction, lock })
    if (!order || !token || !sameHash(order.trackingTokenHash, sha256(token))) throw notFound('Pedido')
    return order
  }

  async function getForCustomer(publicCode, token) {
    return publicView(await findForCustomer(publicCode, token))
  }

  async function cancelByCustomer(publicCode, token) {
    await sequelize.transaction(async (transaction) => {
      const order = await findForCustomer(publicCode, token, { transaction, lock: transaction.LOCK.UPDATE })
      if (!customerCanCancel(order)) throw new AppError(409, 'ORDER_CANNOT_BE_CANCELLED', 'Este pedido já está sendo preparado. Fale com a Cemita pelo WhatsApp.')
      await transitions.transition(order.get({ plain: true }), S.CANCELLED, { actorType: 'customer', reason: 'cancelado pelo cliente', transaction, extra: { cancelReason: 'cancelado pelo cliente' } })
      await Payment.update({ status: 'cancelled' }, { where: { orderId: order.id, status: 'pending' }, transaction })
      if (order.couponId) await sequelize.query('UPDATE coupons SET used_count = used_count - 1 WHERE id = ? AND used_count > 0', { replacements: [order.couponId], transaction })
    })
    return getForCustomer(publicCode, token)
  }

  /** "Pagar agora" no acompanhamento: devolve o link de pagamento (cria a cobrança se ainda não existir). */
  async function payByCustomer(publicCode, token) {
    const order = await findForCustomer(publicCode, token)
    if (!payments?.ready) throw new AppError(409, 'NOT_AN_ONLINE_PAYMENT', 'Este pedido é pago na entrega ou na retirada.')
    return { checkoutUrl: await payments.startCheckout(order.id) }
  }

  return { create, getForCustomer, cancelByCustomer, payByCustomer, publicView }
}
