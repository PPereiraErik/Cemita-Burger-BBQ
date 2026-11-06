import { useEffect, useRef, useState, type AnchorHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { art, type ArtName } from '../config/art'
import { illus, type IllusName } from '../config/illustrations'
import { formatPrice, type MenuItem } from '../config/menu'
import { photo } from '../config/photos'
import { comanda, needsChoice } from '../lib/comanda'
import { openProduct } from '../lib/ui'
import { AVAILABILITY_LABEL, useAvailability, useItemPrice } from '../lib/live'
import { sound } from '../lib/sound'

/* Peças reaproveitadas em todo o site do Cemita. */

export function Img({ k, alt, className = '', priority, style, imgClassName = '', sizes }: { k: string; alt: string; className?: string; priority?: boolean; style?: CSSProperties; imgClassName?: string; sizes?: string }) {
  const src = photo(k)
  return (
    <div className={`relative overflow-hidden bg-char-2 ${className}`} style={style}>
      {src && (
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          draggable={false}
          className={`h-full w-full object-cover ${imgClassName}`}
        />
      )}
    </div>
  )
}

/**
 * Espaço da foto de um produto.
 * Com foto (src/assets/fotos/<k>.webp): a foto real.
 * Sem foto: um espaço marcado "foto em breve" — nunca uma imagem inventada.
 * Para preencher: salve a foto com o nome indicado em src/assets/fotos/LEIA-ME.md.
 */
export function PhotoSlot({ k, alt, className = '', size = 'md', priority }: { k: string; alt: string; className?: string; size?: 'sm' | 'md' | 'lg'; priority?: boolean }) {
  if (photo(k)) return <Img k={k} alt={alt} className={className} priority={priority} />
  return (
    <div role="img" aria-label={`${alt}. Foto em breve.`} data-photo-pending={k} className={`relative grid place-items-center overflow-hidden border-2 border-dashed border-tinta/30 bg-papel-2 text-tinta/45 ${className}`}>
      <Art name="caveira" className={`aspect-square ${size === 'sm' ? 'w-[38%]' : size === 'md' ? 'w-[26%]' : 'w-[18%]'} text-tinta/40`} />
      <span className={`t-label absolute inset-x-0 bottom-[8%] text-center leading-tight text-tinta/70 ${size === 'sm' ? '!text-[0.52rem] !tracking-[.08em]' : '!text-[0.66rem]'}`}>foto em breve</span>
    </div>
  )
}

/**
 * Ilustração da marca. Por padrão é decorativa (aria-hidden).
 * A cor vem de `color` (text-char, text-bone, text-lilac…).
 */
export function Art({ name, className = '', style, label }: { name: ArtName; className?: string; style?: CSSProperties; label?: string }) {
  const src = art(name)
  if (!src) return null
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`art pointer-events-none ${className}`}
      style={{ ['--art' as string]: `url("${src}")`, ...style }}
    />
  )
}

/** Ilustração colorida (caveira, ceifador): usa a imagem como está. */
export function ArtImage({ name, className = '', alt = '' }: { name: ArtName; className?: string; alt?: string }) {
  const src = art(name)
  if (!src) return null
  return <img src={src} alt={alt} aria-hidden={alt ? undefined : true} loading="lazy" decoding="async" draggable={false} className={`pointer-events-none select-none ${className}`} />
}

/** Foto impressa com borda e fita, como as presas na parede. */
export function Print({ k, alt, rotate = 0, className = '', tape = true, style }: { k: string; alt: string; rotate?: number; className?: string; tape?: boolean; style?: CSSProperties }) {
  return (
    <figure className={`relative bg-papel p-[4%] pb-[12%] shadow-[0_14px_30px_-14px_rgb(20_10_4/.7)] ${className}`} style={{ transform: `rotate(${rotate}deg)`, ...style }}>
      {tape && <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-[-3deg] bg-caramelo/70" />}
      <Img k={k} alt={alt} className="aspect-[4/5] w-full" />
    </figure>
  )
}

/** Link externo com cara de ticket. */
export function TicketLink({ children, className = '', href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  const external = /^https?:/.test(href ?? '')
  return (
    <a href={href} className={`btn-ticket ${className}`} {...(external ? { target: '_blank', rel: 'noopener' } : {})} {...rest}>
      {children}
    </a>
  )
}

/** Placa de rua: carvão com moldura creme. */
export function StreetSign({ top, main, bottom, className = '' }: { top?: string; main: string; bottom?: string; className?: string }) {
  return (
    <div className={`relative inline-block rounded-md border-[3px] border-osso bg-tinta px-5 py-3 text-osso shadow-[0_0_0_3px_var(--color-tinta)] ${className}`}>
      {top && <p className="t-label !text-[0.66rem] opacity-80">{top}</p>}
      <p className="t-display text-[clamp(1.6rem,3vw,2.4rem)] leading-tight">{main}</p>
      {bottom && <p className="t-label mt-1 !text-[0.66rem] opacity-80">{bottom}</p>}
    </div>
  )
}

/** Adesivo redondo. */
export function Sticker({ children, className = '', rotate = -8, style }: { children: ReactNode; className?: string; rotate?: number; style?: CSSProperties }) {
  return (
    <span className={`inline-grid place-items-center rounded-full text-center ${className}`} style={{ transform: `rotate(${rotate}deg)`, ...style }}>
      {children}
    </span>
  )
}

/** Rótulo de capítulo: "nº 02 — o defumador". */
export function Eyebrow({ n, children, className = '' }: { n: string; children: ReactNode; className?: string }) {
  return (
    <p className={`t-label flex items-center gap-3 ${className}`}>
      <span className="tag !text-[0.7rem]">nº {n}</span>
      <span>{children}</span>
    </p>
  )
}

/** Preço do cardápio (mono, nunca quebra). Vem da API quando ela está ligada. */
export function Price({ item, className = '' }: { item: MenuItem; className?: string }) {
  const price = useItemPrice(item.id, item.price)
  if (price == null) return null
  return (
    <span className={`t-price ${className}`}>
      {item.priceFrom && <span className="mr-1 text-[0.72em] font-normal opacity-75">a partir de</span>}
      {formatPrice(price)}
    </span>
  )
}

/** Carimbo de "esgotado"/"indisponível" no lugar do botão de anotar (só aparece com a API ligada). */
export function Unavailable({ item, className = '' }: { item: MenuItem; className?: string }) {
  const a = useAvailability(item.id)
  if (a === 'ok') return null
  return (
    <span role="status" className={`inline-flex min-h-11 shrink-0 -rotate-2 items-center rounded-[4px] border-2 border-blood px-3 font-mono text-[0.74rem] tracking-[.1em] text-blood uppercase ${className}`}>
      {AVAILABILITY_LABEL[a]}
    </span>
  )
}

/**
 * Botão de adicionar direto (sem abrir o produto).
 * Responde na hora: vira "✓ anotado" por um instante; a comanda e o aviso atualizam junto.
 */
export function AddButton({ item, className = '', label = 'Anotar', tone = 'dark' }: { item: MenuItem; className?: string; label?: string; tone?: 'dark' | 'light' }) {
  const [done, setDone] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  const availability = useAvailability(item.id)
  if (availability !== 'ok') return <Unavailable item={item} className={className} />
  const colors = tone === 'dark' ? 'bg-char text-bone hover:bg-caramelo-claro hover:text-tinta' : 'bg-bone text-char hover:bg-caramelo-claro hover:text-tinta'
  return (
    <button
      type="button"
      onClick={() => {
        if (needsChoice(item.id)) return openProduct(item.id)
        comanda.add(item)
        sound.tap()
        setDone(true)
        window.clearTimeout(t.current)
        t.current = window.setTimeout(() => setDone(false), 1400)
      }}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 font-mono text-[0.8rem] font-medium tracking-[.1em] uppercase transition-colors ${done ? '!bg-caramelo-claro !text-tinta' : colors} ${className}`}
      aria-label={needsChoice(item.id) ? `Escolher o ponto e anotar ${item.name}` : `Anotar ${item.name} na comanda`}
    >
      <span aria-hidden="true" className="text-base leading-none" style={done ? { animation: 'pop-in .3s ease-out' } : undefined}>
        {done ? '✓' : '+'}
      </span>
      {done ? 'Anotado' : label}
    </button>
  )
}

/**
 * Ilustração da marca (gravura creme sobre marrom, com transparência).
 * Decorativa por padrão (aria-hidden). Nunca usar no lugar da foto de um produto.
 */
export function Illus({ name, className = '', alt, style, priority }: { name: IllusName; className?: string; alt?: string; style?: CSSProperties; priority?: boolean }) {
  const src = illus(name)
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={`illus pointer-events-none select-none ${className}`}
      style={style}
    />
  )
}

/**
 * Moldura de cartaz antigo: filete duplo creme e cantoneiras.
 * `tone`: "osso" (linhas creme, para fundo marrom) ou "tinta" (linhas escuras, para papel).
 */
export function PosterFrame({ children, className = '', tone = 'osso' }: { children: ReactNode; className?: string; tone?: 'osso' | 'tinta' }) {
  const line = tone === 'osso' ? 'border-osso/80' : 'border-tinta/70'
  const corner = tone === 'osso' ? 'text-osso' : 'text-tinta'
  return (
    <div className={`relative border-2 ${line} p-1.5 ${className}`}>
      <div className={`relative h-full border ${line}`}>{children}</div>
      {(['top-0 left-0', 'top-0 right-0 rotate-90', 'bottom-0 right-0 rotate-180', 'bottom-0 left-0 -rotate-90'] as const).map((pos) => (
        <svg key={pos} aria-hidden="true" viewBox="0 0 24 24" className={`pointer-events-none absolute h-6 w-6 ${pos} ${corner}`}>
          <path d="M2 2h9M2 2v9M5 5h4M5 5v4" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12.5" cy="2.5" r="1.6" fill="currentColor" />
          <circle cx="2.5" cy="12.5" r="1.6" fill="currentColor" />
        </svg>
      ))}
    </div>
  )
}
