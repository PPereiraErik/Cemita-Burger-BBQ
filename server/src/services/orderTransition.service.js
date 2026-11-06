import { canTransition } from '../domain/orderStatus.js'
import { AppError } from '../utils/errors.js'

/**
 * Muda o status de um pedido com TRAVA OTIMISTA: só grava se o pedido ainda estiver
 * no status e na versão que a pessoa viu. Dois cliques ao mesmo tempo → um vence,
 * o outro recebe 409 e vê o estado atual. Toda mudança entra no histórico.
 */
/** Linhas alteradas num UPDATE bruto do MySQL. */
export const affectedRows = (result) => result?.affectedRows ?? 0

export function createOrderTransitionService({ sequelize, models }) {
  const { OrderStatusHistory } = models

  async function transition(order, to, { actorType, actorUserId = null, reason = null, transaction, extra = {} }) {
    if (!canTransition(order, to)) {
      throw new AppError(409, 'INVALID_TRANSITION', 'Esta mudança de status não é permitida para o pedido agora.', { from: order.status, to })
    }
    const sets = ['status = :to', 'version = version + 1', 'updated_at = CURRENT_TIMESTAMP']
    const replacements = { to, id: order.id, from: order.status, version: order.version }
    if (extra.cancelReason !== undefined) {
      sets.push('cancel_reason = :cancelReason')
      replacements.cancelReason = extra.cancelReason
    }
    const [result] = await sequelize.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = :id AND status = :from AND version = :version`, { replacements, transaction })
    if (affectedRows(result) !== 1) throw new AppError(409, 'ORDER_CHANGED', 'O pedido acabou de ser alterado. Atualize para ver o estado atual.')
    await OrderStatusHistory.create({ orderId: order.id, fromStatus: order.status, toStatus: to, actorType, actorUserId, reason }, { transaction })
    return { ...order, status: to, version: order.version + 1 }
  }

  return { transition }
}
