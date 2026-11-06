import { TABLE_OPTIONS, fk, id, timestamps } from './_helpers.js'

/**
 * Eventos da casa (shows, stand-up, festas temáticas) para a Agenda do site.
 * Cadastrados pela equipe no painel (com ajuda opcional de IA a partir do post do Instagram).
 * A arte fica no próprio banco (até ~1,5 MB, já reduzida no navegador): nada de pasta de uploads no servidor.
 */
export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable(
    'events',
    {
      id: id(Sequelize),
      title: { type: Sequelize.STRING(120), allowNull: false },
      starts_at: { type: Sequelize.DATE, allowNull: false, comment: 'UTC' },
      ends_at: { type: Sequelize.DATE, allowNull: true, comment: 'UTC; vazio = o evento sai da agenda 6 h depois do início' },
      summary: { type: Sequelize.STRING(300), allowNull: true, comment: 'linha curta: atração' },
      description: { type: Sequelize.STRING(1000), allowNull: true },
      highlights: { type: Sequelize.JSON, allowNull: true, comment: 'lista curta de destaques' },
      reservation: { type: Sequelize.STRING(200), allowNull: true, comment: 'como reservar, como está no post' },
      instagram_url: { type: Sequelize.STRING(300), allowNull: true },
      image_mime: { type: Sequelize.STRING(30), allowNull: true },
      image_data: { type: Sequelize.BLOB('medium'), allowNull: true },
      image_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      created_by_user_id: fk(Sequelize, 'users', { allowNull: true }),
      updated_by_user_id: fk(Sequelize, 'users', { allowNull: true }),
      ...timestamps(Sequelize),
    },
    TABLE_OPTIONS,
  )
  await queryInterface.addIndex('events', ['status', 'starts_at'])
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('events')
}
