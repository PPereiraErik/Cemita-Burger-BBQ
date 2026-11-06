import { DataTypes } from 'sequelize'
import { ZONE_MATCH_TYPES } from '../domain/constants.js'

/** Configuração da loja (dados reais entram pelo painel, não por código). */
export function defineStore(sequelize) {
  const StoreHour = sequelize.define(
    'StoreHour',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      weekday: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, validate: { min: 0, max: 6 } },
      opensAt: { type: DataTypes.TIME, allowNull: false },
      closesAt: { type: DataTypes.TIME, allowNull: false },
    },
    { tableName: 'store_hours' },
  )

  const StoreSetting = sequelize.define(
    'StoreSetting',
    {
      key: { type: DataTypes.STRING(64), primaryKey: true },
      value: { type: DataTypes.JSON, allowNull: true },
      updatedByUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    },
    { tableName: 'store_settings' },
  )

  const DeliveryZone = sequelize.define(
    'DeliveryZone',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      matchType: { type: DataTypes.ENUM(...ZONE_MATCH_TYPES), allowNull: false },
      neighborhoods: { type: DataTypes.JSON, allowNull: true },
      cepStart: { type: DataTypes.CHAR(8), allowNull: true, validate: { is: /^\d{8}$/ } },
      cepEnd: { type: DataTypes.CHAR(8), allowNull: true, validate: { is: /^\d{8}$/ } },
      feeCents: { type: DataTypes.INTEGER, allowNull: false, validate: { isInt: true, min: 0 } },
      minOrderCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { isInt: true, min: 0 } },
      etaMinMinutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      etaMaxMinutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'delivery_zones',
      validate: {
        matchFields() {
          if (this.matchType === 'neighborhood' && !(Array.isArray(this.neighborhoods) && this.neighborhoods.length)) throw new Error('informe ao menos um bairro')
          if (this.matchType === 'cep_range' && !(this.cepStart && this.cepEnd && this.cepStart <= this.cepEnd)) throw new Error('faixa de CEP inválida')
        },
        etaOrder() {
          if (this.etaMinMinutes > this.etaMaxMinutes) throw new Error('prazo mínimo maior que o máximo')
        },
      },
    },
  )

  const PrivacyPolicyVersion = sequelize.define(
    'PrivacyPolicyVersion',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      version: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      url: { type: DataTypes.STRING(300), allowNull: false, validate: { isUrl: true } },
      publishedAt: { type: DataTypes.DATE, allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: 'privacy_policy_versions' },
  )

  return { StoreHour, StoreSetting, DeliveryZone, PrivacyPolicyVersion }
}
