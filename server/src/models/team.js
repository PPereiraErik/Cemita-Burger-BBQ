import { DataTypes } from 'sequelize'
import { ROLES } from '../domain/constants.js'

/** Equipe do painel e auditoria. password_hash nunca sai do model por padrão. */
export function defineTeam(sequelize) {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false, validate: { len: [1, 80] } },
      email: { type: DataTypes.STRING(160), allowNull: false, unique: true, validate: { isEmail: true } },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      role: { type: DataTypes.ENUM(...ROLES), allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      failedLogins: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      lockedUntil: { type: DataTypes.DATE, allowNull: true },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'users',
      defaultScope: { attributes: { exclude: ['passwordHash'] } },
      scopes: { withPassword: { attributes: { include: ['passwordHash'] } } },
    },
  )

  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      action: { type: DataTypes.STRING(64), allowNull: false },
      entity: { type: DataTypes.STRING(40), allowNull: false },
      entityId: { type: DataTypes.STRING(40), allowNull: true },
      meta: { type: DataTypes.JSON, allowNull: true },
      ipHash: { type: DataTypes.CHAR(64), allowNull: true },
    },
    { tableName: 'audit_logs', updatedAt: false },
  )

  /**
   * Sessão do painel. `sid` = sha256 do token do cookie (o token em si nunca fica no banco).
   * `data` (JSON): { csrfHash } — sha256 do token anti-CSRF entregue no login.
   */
  const Session = sequelize.define(
    'Session',
    {
      sid: { type: DataTypes.STRING(128), primaryKey: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      expires: { type: DataTypes.DATE, allowNull: false },
      data: { type: DataTypes.TEXT, allowNull: false },
    },
    { tableName: 'sessions' },
  )

  AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' })
  Session.belongsTo(User, { foreignKey: 'userId', as: 'user' })
  return { User, AuditLog, Session }
}
