/**
 * Valores fechados do domínio. Migrations e models leem daqui.
 * Mudar uma lista que já está em produção exige uma migration nova.
 */
export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending', // PENDENTE: criado, ainda sem cobrança
  AWAITING_PAYMENT: 'awaiting_payment', // AGUARDANDO PAGAMENTO
  PAYMENT_APPROVED: 'payment_approved', // PAGAMENTO APROVADO
  RECEIVED: 'received', // RECEBIDO: novo no painel
  PREPARING: 'preparing', // EM PREPARO
  READY: 'ready', // PRONTO
  OUT_FOR_DELIVERY: 'out_for_delivery', // SAIU PARA ENTREGA
  COMPLETED: 'completed', // FINALIZADO
  CANCELLED: 'cancelled', // CANCELADO
})
export const ORDER_STATUSES = Object.values(ORDER_STATUS)

export const FULFILLMENT = Object.freeze({ DELIVERY: 'delivery', PICKUP: 'pickup' })
export const FULFILLMENTS = Object.values(FULFILLMENT)

export const PAYMENT_METHOD = Object.freeze({
  PIX: 'pix',
  CARD_ONLINE: 'card_online',
  CASH_ON_DELIVERY: 'cash_on_delivery',
  CARD_ON_DELIVERY: 'card_on_delivery',
})
export const PAYMENT_METHODS = Object.values(PAYMENT_METHOD)

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  IN_REVIEW: 'in_review', // valor divergente ou aprovado após cancelamento
})
export const PAYMENT_STATUSES = Object.values(PAYMENT_STATUS)

export const ROLE = Object.freeze({ ADMIN: 'admin', STAFF: 'staff', KITCHEN: 'kitchen' })
export const ROLES = Object.values(ROLE)

export const ACTOR_TYPES = ['system', 'gateway', 'staff', 'customer']
export const ZONE_MATCH_TYPES = ['neighborhood', 'cep_range']
export const COUPON_TYPES = ['percent', 'fixed']
export const ORDER_SOURCES = ['site', 'panel']

/** Limites de pedido (não são dados da Cemita: são proteção contra abuso). */
export const LIMITS = Object.freeze({ MAX_QTY_PER_LINE: 20, MAX_LINES_PER_ORDER: 40, NOTE_MAX: 140 })
