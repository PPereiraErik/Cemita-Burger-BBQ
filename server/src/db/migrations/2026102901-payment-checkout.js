/**
 * Etapa 6 — pagamento online (Mercado Pago, Checkout Pro).
 * O pagamento guarda a referência da cobrança no gateway (id da preferência) e o link de pagamento,
 * para o cliente voltar a pagar pelo acompanhamento sem criar outra cobrança.
 * Nenhum dado de cartão: só ids e o link público do gateway.
 */
export async function up({ queryInterface, Sequelize }) {
  await queryInterface.addColumn('payments', 'provider_reference', { type: Sequelize.STRING(120), allowNull: true, comment: 'id da cobrança no gateway (preferência)' })
  await queryInterface.addColumn('payments', 'checkout_url', { type: Sequelize.STRING(600), allowNull: true, comment: 'link público de pagamento do gateway' })
}

export async function down({ queryInterface }) {
  await queryInterface.removeColumn('payments', 'checkout_url')
  await queryInterface.removeColumn('payments', 'provider_reference')
}
