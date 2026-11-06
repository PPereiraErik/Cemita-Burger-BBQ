import type { CSSProperties, ReactNode } from 'react'
import type { Foto } from '../config/midia'

/**
 * Polaroid com fita adesiva. Mostra a foto atual por cima da anterior (troca com cruzamento).
 * `aspect` é a proporção da janela da foto (1 = quadrada).
 */
export function Polaroid({
  foto,
  anterior,
  legenda,
  sizes,
  aspect = '1 / 1',
  style,
  className = '',
  fitaLeft = '33%',
  fitaRot = 0,
  eager,
  extra,
  as: Tag = 'figure',
}: {
  foto: Foto
  anterior?: Foto | null
  legenda: string
  sizes: string
  aspect?: string
  style?: CSSProperties
  className?: string
  fitaLeft?: string
  fitaRot?: number
  eager?: boolean
  /** conteúdo extra dentro da janela (ex.: vídeo, ícone de play) */
  extra?: ReactNode
  as?: 'figure' | 'div'
}) {
  return (
    <Tag className={`polaroid ${className}`} style={style}>
      <span aria-hidden="true" className="fita" style={{ left: fitaLeft, transform: `rotate(${fitaRot}deg)` }} />
      <div className="janela" style={{ aspectRatio: aspect }}>
        {anterior && anterior.src !== foto.src && (
          <img src={anterior.src} srcSet={anterior.srcset || undefined} sizes={sizes} alt="" aria-hidden="true" decoding="async" style={{ objectPosition: anterior.focus }} />
        )}
        <img
          key={foto.src}
          className={anterior ? 'entra' : undefined}
          src={foto.src}
          srcSet={foto.srcset || undefined}
          sizes={sizes}
          alt={foto.alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          style={{ objectPosition: foto.focus }}
        />
        {extra}
      </div>
      {Tag === 'figure' ? <figcaption>{legenda}</figcaption> : <span className="legenda">{legenda}</span>}
    </Tag>
  )
}
