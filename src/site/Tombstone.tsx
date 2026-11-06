import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatPrice, type MenuItem } from '../config/menu'
import { photo } from '../config/photos'
import { INGREDIENTES_PENDENTES, SEM_INGREDIENTES } from '../config/site'
import { canCombo, comanda, needsChoice } from '../lib/comanda'
import { AVAILABILITY_LABEL, useAvailability, useItemPrice } from '../lib/live'
import { sound } from '../lib/sound'
import { openProduct } from '../lib/ui'
import { IconPlus } from './Icons'
import { Pedra } from './Pedras'
import { useCabe } from './useCabe'

/** Preço como no cardápio: "R$ 39,00", "a partir de R$ 15,00"; sem preço = espaço reservado. */
export function precoTexto(price: number | null, from?: boolean) {
  if (price == null) return 'R$ [00,00]'
  return `${from ? 'a partir de ' : ''}${formatPrice(price)}`.replace(/\s/g, ' ')
}

/** Preço na pedra: "a partir de" numa linha menor em cima; o valor nunca quebra. */
export function Preco({ price, from, className = '' }: { price: number | null; from?: boolean; className?: string }) {
  return (
    <span className={`lapide-preco flex flex-col items-center leading-tight ${className}`}>
      {from && <span className="text-[0.82em]">a partir de</span>}
      <span>{price == null ? 'R$ [00,00]' : formatPrice(price)}</span>
    </span>
  )
}

/**
 * LÁPIDE — um item do cardápio.
 * Frente (botão): foto em moldura de arco, nome, preço e "VIRAR ↻" na base. Tocar gira a pedra (0,55 s).
 * Verso: "AQUI JAZ", nome, ingredientes, preço e "+" (anota na comanda); "↺ VOLTAR" gira de volta.
 * Cada lápide gira sozinha. A face escondida fica `inert` (fora do teclado e do leitor de tela).
 */
export function Tombstone({
  item,
  categoryId,
  variant,
  virada,
  onVirar,
  className = '',
  style,
}: {
  item: MenuItem
  categoryId: string
  variant: 0 | 1 | 2
  virada: boolean
  onVirar: () => void
  className?: string
  style?: CSSProperties
}) {
  const price = useItemPrice(item.id, item.price)
  const disp = useAvailability(item.id)
  const preco = precoTexto(price, item.priceFrom)
  const adulto = item.tags?.includes('+18')
  const mini = photo(`cardapio/mini/${item.id}`)
  const grande = photo(`cardapio/${item.id}`)
  const ingredientes = SEM_INGREDIENTES.has(categoryId) ? item.description ?? '' : item.description ?? INGREDIENTES_PENDENTES
  // frente: resumo curto dos ingredientes (só quando o cardápio tem descrição)
  const resumo = item.description ?? ''

  const frente = useRef<HTMLButtonElement>(null)
  const verso = useRef<HTMLDivElement>(null)
  const dentroFrente = useRef<HTMLSpanElement>(null)
  const dentroVerso = useRef<HTMLDivElement>(null)
  const pelaPessoa = useRef(false)
  useCabe(dentroFrente, [item.id, preco, disp, resumo])
  useCabe(dentroVerso, [item.id, preco, disp, ingredientes])

  // depois de girar pela pessoa, o foco vai para a face que apareceu
  useEffect(() => {
    if (!pelaPessoa.current) return
    pelaPessoa.current = false
    if (virada) verso.current?.querySelector<HTMLElement>('[data-foco]')?.focus({ preventScroll: true })
    else frente.current?.focus({ preventScroll: true })
  }, [virada])
  const virar = () => {
    pelaPessoa.current = true
    onVirar()
  }

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
    <article className={`lapide ${virada ? 'virada' : ''} ${className}`} data-v={variant} style={style} aria-label={item.name}>
      <div className="lapide-giro">
        {/* FRENTE */}
        <button
          ref={frente}
          type="button"
          className="lapide-face lapide-frente group"
          onClick={virar}
          inert={virada}
          aria-label={`${item.name}, ${preco}${disp !== 'ok' ? `, ${AVAILABILITY_LABEL[disp]}` : ''}. Virar a lápide para ver os ingredientes`}
        >
          <Pedra variant={variant} />
          <span ref={dentroFrente} className="lapide-dentro" style={{ fontSize: 'calc(var(--fit, 1) * 1em)' }}>
            <span className="lapide-foto" aria-hidden="true">
              {grande ? (
                <img src={mini ?? grande} srcSet={mini ? `${mini} 400w, ${grande} 1080w` : undefined} sizes="(max-width: 559px) 60vw, (max-width: 1023px) 30vw, 240px" alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="grid h-full place-items-center font-mono text-[0.6em] tracking-[0.14em] text-creme-3">FOTO EM BREVE</span>
              )}
              {(adulto || disp !== 'ok') && (
                <span className="absolute inset-x-0 bottom-1 flex justify-center gap-1">
                  {adulto && <span className="rounded-full bg-tinta/85 px-1.5 font-mono text-[max(10px,0.55em)] text-creme">+18</span>}
                  {disp !== 'ok' && <span className="rounded-full bg-vinho px-1.5 font-mono text-[max(10px,0.55em)] text-creme">{AVAILABILITY_LABEL[disp].toUpperCase()}</span>}
                </span>
              )}
            </span>
            <span className="lapide-nome entalhe mt-[0.2em] block text-[length:clamp(0.95rem,8.6cqi,1.7rem)]">{item.name}</span>
            <Preco price={price} from={item.priceFrom} className="text-[length:clamp(0.75rem,5.2cqi,1.1rem)] font-medium" />
            {resumo && (
              <span data-resumo className="line-clamp-3 text-[length:clamp(0.6875rem,4.2cqi,0.9rem)] leading-[1.35] text-creme-3">
                {resumo}
              </span>
            )}
            {/* "R · I · P" gravado no pé da pedra, só quando sobra espaço (useCabe tira se não couber) */}
            <span data-rip className="lapide-rip" aria-hidden="true">
              R · I · P
            </span>
          </span>
          <span className="lapide-base" aria-hidden="true">
            <span className="font-mono text-[length:clamp(9px,3.2cqi,11px)] tracking-[0.16em] text-creme-2 group-hover:text-laranja">VIRAR ↻</span>
          </span>
        </button>

        {/* VERSO */}
        <div
          ref={verso}
          className="lapide-face lapide-verso"
          inert={!virada}
          role="group"
          aria-label={`${item.name}: ingredientes`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              virar()
            }
          }}
        >
          <Pedra variant={variant} verso />
          <div ref={dentroVerso} className="lapide-dentro justify-center" style={{ fontSize: 'calc(var(--fit, 1) * 1em)' }}>
            <span className="font-mono text-[length:clamp(9px,3.2cqi,11px)] tracking-[0.2em] text-creme-2" aria-hidden="true">
              AQUI JAZ
            </span>
            <h3 className="lapide-nome entalhe m-0 text-[length:clamp(0.95rem,8.2cqi,1.7rem)] text-laranja">{item.name}</h3>
            <span aria-hidden="true" className="so-largo h-px w-2/5 shrink-0 bg-creme/30" />
            {ingredientes && (
              <p data-corta className="m-0 text-[length:clamp(0.6875rem,4.6cqi,1rem)] leading-[1.4] text-creme-3">
                {ingredientes}
              </p>
            )}
            <div className="mt-[0.15em] flex w-full items-center justify-center gap-2">
              <Preco price={price} from={item.priceFrom} className="min-w-0 text-[length:clamp(0.72rem,4.6cqi,1.05rem)]" />
              {disp === 'ok' ? (
                <button
                  type="button"
                  data-foco
                  onClick={anotar}
                  className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full border-0 transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] ${ok ? 'bg-laranja text-tinta' : 'bg-papel text-tinta hover:bg-laranja'}`}
                  aria-label={needsChoice(item.id) ? `Escolher as opções e adicionar ${item.name} à comanda` : `Adicionar ${item.name} à comanda`}
                >
                  {ok ? <span aria-hidden="true">✓</span> : <IconPlus />}
                </button>
              ) : (
                <span className="rounded-full bg-vinho px-2 py-1 font-mono text-[10px] text-creme">{AVAILABILITY_LABEL[disp].toUpperCase()}</span>
              )}
            </div>
          </div>
          <span className="lapide-base gap-[4%]">
            <button type="button" onClick={virar} {...(disp === 'ok' ? {} : { 'data-foco': true })} aria-label={`Voltar para a frente de ${item.name}`} className="min-h-11 px-1.5 font-mono text-[length:clamp(9px,3.2cqi,11px)] tracking-[0.14em] text-creme-2 hover:text-laranja">
              ↺ VOLTAR
            </button>
            <button type="button" onClick={() => openProduct(item.id)} aria-label={`Detalhes${canCombo(item.id) ? ', combo' : ''} e observação de ${item.name}`} className="min-h-11 px-1.5 font-mono text-[length:clamp(9px,3.2cqi,11px)] tracking-[0.14em] text-creme-2 underline underline-offset-2 hover:text-laranja">
              DETALHES
            </button>
          </span>
        </div>
      </div>
    </article>
  )
}
