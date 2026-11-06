/**
 * DADOS DE DESENVOLVIMENTO — fictícios, NUNCA reais e NUNCA em produção.
 * Servem para testar o pedido de ponta a ponta antes de a Cemita definir as regras reais.
 * Tudo aqui é marcado no próprio nome ("TESTE", "DEV") para não ser confundido.
 */
export const DEV_MARK = '[DEV]'

export const DEV_DATA = {
  privacyPolicy: { version: 'DEV-0', url: 'http://localhost:5173/politica-de-privacidade-RASCUNHO-DEV', active: true },
  zones: [
    {
      name: `${DEV_MARK} Bairro de Teste (fictício)`,
      match_type: 'neighborhood',
      neighborhoods: JSON.stringify(['Bairro de Teste']),
      fee_cents: 500,
      min_order_cents: 0,
      eta_min_minutes: 30,
      eta_max_minutes: 50,
      active: true,
      position: 0,
    },
    {
      name: `${DEV_MARK} Faixa de CEP de teste (fictícia)`,
      match_type: 'cep_range',
      cep_start: '00000100',
      cep_end: '00000199',
      fee_cents: 800,
      min_order_cents: 3000,
      eta_min_minutes: 40,
      eta_max_minutes: 60,
      active: true,
      position: 1,
    },
  ],
  settings: { ordering_mode: 'both' },
}

export async function seedDevData(sequelize, { nodeEnv }) {
  if (nodeEnv === 'production') throw new Error('seed de desenvolvimento é proibido em produção')
  const qi = sequelize.getQueryInterface()
  return sequelize.transaction(async (transaction) => {
    const [[p]] = await sequelize.query('SELECT COUNT(*) AS n FROM privacy_policy_versions WHERE version = ?', { replacements: [DEV_DATA.privacyPolicy.version], transaction })
    if (Number(p.n) === 0) await qi.bulkInsert('privacy_policy_versions', [{ ...DEV_DATA.privacyPolicy, published_at: new Date() }], { transaction })
    for (const z of DEV_DATA.zones) {
      const [[c]] = await sequelize.query('SELECT COUNT(*) AS n FROM delivery_zones WHERE name = ?', { replacements: [z.name], transaction })
      if (Number(c.n) === 0) await qi.bulkInsert('delivery_zones', [z], { transaction })
    }
    for (const [key, value] of Object.entries(DEV_DATA.settings)) {
      await sequelize.query('UPDATE store_settings SET value = ? WHERE `key` = ?', { replacements: [JSON.stringify(value), key], transaction })
    }
    return { policy: DEV_DATA.privacyPolicy.version, zones: DEV_DATA.zones.length, orderingMode: DEV_DATA.settings.ordering_mode }
  })
}
