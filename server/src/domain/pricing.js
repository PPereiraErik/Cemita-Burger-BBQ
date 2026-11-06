import { FULFILLMENT, LIMITS } from './constants.js'

/**
 * Cálculo do pedido. Função PURA: recebe o que o cliente pediu (só IDs, quantidades e
 * escolhas) e os dados vindos do BANCO, e devolve valores e problemas.
 * O cliente nunca informa preço: nenhum valor do corpo da requisição entra na conta.
 *
 * data = {
 *   products: Map<id, { id, name, priceCents, active, available, orderable, isAdult,
 *                      groups: [{ id, name, minSelect, maxSelect, active, items: [{ id, name, priceDeltaCents, active, available }] }] }>,
 *   zones: [{ id, name, matchType, neighborhoods, cepStart, cepEnd, feeCents, minOrderCents, etaMinMinutes, etaMaxMinutes }]  (só ativas),
 *   coupon: { id, code, type, value, minSubtotalCents, startsAt, endsAt, maxUses, usedCount, active } | null,
 *   minOrderCents: number | null,
 * }
 */
export const PRICING_ERRORS = Object.freeze({
  PRODUCT_NOT_FOUND: 'Este item não existe mais no cardápio.',
  PRODUCT_NOT_ORDERABLE: 'Este item ainda não pode ser pedido pelo site.',
  PRODUCT_UNAVAILABLE: 'Este item esgotou por hoje.',
  OPTION_NOT_ALLOWED: 'Esta opção não vale para este item.',
  OPTION_UNAVAILABLE: 'Esta opção esgotou.',
  OPTION_SELECTION_INVALID: 'Escolha de opções fora do permitido.',
  DELIVERY_UNAVAILABLE: 'Ainda não entregamos neste endereço. Você pode retirar no balcão.',
  BELOW_MINIMUM_ORDER: 'O pedido não atingiu o valor mínimo.',
  COUPON_INVALID: 'Cupom inválido.',
  COUPON_EXPIRED: 'Este cupom não está valendo agora.',
  COUPON_MINIMUM_NOT_REACHED: 'O pedido não atingiu o mínimo do cupom.',
  COUPON_EXHAUSTED: 'Este cupom já atingiu o limite de usos.',
})

const issue = (code, extra = {}) => ({ code, message: PRICING_ERRORS[code], ...extra })

/** Texto para comparar bairros: minúsculo, sem acento, espaços simples. */
export const normalizeText = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export function findZone(zones, { cep, neighborhood } = {}) {
  const n = normalizeText(neighborhood)
  for (const z of zones) {
    if (z.matchType === 'cep_range' && cep && cep >= z.cepStart && cep <= z.cepEnd) return z
    if (z.matchType === 'neighborhood' && n && (z.neighborhoods ?? []).some((x) => normalizeText(x) === n)) return z
  }
  return null
}

export function couponDiscount(coupon, subtotalCents, now) {
  if (!coupon || !coupon.active) return { error: 'COUPON_INVALID' }
  if ((coupon.startsAt && now < new Date(coupon.startsAt)) || (coupon.endsAt && now > new Date(coupon.endsAt))) return { error: 'COUPON_EXPIRED' }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return { error: 'COUPON_EXHAUSTED' }
  if (subtotalCents < coupon.minSubtotalCents) return { error: 'COUPON_MINIMUM_NOT_REACHED' }
  const raw = coupon.type === 'percent' ? Math.floor((subtotalCents * coupon.value) / 100) : coupon.value
  return { discountCents: Math.min(raw, subtotalCents) }
}

export function priceCart(cart, data, now = new Date()) {
  const errors = []
  const lines = []

  cart.lines.slice(0, LIMITS.MAX_LINES_PER_ORDER).forEach((line, index) => {
    const p = data.products.get(line.productId)
    if (!p || !p.active) return errors.push(issue('PRODUCT_NOT_FOUND', { line: index }))
    if (!p.orderable) return errors.push(issue('PRODUCT_NOT_ORDERABLE', { line: index, product: p.name }))
    if (!p.available) return errors.push(issue('PRODUCT_UNAVAILABLE', { line: index, product: p.name }))

    const chosen = []
    const groups = p.groups.filter((g) => g.active)
    for (const optionId of new Set(line.optionIds ?? [])) {
      const group = groups.find((g) => g.items.some((i) => i.id === optionId && i.active))
      if (!group) {
        errors.push(issue('OPTION_NOT_ALLOWED', { line: index, product: p.name }))
        continue
      }
      const item = group.items.find((i) => i.id === optionId)
      if (!item.available) {
        errors.push(issue('OPTION_UNAVAILABLE', { line: index, product: p.name, option: item.name }))
        continue
      }
      chosen.push({ optionItemId: item.id, groupId: group.id, groupName: group.name, optionName: item.name, priceDeltaCents: item.priceDeltaCents })
    }
    for (const g of groups) {
      const n = chosen.filter((c) => c.groupId === g.id).length
      if (n < g.minSelect || n > g.maxSelect) errors.push(issue('OPTION_SELECTION_INVALID', { line: index, product: p.name, group: g.name }))
    }

    const unitPriceCents = p.priceCents + chosen.reduce((t, c) => t + c.priceDeltaCents, 0)
    lines.push({
      index,
      productId: p.id,
      productName: p.name,
      isAdult: p.isAdult,
      unitPriceCents,
      quantity: line.quantity,
      note: line.note || null,
      options: chosen,
      lineTotalCents: unitPriceCents * line.quantity,
    })
  })

  const subtotalCents = lines.reduce((t, l) => t + l.lineTotalCents, 0)

  let zone = null
  let deliveryFeeCents = 0
  if (cart.fulfillment === FULFILLMENT.DELIVERY) {
    zone = findZone(data.zones, cart.address ?? {})
    if (!zone) errors.push(issue('DELIVERY_UNAVAILABLE'))
    else deliveryFeeCents = zone.feeCents
  }

  const minimum = Math.max(data.minOrderCents ?? 0, zone?.minOrderCents ?? 0)
  if (lines.length && subtotalCents < minimum) errors.push(issue('BELOW_MINIMUM_ORDER', { minimumCents: minimum }))

  let discountCents = 0
  if (cart.couponCode) {
    const r = couponDiscount(data.coupon, subtotalCents, now)
    if (r.error) errors.push(issue(r.error))
    else discountCents = r.discountCents
  }

  return {
    ok: errors.length === 0,
    errors,
    lines,
    hasAdultItems: lines.some((l) => l.isAdult),
    zone: zone ? { id: zone.id, name: zone.name, etaMinMinutes: zone.etaMinMinutes, etaMaxMinutes: zone.etaMaxMinutes } : null,
    coupon: discountCents > 0 ? { id: data.coupon.id, code: data.coupon.code } : null,
    subtotalCents,
    discountCents,
    deliveryFeeCents,
    totalCents: subtotalCents - discountCents + deliveryFeeCents,
  }
}
