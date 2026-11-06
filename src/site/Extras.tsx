import { COMBO_PRICE, formatPrice } from '../config/menu'
import { COMBO_DRINKS, COMBO_INCLUDES, groupsFor, type OptionGroup } from '../config/options'
import { COMBO_CATEGORIES } from '../lib/comanda'

/** Título curto de cada grupo no quadro (os títulos do delivery são frases: "Vai um adicional aí?"). */
const TITULO: Record<string, string> = {
  adicional: 'Adicionais',
  molho: 'Molhos',
  acompanhamento: 'Acompanhamentos',
  fritas: 'Batata frita',
  'carne-smash': 'Carne extra',
  'carne-grelhado': 'Carne extra',
  'carne-vegana': 'Carne vegana',
  sobremesa: 'Sobremesa',
}
const precoExtra = (n: number) => `+ ${formatPrice(n)}`.replace(/\s/g, ' ')

/**
 * Quadros embaixo da grade, como no menu impresso: "Monte seu combo" (smash, grelhado e sanduíche)
 * e os adicionais/acompanhamentos/molhos que o delivery oferece naquela categoria (config/options.ts).
 * Só informação: a escolha é feita no "+" ou em "detalhes" de cada produto.
 */
export function Extras({ categoria }: { categoria: string }) {
  const grupos = groupsFor(categoria).filter((g) => !g.required)
  const grandes = grupos.filter((g) => g.options.length > 1)
  const pequenos = grupos.filter((g) => g.options.length === 1)
  const combo = COMBO_CATEGORIES.has(categoria)
  if (!combo && !grupos.length) return null

  return (
    <div className="extras">
      {combo && (
        <section className="quadro quadro-combo" aria-labelledby={`combo-${categoria}`}>
          <h3 id={`combo-${categoria}`} className="quadro-titulo">
            Monte seu combo
          </h3>
          <p className="m-0 font-display text-[clamp(1.05rem,2.4vw,1.3rem)] leading-tight text-creme">
            {COMBO_INCLUDES} <span className="whitespace-nowrap text-laranja">{precoExtra(COMBO_PRICE)}</span>
          </p>
          <p className="m-0 text-[13px] leading-snug text-creme-3">
            Bebidas do combo: {COMBO_DRINKS.options.map((o) => o.name).join(' · ')}.
          </p>
          <p className="m-0 font-mono text-[11px] tracking-[0.12em] text-creme-2">ESCOLHA O COMBO NOS DETALHES DE CADA LANCHE</p>
        </section>
      )}
      {grandes.map((g) => (
        <Quadro key={g.id} grupo={g} />
      ))}
      {pequenos.length > 0 && (
        <section className="quadro" aria-label="Extras">
          <h3 className="quadro-titulo">Extras</h3>
          <ul className="quadro-lista">
            {pequenos.map((g) => (
              <li key={g.id}>
                <span>{g.options[0].name}</span>
                <span className="quadro-preco">{precoExtra(g.options[0].price)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Quadro({ grupo }: { grupo: OptionGroup }) {
  const id = `quadro-${grupo.id}`
  return (
    <section className="quadro" aria-labelledby={id}>
      <h3 id={id} className="quadro-titulo">
        {TITULO[grupo.id] ?? grupo.title}
      </h3>
      <ul className={`quadro-lista ${grupo.options.length > 4 ? 'is-2col' : ''}`}>
        {grupo.options.map((o) => (
          <li key={o.id}>
            <span>{o.name}</span>
            <span className="quadro-preco">{precoExtra(o.price)}</span>
          </li>
        ))}
      </ul>
      {grupo.max > 1 && <p className="m-0 font-mono text-[11px] tracking-[0.12em] text-creme-2">ATÉ {grupo.max} POR ITEM</p>}
    </section>
  )
}
