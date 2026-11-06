import { FULFILLMENT, ORDER_STATUS as S, PAYMENT_METHOD } from './constants.js'

/**
 * Máquina de estados do pedido. ÚNICA fonte das transições permitidas:
 * qualquer mudança fora desta tabela é recusada, venha de onde vier.
 */
export const TRANSITIONS = Object.freeze({
  [S.PENDING]: [S.AWAITING_PAYMENT, S.RECEIVED, S.CANCELLED],
  [S.AWAITING_PAYMENT]: [S.PAYMENT_APPROVED, S.CANCELLED],
  [S.PAYMENT_APPROVED]: [S.RECEIVED, S.CANCELLED],
  [S.RECEIVED]: [S.PREPARING, S.CANCELLED],
  [S.PREPARING]: [S.READY, S.CANCELLED],
  [S.READY]: [S.OUT_FOR_DELIVERY, S.COMPLETED, S.CANCELLED],
  [S.OUT_FOR_DELIVERY]: [S.COMPLETED, S.CANCELLED],
  [S.COMPLETED]: [],
  [S.CANCELLED]: [],
})

/** Rótulos para a tela, sempre com símbolo e palavra (nunca só cor). */
export const STATUS_LABEL = Object.freeze({
  [S.PENDING]: '… Pendente',
  [S.AWAITING_PAYMENT]: '⏲ Aguardando pagamento',
  [S.PAYMENT_APPROVED]: '✓ Pagamento aprovado',
  [S.RECEIVED]: '✓ Recebido',
  [S.PREPARING]: '⏲ Em preparo',
  [S.READY]: '✓ Pronto',
  [S.OUT_FOR_DELIVERY]: '→ Saiu para entrega',
  [S.COMPLETED]: '✓ Finalizado',
  [S.CANCELLED]: '✕ Cancelado',
})

export const ON_DELIVERY_METHODS = [PAYMENT_METHOD.CASH_ON_DELIVERY, PAYMENT_METHOD.CARD_ON_DELIVERY]

/**
 * Pode ir de `from` para `to` neste pedido?
 * Regras além da tabela: retirada não "sai para entrega"; entrega não finaliza direto do "pronto".
 */
export function canTransition(order, to) {
  const from = order.status
  if (!(TRANSITIONS[from] ?? []).includes(to)) return false
  if (to === S.OUT_FOR_DELIVERY && order.fulfillment !== FULFILLMENT.DELIVERY) return false
  if (from === S.READY && to === S.COMPLETED && order.fulfillment !== FULFILLMENT.PICKUP) return false
  return true
}

/**
 * O CLIENTE só cancela antes de a cozinha começar: enquanto pendente, aguardando pagamento,
 * ou já recebido quando o pagamento é na entrega (nada foi cobrado ainda).
 */
export function customerCanCancel(order) {
  if (order.status === S.PENDING || order.status === S.AWAITING_PAYMENT) return true
  return order.status === S.RECEIVED && ON_DELIVERY_METHODS.includes(order.paymentMethod)
}
