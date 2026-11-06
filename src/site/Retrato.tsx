import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { MenuItem } from '../config/menu'
import { FOTO_TAMANHO } from '../config/fotosTamanho'
import { photo } from '../config/photos'
import { comanda, needsChoice } from '../lib/comanda'
import { AVAILABILITY_LABEL, useAvailability, useItemPrice } from '../lib/live'
import { sound } from '../lib/sound'
import { openProduct } from '../lib/ui'
import { IconPlus } from './Icons'
import { Preco, precoTexto } from './Tombstone'

/** Ornamento do canto da moldura (traço creme). */
function Canto({ className }: { className: string }) {
  return (
    <svg className={`canto ${className}`} viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      <path d="M2 28 L2 2 L28 2" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M7 22 C7 12 12 7 22 7" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="9" r="2.2" fill="currentColor" />
    </svg>
  )
}

/**
 * RETRATO — para BBQ e sobremesa: a foto INTEIRA (sem corte) numa moldura pendurada
 * na parede do cemitério, com a plaquinha de pedra embaixo: nome, ingredientes, preço e "+" à vista,
 * sem precisar virar nada. "Detalhes" abre a janela do produto (combo, adicionais, observação).
 * `quadrada` (cervejas e bebidas): quadro quadrado com o fundo da foto; a bebida, que está no centro, aparece maior.
 * Foto tratada para o destaque (cardapio/destaque/<id>) tem preferência sobre a original.
 */
export function Retrato({ item, quadrada = false, className = '', style }: { item: MenuItem; quadrada?: boolean; className?: string; style?: CSSProperties }) {
  const price = useItemPrice(item.id, item.price)
  const disp = useAvailability(item.id)
  const adulto = item.tags?.includes('+18')
  const src = photo(`cardapio/destaque/${item.id}`) ?? photo(`cardapio/${item.id}`)
  const [w, h] = FOTO_TAMANHO[item.id] ?? [4, 3]
  const alt = item.description ? `${item.name}: ${item.description}` : item.name
  const etiquetas = (adulto || disp !== 'ok') && (
    <span className="absolute inset-x-0 bottom-1.5 z-[1] flex justify-center gap-1">
      {adulto && <span className="rounded-full bg-tinta/85 px-1.5 font-mono text-[10px] text-creme">+18</span>}
      {disp !== 'ok' && <span className="rounded-full bg-vinho px-1.5 font-mono text-[10px] text-creme">{AVAILABILITY_LABEL[disp].toUpperCase()}</span>}
    </span>
  )

  const [ok, setOk] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  const anotar = () => {
    if (needsChoice(item.id)) return openProduct(item.id)
    comanda.add(item)
    sound.tap()
    setOk(true)
    window.clearTimeout(t.current)
    t.current = window.setTimeout(() => setOk(false), 1300)
  }

  return (
    <article className={`retrato ${quadrada ? 'is-quadrada' : ''} ${className}`} style={style} aria-label={item.name}>
      <svg className="retrato-arame" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M2 25 L50 4 L98 25" fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <circle cx="50" cy="4" r="3" fill="currentColor" />
      </svg>
      <button type="button" onClick={() => openProduct(item.id)} className="retrato-moldura block w-full text-left" aria-label={`Ver detalhes de ${item.name}`}>
        <Canto className="a" />
        <Canto className="b" />
        <Canto className="c" />
        <Canto className="d" />
        <span className="retrato-foto block" style={{ aspectRatio: quadrada ? '1 / 1' : `${w} / ${h}` }}>
          {src ? (
            <img src={src} width={w} height={h} alt={alt} loading="lazy" decoding="async" />
          ) : (
            <span className="grid h-full place-items-center font-mono text-[0.7rem] tracking-[0.14em] text-creme-3">FOTO EM BREVE</span>
          )}
          {etiquetas}
        </span>
      </button>
      <div className="retrato-placa">
        <h3 className="lapide-nome entalhe m-0 text-[length:clamp(1rem,8cqi,1.6rem)]">{item.name}</h3>
        {item.description && <p className="m-0 line-clamp-3 text-[length:clamp(0.75rem,4.6cqi,0.95rem)] leading-[1.4] text-creme-3">{item.description}</p>}
        <div className="mt-auto flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1">
          <Preco price={price} from={item.priceFrom} className="text-[length:clamp(0.85rem,5.6cqi,1.15rem)] font-medium" />
          {disp === 'ok' ? (
            <button
              type="button"
              onClick={anotar}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 transition-colors ${ok ? 'bg-laranja text-tinta' : 'bg-papel text-tinta hover:bg-laranja'}`}
              aria-label={needsChoice(item.id) ? `Escolher as opções e adicionar ${item.name} à comanda` : `Adicionar ${item.name} à comanda (${precoTexto(price, item.priceFrom)})`}
            >
              {ok ? <span aria-hidden="true">✓</span> : <IconPlus />}
            </button>
          ) : (
            <span className="rounded-full bg-vinho px-2 py-1 font-mono text-[10px] text-creme">{AVAILABILITY_LABEL[disp].toUpperCase()}</span>
          )}
        </div>
        <button type="button" onClick={() => openProduct(item.id)} className="min-h-11 font-mono text-[11px] tracking-[0.14em] text-creme-2 underline underline-offset-2 hover:text-laranja" aria-label={`Detalhes de ${item.name}`}>
          DETALHES
        </button>
      </div>
    </article>
  )
}
