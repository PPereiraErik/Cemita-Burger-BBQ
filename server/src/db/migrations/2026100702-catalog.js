import { TABLE_OPTIONS, cents, check, fk, id, timestamps } from './_helpers.js'

/**
 * Cardápio: categorias, produtos e personalização (grupos de opções).
 * Exclusão sempre lógica (active = false): pedidos antigos apontam para cá.
 */
export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable(
    'categories',
    {
      id: id(Sequelize),
      slug: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(80), allowNull: false },
      short_name: { type: Sequelize.STRING(30), allowNull: true },
      note: { type: Sequelize.STRING(200), allowNull: true },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )

  await queryInterface.createTable(
    'products',
    {
      id: id(Sequelize),
      category_id: fk(Sequelize, 'categories'),
      slug: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      description: { type: Sequelize.STRING(600), allowNull: true },
      price_cents: cents(Sequelize),
      price_from: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false, comment: '"a partir de": o preço final depende de opção' },
      orderable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true, comment: 'false = aparece no cardápio, mas não pode ser pedido pelo site' },
      available: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true, comment: 'false = esgotado hoje' },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      is_adult: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false, comment: '+18 (bebida alcoólica)' },
      image_key: { type: Sequelize.STRING(120), allowNull: true },
      vuca_ref: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, comment: 'id do produto no delivery VUCA (transição)' },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('products', ['category_id', 'position'])
  await check(queryInterface, 'products', 'chk_products_price', 'price_cents >= 0')

  await queryInterface.createTable(
    'option_groups',
    {
      id: id(Sequelize),
      key: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(80), allowNull: false },
      min_select: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      max_select: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      pending_review: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false, comment: 'dado não confirmado pela Cemita' },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await check(queryInterface, 'option_groups', 'chk_option_groups_select', 'max_select >= 1 AND min_select <= max_select')

  await queryInterface.createTable(
    'option_items',
    {
      id: id(Sequelize),
      group_id: fk(Sequelize, 'option_groups'),
      name: { type: Sequelize.STRING(80), allowNull: false },
      price_delta_cents: cents(Sequelize, { defaultValue: 0 }),
      available: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      pending_review: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('option_items', ['group_id', 'position'])
  await check(queryInterface, 'option_items', 'chk_option_items_price', 'price_delta_cents >= 0')

  await queryInterface.createTable(
    'product_option_groups',
    {
      product_id: { ...fk(Sequelize, 'products'), primaryKey: true },
      group_id: { ...fk(Sequelize, 'option_groups'), primaryKey: true },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    },
    TABLE_OPTIONS,
  )
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('product_option_groups')
  await queryInterface.dropTable('option_items')
  await queryInterface.dropTable('option_groups')
  await queryInterface.dropTable('products')
  await queryInterface.dropTable('categories')
}
