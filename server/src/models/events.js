import { DataTypes } from 'sequelize'

/** Eventos da Agenda (tabela events). A arte (image_data) só é lida pela rota da imagem. */
export function defineEvents(sequelize) {
  const Event = sequelize.define(
    'Event',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING(120), allowNull: false },
      startsAt: { type: DataTypes.DATE, allowNull: false },
      endsAt: { type: DataTypes.DATE, allowNull: true },
      summary: { type: DataTypes.STRING(300), allowNull: true },
      description: { type: DataTypes.STRING(1000), allowNull: true },
      highlights: { type: DataTypes.JSON, allowNull: true },
      reservation: { type: DataTypes.STRING(200), allowNull: true },
      instagramUrl: { type: DataTypes.STRING(300), allowNull: true },
      imageMime: { type: DataTypes.STRING(30), allowNull: true },
      imageData: { type: DataTypes.BLOB('medium'), allowNull: true },
      imageVersion: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      createdByUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      updatedByUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    },
    { tableName: 'events' },
  )
  return { Event }
}
