import fs from 'node:fs'
import { buildCategoryRows, buildComboRows, buildHoursRows, buildOptionRows, buildProductRows, DEFAULT_SETTINGS } from './catalog.js'

export const CATALOG_PATH = new URL('../seed-data/catalog.json', import.meta.url)
export const loadCatalog = () => JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))

/**
 * Popula o banco com o cardápio atual. Idempotente: rodar de novo não duplica
 * nem sobrescreve o que foi alterado depois pelo painel (preço, esgotado, configurações).
 * Não cria usuários, zonas, cupons nem política de privacidade.
 */
export async function seedDatabase(sequelize, { catalog = loadCatalog() } = {}) {
  const qi = sequelize.getQueryInterface()
  return sequelize.transaction(async (transaction) => {
    /**
     * Insere só as linhas cuja chave ainda não existe. (Não usa INSERT IGNORE:
     * no MySQL ele também engoliria violações de CHECK em silêncio.)
     */
    const insertMissing = async (table, rows, keys) => {
      if (!rows.length) return
      const cols = keys.map((k) => `\`${k}\``).join(', ')
      const [existing] = await sequelize.query(`SELECT ${cols} FROM \`${table}\``, { transaction })
      const seen = new Set(existing.map((r) => keys.map((k) => String(r[k])).join('|')))
      const missing = rows.filter((r) => !seen.has(keys.map((k) => String(r[k])).join('|')))
      if (missing.length) await qi.bulkInsert(table, missing, { transaction })
    }

    await insertMissing('categories', buildCategoryRows(catalog), ['slug'])
    const [cats] = await sequelize.query('SELECT id, slug FROM categories', { transaction })
    const categoryIdBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]))

    await insertMissing('products', buildProductRows(catalog, categoryIdBySlug), ['slug'])

    const combo = buildComboRows(catalog)
    await insertMissing('option_groups', [combo.group], ['key'])
    const [[group]] = await sequelize.query('SELECT id FROM option_groups WHERE `key` = ?', { replacements: ['combo'], transaction })
    const [[{ n }]] = await sequelize.query('SELECT COUNT(*) AS n FROM option_items WHERE group_id = ?', { replacements: [group.id], transaction })
    if (Number(n) === 0) await qi.bulkInsert('option_items', [{ ...combo.item, group_id: group.id }], { transaction })
    const [prods] = await sequelize.query('SELECT id FROM products WHERE slug IN (?)', { replacements: [combo.productSlugs], transaction })
    await insertMissing(
      'product_option_groups',
      prods.map((p) => ({ product_id: p.id, group_id: group.id, position: 0 })),
      ['product_id', 'group_id'],
    )

    // adicionais, ponto, molhos… e o combo com bebida: só cria o que falta (grupo por key;
    // itens só em grupo ainda vazio, para não desfazer o que o painel mudar depois)
    const options = buildOptionRows(catalog)
    await insertMissing('option_groups', options.groups.map((g) => g.row), ['key'])
    const [groupRows] = await sequelize.query('SELECT id, `key` FROM option_groups', { transaction })
    const groupIdByKey = Object.fromEntries(groupRows.map((g) => [g.key, g.id]))
    for (const g of options.groups) {
      const gid = groupIdByKey[g.row.key]
      const [[{ c }]] = await sequelize.query('SELECT COUNT(*) AS c FROM option_items WHERE group_id = ?', { replacements: [gid], transaction })
      if (Number(c) === 0 && g.items.length) await qi.bulkInsert('option_items', g.items.map((i) => ({ ...i, group_id: gid })), { transaction })
    }
    const [allProds] = await sequelize.query('SELECT id, slug FROM products', { transaction })
    const productIdBySlug = Object.fromEntries(allProds.map((p) => [p.slug, p.id]))
    await insertMissing(
      'product_option_groups',
      options.links.flatMap((l, li) => l.productSlugs.filter((s) => productIdBySlug[s]).map((s) => ({ product_id: productIdBySlug[s], group_id: groupIdByKey[l.groupKey], position: li }))),
      ['product_id', 'group_id'],
    )

    const [[{ h }]] = await sequelize.query('SELECT COUNT(*) AS h FROM store_hours', { transaction })
    if (Number(h) === 0) await qi.bulkInsert('store_hours', buildHoursRows(catalog.hours), { transaction })

    await insertMissing(
      'store_settings',
      DEFAULT_SETTINGS.map((s) => ({ key: s.key, value: s.value === null ? null : JSON.stringify(s.value) })),
      ['key'],
    )

    const [[counts]] = await sequelize.query(
      'SELECT (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM option_groups) AS optionGroups, (SELECT COUNT(*) FROM option_items) AS optionItems, (SELECT COUNT(*) FROM store_hours) AS hours, (SELECT COUNT(*) FROM store_settings) AS settings',
      { transaction },
    )
    return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)]))
  })
}
