import { PAYMENT_METHOD } from '../domain/constants.js'
import { isOpenAt } from '../domain/storeHours.js'

/** Na entrega/retirada: sempre operáveis. Pix e cartão no site: só com o gateway configurado (Etapa 6). */
const ON_DELIVERY = [PAYMENT_METHOD.CASH_ON_DELIVERY, PAYMENT_METHOD.CARD_ON_DELIVERY]
const ONLINE = [PAYMENT_METHOD.PIX, PAYMENT_METHOD.CARD_ONLINE]

/**
 * Estado da loja: aberta? aceitando pedidos pelo site? quais formas de entrega e pagamento?
 * Tudo calculado a partir do banco; o que está pendente de definição fica de fora (nunca inventado).
 */
export function createStoreService({ models, clock, onlinePayments = false }) {
  const { StoreSetting, StoreHour, DeliveryZone, PrivacyPolicyVersion } = models
  const OPERABLE_METHODS = new Set(onlinePayments ? [...ON_DELIVERY, ...ONLINE] : ON_DELIVERY)

  async function settings(transaction) {
    const rows = await StoreSetting.findAll({ transaction })
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }

  async function status({ transaction } = {}) {
    const now = clock()
    const [s, hours, zoneCount, policy] = await Promise.all([
      settings(transaction),
      StoreHour.findAll({ order: [['weekday', 'ASC']], transaction }),
      DeliveryZone.count({ where: { active: true }, transaction }),
      PrivacyPolicyVersion.findOne({ where: { active: true }, order: [['publishedAt', 'DESC']], transaction }),
    ])
    const tz = s.store_timezone || 'America/Sao_Paulo'
    const open = isOpenAt(now, hours.map((h) => h.get({ plain: true })), tz)
    const paused = s.orders_paused === true
    const mode = s.ordering_mode ?? 'vuca'
    const paymentMethods = (Array.isArray(s.payment_methods_enabled) ? s.payment_methods_enabled : []).filter((m) => OPERABLE_METHODS.has(m))

    const reasons = []
    if (mode === 'vuca') reasons.push('ORDERING_DISABLED')
    if (paused) reasons.push('STORE_PAUSED')
    if (!open) reasons.push('STORE_CLOSED')
    if (!policy) reasons.push('PRIVACY_POLICY_MISSING')
    if (!paymentMethods.length) reasons.push('NO_PAYMENT_METHOD')

    return {
      orderingMode: mode,
      acceptsOrders: reasons.length === 0,
      reasons,
      open,
      paused,
      timezone: tz,
      hours: hours.map((h) => ({ weekday: h.weekday, opensAt: h.opensAt.slice(0, 5), closesAt: h.closesAt.slice(0, 5) })),
      fulfillment: {
        pickup: { available: true, etaMinutes: Number.isInteger(s.pickup_eta_minutes) ? s.pickup_eta_minutes : null },
        delivery: { available: zoneCount > 0 },
      },
      paymentMethods,
      /** o gateway está configurado? (o painel só deixa ligar Pix/cartão no site quando sim) */
      onlinePaymentsReady: onlinePayments,
      minOrderCents: Number.isInteger(s.min_order_cents) ? s.min_order_cents : null,
      privacyPolicy: policy ? { id: policy.id, version: policy.version, url: policy.url } : null,
    }
  }

  return { status, settings }
}
