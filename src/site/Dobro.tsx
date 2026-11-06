import { EM_DOBRO } from '../config/promocoes'
import { Gravura, Kicker, Titulo } from './Gravura'

/**
 * Nº 02 — JOINVILLE EM DOBRO (fundo laranja, tinta escura).
 * As ofertas e regras vêm de config/promocoes.ts (prints do app, conferidos em 19/10/2026).
 * Sem `active`, a seção some do site e do menu.
 */
export function Dobro() {
  if (!EM_DOBRO.active) return null
  return (
    <section id="dobro" aria-labelledby="dobro-titulo" className="laranja relative overflow-hidden bg-laranja px-5 py-14 text-tinta md:px-12 md:py-[104px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14">
        <div className="flex flex-col gap-4">
          <Kicker n="02" tone="dark">
            joinville em dobro
          </Kicker>
          <Titulo id="dobro-titulo" a="Joinville em Dobro." b="Pede um, leva dois." className="text-[clamp(36px,5vw,60px)] leading-none" />
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[17px]">
            {EM_DOBRO.offers.map((o) => (
              <li key={o.id} className="flex gap-2">
                <span aria-hidden="true">✦</span>
                <span>
                  {o.headline}
                  {o.adult && <span className="ml-1.5 rounded-full border-[1.5px] border-tinta px-1.5 font-mono text-[11px]">+18</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-[15px]">
            {EM_DOBRO.essentials.slice(0, 2).join(' ')} Válido até {EM_DOBRO.validUntil}. Dias, horários e regras completas no aplicativo.
          </p>
          <a href={EM_DOBRO.programUrl} target="_blank" rel="noopener" className="t-kicker inline-flex min-h-11 items-center self-start font-medium text-tinta underline decoration-2 underline-offset-[6px] hover:text-vinho">
            VER NO APLICATIVO →
          </a>
        </div>
        <div className="flex w-full max-w-[520px] items-end gap-[4%] justify-self-center">
          <Gravura name="catedral" alt="Ilustração da Catedral de Joinville" className="w-[64%]" />
          <Gravura name="placa-joinville" className="w-[32%] rotate-3" />
        </div>
      </div>
    </section>
  )
}
