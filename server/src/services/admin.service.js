import { Op } from 'sequelize'
import { ORDER_STATUS as S, ROLE } from '../domain/constants.js'
import { canTransition, STATUS_LABEL } from '../domain/orderStatus.js'
import { can, roleCanMoveTo } from '../domain/permissions.js'
import { AppError, notFound } from '../utils/errors.js'
import { hashPassword, passwordProblem } from '../utils/password.js'
import { STAFF_PRODUCT_FIELDS, STAFF_SETTING_KEYS, SETTING_RULES } from '../validators/admin.js'
import { publicUser } from './auth.service.js'

const FORBIDDEN = (msg = 'Seu acesso não permite esta ação.') => new AppError(403, 'FORBIDDEN', msg)

/** Pedidos que ainda pedem ação de alguém. */
export const ACTIVE_STATUSES = [S.PENDING, S.AWAITING_PAYMENT, S.PAYMENT_APPROVED, S.RECEIVED, S.PREPARING, S.READY, S.OUT_FOR_DELIVERY]
/** A cozinha só vê o que está na fila dela. */
export const KITCHEN_STATUSES = [S.RECEIVED, S.PREPARING, S.READY]
const RECENT_HOURS = 12

/**
 * Regras do painel (pedidos, cardápio, loja, zonas, equipe).
 * Os controllers só traduzem HTTP; a permissão é conferida AQUI também (defesa em profundidade).
 */
export function createAdminService({ sequelize, models, clock, audit, store, transitions }) {
  const { Order, OrderItem, OrderItemOption, OrderStatusHistory, Payment, Category, Product, StoreSetting, StoreHour, DeliveryZone, User, Session } = models

  // ───────────────────────── pedidos ─────────────────────────
  const orderInclude = [
    { model: OrderItem, as: 'items', include: [{ model: OrderItemOption, as: 'options' }] },
    { model: OrderStatusHistory, as: 'history' },
    { model: Payment, as: 'payments' },
  ]

  /** Visão do painel. Cozinha não vê telefone nem endereço, e vê só o primeiro nome. */
  function orderView(o, role) {
    const contact = can(role, 'viewCustomerContact')
    return {
      id: o.id,
      code: o.publicCode,
      status: o.status,
      statusLabel: STATUS_LABEL[o.status],
      version: o.version,
      fulfillment: o.fulfillment,
      source: o.source,
      customerName: contact ? o.customerName : (o.customerName ?? '').split(' ')[0] || null,
      ...(contact
        ? {
            customerPhone: o.customerPhone,
            address:
              o.fulfillment === 'delivery'
                ? { cep: o.addressCep, street: o.addressStreet, number: o.addressNumber, complement: o.addressComplement, neighborhood: o.addressNeighborhood, reference: o.addressReference }
                : null,
          }
        : {}),
      deliveryZoneName: o.deliveryZoneName,
      neighborhood: o.addressNeighborhood,
      items: (o.items ?? [])
        .sort((a, b) => a.id - b.id)
        .map((i) => ({ name: i.productName, quantity: i.quantity, note: i.note, lineTotalCents: i.lineTotalCents, options: (i.options ?? []).map((x) => ({ group: x.groupName, name: x.optionName })) })),
      notes: o.notes,
      subtotalCents: o.subtotalCents,
      discountCents: o.discountCents,
      deliveryFeeCents: o.deliveryFeeCents,
      totalCents: o.totalCents,
      paymentMethod: o.paymentMethod,
      changeForCents: o.changeForCents,
      paymentStatus: (o.payments ?? []).sort((a, b) => b.id - a.id)[0]?.status ?? null,
      hasAdultItems: !!o.adultConfirmedAt,
      cancelReason: o.cancelReason,
      placedAt: o.placedAt,
      history: (o.history ?? [])
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((h) => ({ status: h.toStatus, label: STATUS_LABEL[h.toStatus], at: h.createdAt, actor: h.actorType, reason: h.reason })),
    }
  }

  async function listOrders({ scope = 'active' }, user) {
    const role = user.role
    let where
    if (scope === 'recent') {
      if (role === ROLE.KITCHEN) throw FORBIDDEN()
      where = { status: { [Op.in]: [S.COMPLETED, S.CANCELLED] }, updatedAt: { [Op.gte]: new Date(clock().getTime() - RECENT_HOURS * 3600_000) } }
    } else {
      where = { status: { [Op.in]: role === ROLE.KITCHEN ? KITCHEN_STATUSES : ACTIVE_STATUSES } }
    }
    const rows = await Order.findAll({ where, include: orderInclude, order: [['placedAt', 'ASC']], limit: 200 })
    return rows.map((o) => orderView(o, role))
  }

  async function getOrder(id, user) {
    const o = await Order.findByPk(id, { include: orderInclude })
    if (!o) throw notFound('Pedido')
    if (user.role === ROLE.KITCHEN && !KITCHEN_STATUSES.includes(o.status)) throw notFound('Pedido')
    return orderView(o, user.role)
  }

  async function changeStatus(id, { to, version, reason }, user, { ip } = {}) {
    if (!roleCanMoveTo(user.role, to)) throw FORBIDDEN('A cozinha só marca "em preparo" e "pronto".')
    if (to === S.CANCELLED && !(reason && reason.length >= 3)) throw new AppError(422, 'CANCEL_REASON_REQUIRED', 'Diga o motivo do cancelamento.')
    await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!order) throw notFound('Pedido')
      if (order.version !== version) throw new AppError(409, 'ORDER_CHANGED', 'O pedido acabou de ser alterado. Atualize para ver o estado atual.')
      const plain = order.get({ plain: true })
      if (!canTransition(plain, to)) throw new AppError(409, 'INVALID_TRANSITION', 'Esta mudança de status não é permitida para o pedido agora.', { from: plain.status, to })
      await transitions.transition(plain, to, {
        actorType: 'staff',
        actorUserId: user.id,
        reason: reason ?? null,
        transaction,
        extra: to === S.CANCELLED ? { cancelReason: reason } : {},
      })
      if (to === S.CANCELLED) {
        await Payment.update({ status: 'cancelled' }, { where: { orderId: order.id, status: 'pending' }, transaction })
        if (order.couponId) await sequelize.query('UPDATE coupons SET used_count = used_count - 1 WHERE id = ? AND used_count > 0', { replacements: [order.couponId], transaction })
      }
      // Pagamento na entrega continua "pendente" mesmo depois de finalizado: a conciliação
      // (quem recebeu, quanto) depende de definição da Cemita e entra junto com a Etapa 6.
      await audit.log({ userId: user.id, action: 'order.status', entity: 'order', entityId: order.id, meta: { code: order.publicCode, from: plain.status, to }, ip, transaction })
    })
    return orderView(await Order.findByPk(id, { include: orderInclude }), user.role)
  }

  // ───────────────────────── cardápio ─────────────────────────
  const productView = (p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    priceFrom: p.priceFrom,
    orderable: p.orderable,
    available: p.available,
    active: p.active,
    isAdult: p.isAdult,
  })

  async function listCatalog() {
    const cats = await Category.findAll({ order: [['position', 'ASC']], include: [{ model: Product, as: 'products' }] })
    return cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, active: c.active, products: (c.products ?? []).sort((a, b) => a.position - b.position).map(productView) }))
  }

  async function patchProduct(id, patch, user, { ip } = {}) {
    if (!can(user.role, 'editProducts')) {
      if (!can(user.role, 'setProductAvailability') || Object.keys(patch).some((k) => !STAFF_PRODUCT_FIELDS.has(k))) throw FORBIDDEN('Seu acesso só permite marcar o produto como disponível ou esgotado.')
    }
    const p = await Product.findByPk(id)
    if (!p) throw notFound('Produto')
    const changes = Object.fromEntries(Object.entries(patch).filter(([k, v]) => p[k] !== v))
    if (Object.keys(changes).length) {
      const before = Object.fromEntries(Object.keys(changes).map((k) => [k, p[k]]))
      await p.update(changes)
      await audit.log({ userId: user.id, action: 'product.update', entity: 'product', entityId: p.id, meta: { slug: p.slug, before, after: changes }, ip })
    }
    return productView(p)
  }

  // ───────────────────────── loja ─────────────────────────
  async function getStore() {
    const [status, rows, hours] = await Promise.all([store.status(), StoreSetting.findAll(), StoreHour.findAll({ order: [['weekday', 'ASC'], ['opensAt', 'ASC']] })])
    const all = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    const settings = Object.fromEntries(Object.keys(SETTING_RULES).map((k) => [k, all[k] ?? null]))
    return {
      status,
      settings,
      timezone: all.store_timezone ?? 'America/Sao_Paulo',
      hours: hours.map((h) => ({ weekday: h.weekday, opensAt: h.opensAt.slice(0, 5), closesAt: h.closesAt.slice(0, 5) })),
    }
  }

  async function patchSettings(patch, user, { ip } = {}) {
    if (!can(user.role, 'editStoreSettings')) {
      if (!can(user.role, 'pauseStore') || Object.keys(patch).some((k) => !STAFF_SETTING_KEYS.has(k))) throw FORBIDDEN('Seu acesso só permite pausar e retomar os pedidos.')
    }
    await sequelize.transaction(async (transaction) => {
      for (const [key, value] of Object.entries(patch)) {
        const row = await StoreSetting.findByPk(key, { transaction, lock: transaction.LOCK.UPDATE })
        const before = row ? row.value : null
        if (row) await row.update({ value, updatedByUserId: user.id }, { transaction })
        else await StoreSetting.create({ key, value, updatedByUserId: user.id }, { transaction })
        await audit.log({ userId: user.id, action: 'setting.update', entity: 'setting', entityId: key, meta: { before, after: value }, ip, transaction })
      }
    })
    return getStore()
  }

  async function replaceHours(hours, user, { ip } = {}) {
    if (!can(user.role, 'editStoreSettings')) throw FORBIDDEN()
    await sequelize.transaction(async (transaction) => {
      await StoreHour.destroy({ where: {}, transaction })
      if (hours.length) await StoreHour.bulkCreate(hours.map((h) => ({ weekday: h.weekday, opensAt: `${h.opensAt}:00`, closesAt: `${h.closesAt}:00` })), { transaction })
      await audit.log({ userId: user.id, action: 'hours.replace', entity: 'store_hours', meta: { count: hours.length }, ip, transaction })
    })
    return getStore()
  }

  // ───────────────────────── zonas de entrega ─────────────────────────
  const zoneView = (z) => ({
    id: z.id,
    name: z.name,
    matchType: z.matchType,
    neighborhoods: z.neighborhoods ?? null,
    cepStart: z.cepStart,
    cepEnd: z.cepEnd,
    feeCents: z.feeCents,
    minOrderCents: z.minOrderCents,
    etaMinMinutes: z.etaMinMinutes,
    etaMaxMinutes: z.etaMaxMinutes,
    active: z.active,
    position: z.position,
  })
  const zoneRow = (v) => ({
    ...v,
    neighborhoods: v.matchType === 'neighborhood' ? v.neighborhoods : null,
    cepStart: v.matchType === 'cep_range' ? v.cepStart : null,
    cepEnd: v.matchType === 'cep_range' ? v.cepEnd : null,
  })

  const listZones = async () => (await DeliveryZone.findAll({ order: [['position', 'ASC'], ['id', 'ASC']] })).map(zoneView)

  async function createZone(v, user, { ip } = {}) {
    const z = await DeliveryZone.create(zoneRow(v))
    await audit.log({ userId: user.id, action: 'zone.create', entity: 'zone', entityId: z.id, meta: { name: z.name }, ip })
    return zoneView(z)
  }

  async function updateZone(id, v, user, { ip } = {}) {
    const z = await DeliveryZone.findByPk(id)
    if (!z) throw notFound('Zona')
    await z.update(zoneRow(v))
    await audit.log({ userId: user.id, action: 'zone.update', entity: 'zone', entityId: z.id, meta: { name: z.name }, ip })
    return zoneView(z)
  }

  /** Zona já usada em pedido não é apagada (o banco apagaria só o vínculo): desative em vez disso. */
  async function deleteZone(id, user, { ip } = {}) {
    const z = await DeliveryZone.findByPk(id)
    if (!z) throw notFound('Zona')
    if ((await Order.count({ where: { deliveryZoneId: id } })) > 0) throw new AppError(409, 'ZONE_IN_USE', 'Esta zona já foi usada em pedidos. Desative em vez de apagar.')
    await z.destroy()
    await audit.log({ userId: user.id, action: 'zone.delete', entity: 'zone', entityId: id, meta: { name: z.name }, ip })
  }

  // ───────────────────────── equipe ─────────────────────────
  const listUsers = async () => (await User.findAll({ order: [['name', 'ASC']] })).map(publicUser)

  /** Nunca deixa o painel sem nenhuma administração ativa. */
  async function assertKeepsAnAdmin(target, next, transaction) {
    const stillAdmin = (next.role ?? target.role) === ROLE.ADMIN && (next.active ?? target.active)
    if (target.role !== ROLE.ADMIN || !target.active || stillAdmin) return
    const others = await User.count({ where: { role: ROLE.ADMIN, active: true, id: { [Op.ne]: target.id } }, transaction })
    if (others === 0) throw new AppError(409, 'LAST_ADMIN', 'Esta é a única conta de administração ativa. Crie outra antes.')
  }

  async function updateUser(id, patch, user, { ip } = {}) {
    if (id === user.id && (patch.active === false || (patch.role && patch.role !== user.role))) throw new AppError(409, 'SELF_CHANGE', 'Você não pode desativar nem mudar o papel da própria conta.')
    return sequelize.transaction(async (transaction) => {
      const target = await User.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!target) throw notFound('Conta')
      await assertKeepsAnAdmin(target, patch, transaction)
      const before = { name: target.name, role: target.role, active: target.active }
      await target.update(patch, { transaction })
      // mudou o acesso → derruba as sessões abertas dessa pessoa
      if ((patch.role && patch.role !== before.role) || patch.active === false) await Session.destroy({ where: { userId: id }, transaction })
      await audit.log({ userId: user.id, action: 'user.update', entity: 'user', entityId: id, meta: { before, after: patch }, ip, transaction })
      return publicUser(target)
    })
  }

  /** Administração define uma senha nova para alguém (ex.: esqueceu). Derruba as sessões dela. */
  async function resetUserPassword(id, password, user, { ip } = {}) {
    const target = await User.findByPk(id)
    if (!target) throw notFound('Conta')
    const problem = passwordProblem(password, target)
    if (problem) throw new AppError(422, 'WEAK_PASSWORD', problem)
    await User.update({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null }, { where: { id } })
    await Session.destroy({ where: { userId: id } })
    await audit.log({ userId: user.id, action: 'user.password_reset', entity: 'user', entityId: id, ip })
  }

  return { listOrders, getOrder, changeStatus, listCatalog, patchProduct, getStore, patchSettings, replaceHours, listZones, createZone, updateZone, deleteZone, listUsers, updateUser, resetUserPassword }
}
