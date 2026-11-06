import { Fragment } from 'react'
import { FAIXA } from '../config/site'
import { Gravura } from './Gravura'

/** Faixa mostarda que corre (decorativa: leitores de tela pulam; parada com movimento reduzido). */
export function Faixa() {
  const palavras = (
    <>
      {FAIXA.map((p) => (
        <Fragment key={p}>
          <span>{p}</span>
          <Gravura name="caveirinha" className="w-[26px] brightness-[0.2] sepia" />
        </Fragment>
      ))}
    </>
  )
  return (
    <div aria-hidden="true" className="overflow-hidden bg-mostarda text-tinta">
      <div className="faixa-trilho flex w-max items-center gap-[26px] py-3 font-display text-[clamp(20px,4vw,26px)] tracking-[0.04em] whitespace-nowrap">
        {palavras}
        {palavras}
      </div>
    </div>
  )
}
