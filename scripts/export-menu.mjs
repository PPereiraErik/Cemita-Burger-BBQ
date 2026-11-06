/**
 * Exporta o cardápio atual (src/config/menu.ts + horário de src/config/restaurant.ts)
 * para server/src/db/seed-data/catalog.json — os dados iniciais do banco.
 * Uso (na raiz do projeto, depois de npm install):
 *   node scripts/export-menu.mjs           gera o arquivo
 *   node scripts/export-menu.mjs --check   só confere se o arquivo está igual ao menu.ts (sai com erro se não)
 * Usa o esbuild que já vem com o Vite.
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'server/src/db/seed-data/catalog.json')
const tmp = path.join(root, 'server/.export-menu.tmp.mjs')

await build({
  stdin: {
    contents:
      "export { menu, COMBO_PRICE, COMBO_NOTE, MENU_PRICES_CHECKED_AT } from './src/config/menu'; export { restaurant } from './src/config/restaurant'; export { GROUPS, GROUPS_BY_CATEGORY, COMBO_DRINKS, COMBO_INCLUDES } from './src/config/options'",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: tmp,
  logLevel: 'error',
})
const m = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`)
fs.rmSync(tmp)

const toCents = (v) => Math.round(v * 100)
const catalog = {
  source: 'src/config/menu.ts (delivery público, conferido em ' + m.MENU_PRICES_CHECKED_AT + ')',
  pricesCheckedAt: m.MENU_PRICES_CHECKED_AT,
  categories: m.menu.map((c, ci) => ({
    slug: c.id,
    name: c.label,
    shortName: c.short ?? null,
    note: c.note ?? null,
    position: ci,
    products: c.items.map((it, ii) => ({
      slug: it.id,
      name: it.name,
      description: it.description ?? null,
      priceCents: it.price == null ? null : toCents(it.price),
      priceFrom: !!it.priceFrom,
      isAdult: !!it.tags?.includes('+18'),
      tags: (it.tags ?? []).filter((t) => t !== '+18'),
      vucaRef: it.orderId ?? null,
      position: ii,
    })),
  })),
  combo: {
    priceCents: toCents(m.COMBO_PRICE),
    note: m.COMBO_NOTE,
    includes: m.COMBO_INCLUDES,
    // a bebida faz parte do combo: cada bebida vira uma opção "Combo + <bebida>" no banco
    drinks: m.COMBO_DRINKS.options.map((o) => o.name),
  },
  // adicionais, molhos, ponto da carne… (src/config/options.ts, prints do delivery de 08/10/2026)
  options: {
    groups: Object.values(m.GROUPS).map((g) => ({
      key: g.id,
      name: g.title,
      minSelect: g.required ? 1 : 0,
      maxSelect: g.max,
      items: g.options.map((o) => ({ name: o.name, priceCents: toCents(o.price) })),
    })),
    byCategory: Object.fromEntries(Object.entries(m.GROUPS_BY_CATEGORY).map(([cat, a]) => [cat, { groups: a.groups.map((g) => g.id), source: a.source }])),
  },
  hours: m.restaurant.hours,
}
const json = JSON.stringify(catalog, null, 2) + '\n'
if (process.argv.includes('--check')) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''
  if (current !== json) {
    console.error('catalog.json está diferente de src/config/menu.ts: rode node scripts/export-menu.mjs')
    process.exit(1)
  }
  console.log('ok: catalog.json igual ao menu.ts')
  process.exit(0)
}
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, json)
console.log(`ok: ${catalog.categories.length} categorias, ${catalog.categories.reduce((n, c) => n + c.products.length, 0)} produtos → ${path.relative(root, out)}`)
