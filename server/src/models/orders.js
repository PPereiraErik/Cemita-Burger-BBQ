import { DataTypes } from 'sequelize'
import { ACTOR_TYPES, COUPON_TYPES, FULFILLMENTS, LIMITS, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../domain/constants.js'

const cents = (extra = {}) => ({ type: DataTypes.INTEGER, allowNull: false, validate: { isInt: true, min: 0 }, ...extra })

/**
 * Pedidos e pagamentos. Linhas e opções guardam cópia de nome e preço.
 * Mudança de status NÃO é feita por update solto: passa pelo serviço de
 * transições (Etapa 2), que usa a coluna version como trava otimista.
 */
export function defineOrders(sequelize) {
  const Coupon = sequelize.define(
    'Coupon',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      type: { type: DataTypes.ENUM(...COUPON_TYPES), allowNull: false },
      value: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      minSubtotalCents: cents({ defaultValue: 0 }),
      startsAt: { type: DataTypes.DATE, allowNull: true },
      endsAt: { type: DataTypes.DATE, allowNull: true },
      maxUses: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      usedCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'coupons' },
  )

  const Order = sequelize.define(
    'Order',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      publicCode: { type: DataTypes.STRING(16), allowNull: false, unique: true },
      trackingTokenHash: { type: DataTypes.CHAR(64), allowNull: false },
      status: { type: DataTypes.ENUM(...ORDER_STATUSES), allowNull: false },
      version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      fulfillment: { type: DataTypes.ENUM(...FULFILLMENTS), allowNull: false },
      source: { type: DataTypes.ENUM(...ORDER_SOURCES), allowNull: false, defaultValue: 'site' },
      customerName: { type: DataTypes.STRING(80), allowNull: true },
      customerPhone: { type: DataTypes.STRING(20), allowNull: true },
      phoneNormalized: { type: DataTypes.STRING(15), allowNull: true },
      addressCep: { type: DataTypes.CHAR(8), allowNull: true },
      addressStreet: { type: DataTypes.STRING(120), allowNull: true },
      addressNumber: { type: DataTypes.STRING(12), allowNull: true },
      addressComplement: { type: DataTypes.STRING(60), allowNull: true },
      addressNeighborhood: { type: DataTypes.STRING(80), allowNull: true },
      addressReference: { type: DataTypes.STRING(120), allowNull: true },
      deliveryZoneId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      deliveryZoneName: { type: DataTypes.STRING(80), allowNull: true },
      subtotalCents: cents(),
      discountCents: cents({ defaultValue: 0 }),
      deliveryFeeCents: cents({ defaultValue: 0 }),
      totalCents: cents(),
      paymentMethod: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
      changeForCents: { type: DataTypes.INTEGER, allowNull: true, validate: { isInt: true, min: 0 } },
      couponId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      couponCode: { type: DataTypes.STRING(30), allowNull: true },
      notes: { type: DataTypes.STRING(LIMITS.NOTE_MAX), allowNull: true },
      adultConfirmedAt: { type: DataTypes.DATE, allowNull: true },
      privacyPolicyVersionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      privacyAcceptedAt: { type: DataTypes.DATE, allowNull: true },
      idempotencyKey: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      idempotencyHash: { type: DataTypes.CHAR(64), allowNull: false },
      cancelReason: { type: DataTypes.STRING(200), allowNull: true },
      anonymizedAt: { type: DataTypes.DATE, allowNull: true },
      placedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'orders',
      validate: {
        totalsAddUp() {
          if (this.totalCents !== this.subtotalCents - this.discountCents + this.deliveryFeeCents) throw new Error('total não confere com subtotal, desconto e taxa')
          if (this.discountCents > this.subtotalCents) throw new Error('desconto maior que o subtotal')
        },
        changeOnlyForCash() {
          if (this.changeForCents != null && (this.paymentMethod !== 'cash_on_delivery' || this.changeForCents < this.totalCents)) throw new Error('troco só para dinheiro e maior ou igual ao total')
        },
      },
    },
  )

  const OrderItem = sequelize.define(
    'OrderItem',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      orderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      productName: { type: DataTypes.STRING(120), allowNull: false },
      unitPriceCents: cents(),
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: LIMITS.MAX_QTY_PER_LINE } },
      note: { type: DataTypes.STRING(LIMITS.NOTE_MAX), allowNull: true },
      lineTotalCents: cents(),
    },
    { tableName: 'order_items' },
  )

  const OrderItemOption = sequelize.define(
    'OrderItemOption',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      orderItemId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      optionItemId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      groupName: { type: DataTypes.STRING(80), allowNull: false },
      optionName: { type: DataTypes.STRING(80), allowNull: false },
      priceDeltaCents: cents(),
    },
    { tableName: 'order_item_options' },
  )

  const OrderStatusHistory = sequelize.define(
    'OrderStatusHistory',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      orderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      fromStatus: { type: DataTypes.ENUM(...ORDER_STATUSES), allowNull: true },
      toStatus: { type: DataTypes.ENUM(...ORDER_STATUSES), allowNull: false },
      actorType: { type: DataTypes.ENUM(...ACTOR_TYPES), allowNull: false },
      actorUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      reason: { type: DataTypes.STRING(200), allowNull: true },
    },
    { tableName: 'order_status_history', updatedAt: false },
  )

  const Payment = sequelize.define(
    'Payment',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      orderId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      provider: { type: DataTypes.STRING(30), allowNull: false },
      method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
      providerPaymentId: { type: DataTypes.STRING(120), allowNull: true },
      status: { type: DataTypes.ENUM(...PAYMENT_STATUSES), allowNull: false },
      amountCents: cents(),
      currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'BRL' },
      rawStatus: { type: DataTypes.STRING(60), allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      providerReference: { type: DataTypes.STRING(120), allowNull: true },
      checkoutUrl: { type: DataTypes.STRING(600), allowNull: true },
    },
    { tableName: 'payments' },
  )

  const PaymentEvent = sequelize.define(
    'PaymentEvent',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      provider: { type: DataTypes.STRING(30), allowNull: false },
      providerEventId: { type: DataTypes.STRING(120), allowNull: false },
      paymentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      type: { type: DataTypes.STRING(60), allowNull: false },
      receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      processedAt: { type: DataTypes.DATE, allowNull: true },
      outcome: { type: DataTypes.STRING(40), allowNull: true },
    },
    { tableName: 'payment_events', timestamps: false },
  )

  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' })
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' })
  OrderItem.hasMany(OrderItemOption, { foreignKey: 'orderItemId', as: 'options' })
  OrderItemOption.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' })
  Order.hasMany(OrderStatusHistory, { foreignKey: 'orderId', as: 'history' })
  OrderStatusHistory.belongsTo(Order, { foreignKey: 'orderId', as: 'order' })
  Order.hasMany(Payment, { foreignKey: 'orderId', as: 'payments' })
  Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' })
  Payment.hasMany(PaymentEvent, { foreignKey: 'paymentId', as: 'events' })
  Order.belongsTo(Coupon, { foreignKey: 'couponId', as: 'coupon' })

  return { Coupon, Order, OrderItem, OrderItemOption, OrderStatusHistory, Payment, PaymentEvent }
}
