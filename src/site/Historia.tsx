import { HISTORIA } from '../config/site'
import { Gravura, Kicker, Titulo } from './Gravura'

/** Nº 03 — A HISTÓRIA. Textos em config/site.ts (hoje, espaços reservados: dependem da Cemita). */
export function Historia() {
  return (
    <section id="historia" aria-labelledby="historia-titulo" className="secao relative overflow-hidden bg-secao px-5 py-14 md:px-12 md:py-[104px]">
      <Gravura name="teia" className="absolute -top-10 -right-10 hidden w-[200px] -scale-x-100 opacity-35 md:block" />
      <div className="relative mx-auto flex max-w-[1180px] flex-col gap-12">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14">
          <div className="flex flex-col gap-4">
            <Kicker n="03">a história</Kicker>
            <Titulo id="historia-titulo" a={HISTORIA.titulo} b={HISTORIA.virada} className="text-[clamp(36px,5vw,60px)] leading-none" />
            {HISTORIA.paragrafos.map((p) => (
              <p key={p} className="m-0 text-[17px] text-creme-3">
                {p}
              </p>
            ))}
          </div>
          <Gravura name="esqueleto-chapa" alt="Ilustração de um esqueleto barbudo de avental grelhando na chapa" className="w-full max-w-[440px] justify-self-center" />
        </div>
        <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-5 p-0 md:grid-cols-3 md:gap-8">
          {HISTORIA.curiosidades.map((c, i) => (
            <li key={c} className="flex items-start gap-4">
              <span aria-hidden="true" className="font-display text-[64px] leading-[0.8] text-laranja">
                {i + 1}
              </span>
              <p className="m-0">{c}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
