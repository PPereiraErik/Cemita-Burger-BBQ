import { ORDER_STATUS as S, PAYMENT_METHOD, PAYMENT_STATUS as P } from './constants.js'

/** Formas pagas no site (pelo gateway), em oposição às pagas na entrega/retirada. */
export const ONLINE_METHODS = [PAYMENT_METHOD.PIX, PAYMENT_METHOD.CARD_ONLINE]
export const isOnline = (method) => ONLINE_METHODS.includes(method)

/**
 * O que fazer quando o gateway informa o estado de um pagamento. Função PURA.
 *
 * order   = { status, totalCents }                 (do banco, travado)
 * payment = { status, amountCents, currency }       (nossa linha de pagamento do pedido)
 * remote  = { id, status, rawStatus, amountCents, currency, approvedAt }  (buscado NO GATEWAY, nunca do corpo do aviso)
 *
 * Devolve { paymentPatch, orderPath, outcome }:
 * - paymentPatch: campos para gravar no pagamento (ou null);
 * - orderPath: status por onde o pedido passa, em ordem (ex.: aguardando → aprovado → recebido);
 * - outcome: texto curto para o registro do evento.
 *
 * Regras:
 * - aprovado com valor e moeda certos → pedido vai para a cozinha (RECEBIDO);
 * - aprovado com valor diferente → EM ANÁLISE (a equipe confere; o pedido não anda);
 * - aprovado depois de o pedido ser cancelado → EM ANÁLISE (precisa estornar);
 * - recusado/cancelado/pendente → só atualiza o pagamento; o cliente pode tentar de novo no mesmo link;
 * - estornado → marca estornado; o pedido não muda sozinho;
 * - aviso repetido (mesmo estado) → nada muda.
 */
export function decidePayment({ order, payment, remote }) {
  const base = { providerPaymentId: remote.id, rawStatus: remote.rawStatus }

  if (remote.status === P.APPROVED) {
    if (payment.status === P.APPROVED) return { paymentPatch: null, orderPath: [], outcome: 'already_approved' }
    const rightAmount = remote.amountCents === payment.amountCents && remote.amountCents === order.totalCents && remote.currency === (payment.currency ?? 'BRL')
    if (!rightAmount) return { paymentPatch: { ...base, status: P.IN_REVIEW }, orderPath: [], outcome: 'amount_mismatch' }
    if (order.status === S.CANCELLED || order.status === S.COMPLETED) {
      return { paymentPatch: { ...base, status: P.IN_REVIEW, paidAt: remote.approvedAt }, orderPath: [], outcome: 'approved_after_cancel' }
    }
    const path = []
    if (order.status === S.PENDING) path.push(S.AWAITING_PAYMENT)
    if (order.status === S.PENDING || order.status === S.AWAITING_PAYMENT) path.push(S.PAYMENT_APPROVED, S.RECEIVED)
    else if (order.status === S.PAYMENT_APPROVED) path.push(S.RECEIVED)
    return { paymentPatch: { ...base, status: P.APPROVED, paidAt: remote.approvedAt ?? new Date() }, orderPath: path, outcome: 'approved' }
  }

  // depois de aprovado, só estorno muda o pagamento (um aviso atrasado de "pendente" não desfaz a aprovação)
  if (payment.status === P.APPROVED && remote.status !== P.REFUNDED && remote.status !== P.IN_REVIEW) {
    return { paymentPatch: null, orderPath: [], outcome: 'ignored_after_approval' }
  }
  if (payment.status === remote.status) return { paymentPatch: { ...base }, orderPath: [], outcome: 'unchanged' }
  return { paymentPatch: { ...base, status: remote.status }, orderPath: [], outcome: remote.status }
}

/** O que o cliente vê do pagamento no acompanhamento. */
export function paymentView(payment, orderStatus) {
  if (!payment) return null
  const awaiting = orderStatus === S.PENDING || orderStatus === S.AWAITING_PAYMENT
  return {
    method: payment.method,
    status: payment.status,
    online: isOnline(payment.method),
    // o link só aparece enquanto ainda dá para pagar
    checkoutUrl: isOnline(payment.method) && awaiting && payment.status !== P.APPROVED ? (payment.checkoutUrl ?? null) : null,
  }
}
