import { DataTypes } from 'sequelize'

/** Cardápio. Não existe "apagar": desative (active = false). */
export function defineCatalog(sequelize) {
  const Category = sequelize.define(
    'Category',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      slug: { type: DataTypes.STRING(60), allowNull: false, unique: true, validate: { is: /^[a-z0-9-]+$/ } },
      name: { type: DataTypes.STRING(80), allowNull: false, validate: { len: [1, 80] } },
      shortName: { type: DataTypes.STRING(30), allowNull: true },
      note: { type: DataTypes.STRING(200), allowNull: true },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'categories' },
  )

  const Product = sequelize.define(
    'Product',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      categoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true, validate: { is: /^[a-z0-9-]+$/ } },
      name: { type: DataTypes.STRING(120), allowNull: false, validate: { len: [1, 120] } },
      description: { type: DataTypes.STRING(600), allowNull: true },
      priceCents: { type: DataTypes.INTEGER, allowNull: false, validate: { isInt: true, min: 0 } },
      priceFrom: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      orderable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      isAdult: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      imageKey: { type: DataTypes.STRING(120), allowNull: true },
      vucaRef: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'products' },
  )

  const OptionGroup = sequelize.define(
    'OptionGroup',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      key: { type: DataTypes.STRING(60), allowNull: false, unique: true, validate: { is: /^[a-z0-9-]+$/ } },
      name: { type: DataTypes.STRING(80), allowNull: false },
      minSelect: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      maxSelect: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1, validate: { min: 1 } },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      pendingReview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'option_groups',
      validate: {
        minNotAboveMax() {
          if (this.minSelect > this.maxSelect) throw new Error('min_select não pode passar de max_select')
        },
      },
    },
  )

  const OptionItem = sequelize.define(
    'OptionItem',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      groupId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      name: { type: DataTypes.STRING(80), allowNull: false },
      priceDeltaCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { isInt: true, min: 0 } },
      available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      pendingReview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'option_items' },
  )

  const ProductOptionGroup = sequelize.define(
    'ProductOptionGroup',
    {
      productId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
      groupId: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'product_option_groups', timestamps: false },
  )

  Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' })
  Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' })
  OptionGroup.hasMany(OptionItem, { foreignKey: 'groupId', as: 'items' })
  OptionItem.belongsTo(OptionGroup, { foreignKey: 'groupId', as: 'group' })
  Product.belongsToMany(OptionGroup, { through: ProductOptionGroup, foreignKey: 'productId', otherKey: 'groupId', as: 'optionGroups' })
  OptionGroup.belongsToMany(Product, { through: ProductOptionGroup, foreignKey: 'groupId', otherKey: 'productId', as: 'products' })

  return { Category, Product, OptionGroup, OptionItem, ProductOptionGroup }
}
