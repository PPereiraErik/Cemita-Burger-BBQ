import { formatPrice } from '../config/menu'
import type { OptionGroup } from '../config/options'

/**
 * Escolhas do produto (adicionais, molhos, ponto da carne, bebida do combo…).
 * Grupo obrigatório: aberto, como opção única (radio).
 * Grupo opcional: recolhido num <details> com o número de escolhas no título (o modal não vira um muro de opções).
 * Ao chegar no máximo do grupo, as outras opções ficam desabilitadas e o limite é dito em texto.
 */
export function OptionsPicker({ groups, value, onChange }: { groups: readonly OptionGroup[]; value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (g: OptionGroup, id: string) => {
    const inGroup = value.filter((v) => v.startsWith(`${g.id}:`))
    const others = value.filter((v) => !v.startsWith(`${g.id}:`))
    if (g.max === 1) return onChange(inGroup.includes(id) && !g.required ? others : [...others, id])
    if (inGroup.includes(id)) return onChange(value.filter((v) => v !== id))
    if (inGroup.length >= g.max) return
    onChange([...value, id])
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => {
        const chosen = value.filter((v) => v.startsWith(`${g.id}:`))
        const full = g.max > 1 && chosen.length >= g.max
        const rule = g.required ? 'obrigatório' : g.max > 1 ? `até ${g.max}` : 'opcional'
        const list = (
          <fieldset className="mt-1">
            <legend className="sr-only">
              {g.title} ({rule})
            </legend>
            <ul className={g.options.length > 5 && g.options.every((o) => o.price === 0) ? 'grid gap-x-4 sm:grid-cols-2' : 'divide-y divide-dashed divide-char/15'}>
              {g.options.map((o) => {
                const on = chosen.includes(o.id)
                const disabled = !on && full
                return (
                  <li key={o.id}>
                    <label className={`flex min-h-11 items-center gap-3 py-1.5 ${disabled ? 'opacity-45' : 'cursor-pointer'}`}>
                      <input
                        type={g.max === 1 ? 'radio' : 'checkbox'}
                        name={g.id}
                        checked={on}
                        disabled={disabled}
                        onChange={() => toggle(g, o.id)}
                        onClick={(e) => {
                          // radio opcional: clicar de novo desmarca
                          if (g.max === 1 && !g.required && on) {
                            e.preventDefault()
                            toggle(g, o.id)
                          }
                        }}
                        className="h-5 w-5 shrink-0 accent-[#3b393e]"
                      />
                      <span className="flex-1 leading-snug">{o.name}</span>
                      {o.price > 0 && <span className="t-price text-[0.92rem] text-mute">+ {formatPrice(o.price)}</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
            {full && (
              <p role="status" className="mt-1 text-[0.85rem] text-mute">
                Limite de {g.max} escolhas neste grupo.
              </p>
            )}
          </fieldset>
        )

        if (g.required)
          return (
            <section key={g.id} aria-labelledby={`grp-${g.id}`} className={`rounded-[10px] border-2 p-3 ${chosen.length ? 'border-char/25' : 'border-char'}`}>
              <h4 id={`grp-${g.id}`} className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                {g.title}
                <span className={`tag !py-0.5 ${chosen.length ? '' : '!bg-char !text-bone'}`}>{chosen.length ? '✓ escolhido' : 'obrigatório'}</span>
              </h4>
              {list}
            </section>
          )

        return (
          <details key={g.id} className="group rounded-[10px] border-2 border-char/25 px-3 open:border-char/50">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
              <span>
                {g.title} <span className="font-normal text-mute">({rule})</span>
              </span>
              <span className="flex items-center gap-2">
                {chosen.length > 0 && <span className="tag !py-0.5">{chosen.length} ✓</span>}
                <span aria-hidden="true" className="text-lg transition-transform group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <div className="pb-2">{list}</div>
          </details>
        )
      })}
    </div>
  )
}
