import { Op } from 'sequelize'
import { priceCart } from '../domain/pricing.js'

/**
 * Busca no banco tudo o que o cálculo precisa e roda a função pura priceCart.
 * Usado pela cotação da comanda e pela criação do pedido (mesma conta nos dois).
 */
export function createQuoteService({ models, clock }) {
  const { Product, OptionGroup, OptionItem, DeliveryZone, Coupon, StoreSetting } = models

  async function loadPricingData(cart, { transaction } = {}) {
    const ids = [...new Set(cart.lines.map((l) => l.productId))]
    const [products, zones, coupon, minSetting] = await Promise.all([
      Product.findAll({
        where: { id: { [Op.in]: ids } },
        include: [{ model: OptionGroup, as: 'optionGroups', include: [{ model: OptionItem, as: 'items' }] }],
        transaction,
      }),
      cart.fulfillment === 'delivery' ? DeliveryZone.findAll({ where: { active: true }, order: [['position', 'ASC']], transaction }) : [],
      cart.couponCode ? Coupon.findOne({ where: { code: cart.couponCode }, transaction }) : null,
      StoreSetting.findByPk('min_order_cents', { transaction }),
    ])
    return {
      products: new Map(
        products.map((p) => [
          p.id,
          {
            id: p.id,
            name: p.name,
            priceCents: p.priceCents,
            active: p.active,
            available: p.available,
            orderable: p.orderable,
            isAdult: p.isAdult,
            groups: (p.optionGroups ?? []).map((g) => ({
              id: g.id,
              name: g.name,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
              active: g.active && !g.pendingReview,
              items: (g.items ?? []).map((i) => ({ id: i.id, name: i.name, priceDeltaCents: i.priceDeltaCents, active: i.active && !i.pendingReview, available: i.available })),
            })),
          },
        ]),
      ),
      zones: zones.map((z) => z.get({ plain: true })),
      coupon: coupon ? coupon.get({ plain: true }) : null,
      minOrderCents: Number.isInteger(minSetting?.value) ? minSetting.value : null,
    }
  }

  async function quote(cart, { transaction } = {}) {
    const data = await loadPricingData(cart, { transaction })
    return priceCart(cart, data, clock())
  }

  return { quote }
}
