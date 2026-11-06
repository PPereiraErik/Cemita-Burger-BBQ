import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatPrice, type MenuItem } from '../config/menu'
import { FOTO_TAMANHO } from '../config/fotosTamanho'
import { photo } from '../config/photos'
import { comanda, needsChoice } from '../lib/comanda'
import { AVAILABILITY_LABEL, useAvailability, useItemPrice } from '../lib/live'
import { sound } from '../lib/sound'
import { openProduct } from '../lib/ui'
import { IconPlus } from './Icons'
import { Preco, precoTexto } from './Tombstone'

/** "+" que anota na comanda (ou abre as opções obrigatórias), com ✓ de confirmação. */
export function useAnotar(item: MenuItem) {
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
  return { ok, anotar }
}

export function BotaoMais({ item, price, ok, onClick, className = '' }: { item: MenuItem; price: number | null; ok: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 transition-colors ${ok ? 'bg-laranja text-tinta' : 'bg-papel text-tinta hover:bg-laranja'} ${className}`}
      aria-label={needsChoice(item.id) ? `Escolher as opções e adicionar ${item.name} à comanda` : `Adicionar ${item.name} à comanda (${precoTexto(price, item.priceFrom)})`}
    >
      {ok ? <span aria-hidden="true">✓</span> : <IconPlus />}
    </button>
  )
}

/**
 * PRATO — o cardápio em formato de menu impresso: foto grande que se dissolve no fundo escuro,
 * nome, preço e a descrição inteira à vista (nada escondido atrás de um giro).
 * Tocar na foto ou no nome abre os detalhes (combo, adicionais, observação); o "+" anota na comanda.
 */
export function Prato({ item, className = '', style }: { item: MenuItem; className?: string; style?: CSSProperties }) {
  const price = useItemPrice(item.id, item.price)
  const disp = useAvailability(item.id)
  const adulto = item.tags?.includes('+18')
  const src = photo(`cardapio/destaque/${item.id}`) ?? photo(`cardapio/${item.id}`)
  const [w, h] = FOTO_TAMANHO[item.id] ?? [4, 3]
  const { ok, anotar } = useAnotar(item)

  return (
    <article className={`prato ${className}`} style={style} aria-label={item.name}>
      <button type="button" onClick={() => openProduct(item.id)} className="prato-abre" aria-label={`Ver detalhes de ${item.name}`}>
        <span className="prato-foto" aria-hidden="true">
          {src ? (
            <img src={src} width={w} height={h} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="prato-sem-foto">FOTO EM BREVE</span>
          )}
        </span>
        <span className="prato-nome">{item.name}</span>
      </button>
      {(adulto || disp !== 'ok') && (
        <span className="flex justify-center gap-1">
          {adulto && <span className="rounded-full bg-tinta px-1.5 font-mono text-[10px] text-creme">+18</span>}
          {disp !== 'ok' && <span className="rounded-full bg-vinho px-1.5 font-mono text-[10px] text-creme">{AVAILABILITY_LABEL[disp].toUpperCase()}</span>}
        </span>
      )}
      <div className="flex items-center justify-center gap-2.5">
        <Preco price={price} from={item.priceFrom} className="prato-preco" />
        {disp === 'ok' && <BotaoMais item={item} price={price} ok={ok} onClick={anotar} className="h-9 w-9 before:absolute before:-inset-1 before:content-[''] relative" />}
      </div>
      {item.description && <p className="prato-desc">{item.description}</p>}
    </article>
  )
}

/** LINHA DE BEBIDA — lista compacta (cervejas e bebidas): miniatura com o fundo original, nome, preço e "+". */
export function LinhaBebida({ item }: { item: MenuItem }) {
  const price = useItemPrice(item.id, item.price)
  const disp = useAvailability(item.id)
  const adulto = item.tags?.includes('+18')
  const src = photo(`cardapio/${item.id}`)
  const { ok, anotar } = useAnotar(item)
  return (
    <div className="bebida" aria-label={item.name} role="group">
      <button type="button" onClick={() => openProduct(item.id)} className="bebida-abre" aria-label={`Ver detalhes de ${item.name}`}>
        <span className="bebida-foto" aria-hidden="true">
          {src ? <img src={src} width={206} height={130} alt="" loading="lazy" decoding="async" /> : null}
        </span>
        <span className="min-w-0">
          <span className="bebida-nome">{item.name}</span>
          {item.description && <span className="bebida-desc">{item.description}</span>}
          <span className="bebida-preco">
            {item.priceFrom ? 'a partir de ' : ''}
            {price == null ? 'R$ [00,00]' : formatPrice(price)}
            {adulto && <span className="ml-2 rounded-full bg-tinta px-1.5 font-mono text-[10px] text-creme">+18</span>}
          </span>
        </span>
      </button>
      {disp === 'ok' ? (
        <BotaoMais item={item} price={price} ok={ok} onClick={anotar} />
      ) : (
        <span className="rounded-full bg-vinho px-2 py-1 font-mono text-[10px] text-creme">{AVAILABILITY_LABEL[disp].toUpperCase()}</span>
      )}
    </div>
  )
}
