import { defineCatalog } from './catalog.js'
import { defineEvents } from './events.js'
import { defineOrders } from './orders.js'
import { defineStore } from './store.js'
import { defineTeam } from './team.js'

/**
 * Registra todos os models numa instância do Sequelize e liga as relações
 * entre grupos (pedido → produto, histórico → usuário…).
 * O schema é das MIGRATIONS: nunca use sequelize.sync() fora dos testes de model.
 */
export function initModels(sequelize) {
  const catalog = defineCatalog(sequelize)
  const team = defineTeam(sequelize)
  const store = defineStore(sequelize)
  const orders = defineOrders(sequelize)
  const events = defineEvents(sequelize)

  const { Product, OptionItem } = catalog
  const { User } = team
  const { DeliveryZone, PrivacyPolicyVersion, StoreSetting } = store
  const { Order, OrderItem, OrderItemOption, OrderStatusHistory } = orders

  OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' })
  OrderItemOption.belongsTo(OptionItem, { foreignKey: 'optionItemId', as: 'optionItem' })
  Order.belongsTo(DeliveryZone, { foreignKey: 'deliveryZoneId', as: 'deliveryZone' })
  Order.belongsTo(PrivacyPolicyVersion, { foreignKey: 'privacyPolicyVersionId', as: 'privacyPolicyVersion' })
  OrderStatusHistory.belongsTo(User, { foreignKey: 'actorUserId', as: 'actor' })
  StoreSetting.belongsTo(User, { foreignKey: 'updatedByUserId', as: 'updatedBy' })

  return { ...catalog, ...team, ...store, ...orders, ...events }
}
