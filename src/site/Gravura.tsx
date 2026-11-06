import type { CSSProperties } from 'react'
import { GRAVURA_TAMANHO, gravura, type GravuraName } from '../config/gravuras'

/**
 * Gravura da marca (traço creme). Decorativa por padrão: sem `alt`, leitores de tela pulam.
 * Use `alt` só quando a imagem diz algo que o texto ao lado não diz.
 */
export function Gravura({ name, alt, className = '', style, eager }: { name: GravuraName; alt?: string; className?: string; style?: CSSProperties; eager?: boolean }) {
  const src = gravura(name)
  if (!src) return null
  return (
    <img
      src={src}
      width={GRAVURA_TAMANHO[name][0]}
      height={GRAVURA_TAMANHO[name][1]}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={`gravura pointer-events-none select-none ${className}`}
      style={style}
    />
  )
}

/** "Nº 01 —— cardápio" */
export function Kicker({ n, children, tone = 'mute' }: { n: string; children: string; tone?: 'mute' | 'dark' }) {
  return (
    <p className="t-kicker flex items-center gap-3">
      <span className={tone === 'dark' ? '' : 'text-laranja'}>Nº {n}</span>
      <span aria-hidden="true" className={`h-px w-10 ${tone === 'dark' ? 'bg-tinta' : 'bg-mute'}`} />
      <span className={tone === 'dark' ? '' : 'text-mute'}>{children}</span>
    </p>
  )
}

/** Título em dois tempos: afirmação + virada (laranja, ou vinho no fundo laranja). */
export function Titulo({ as: Tag = 'h2', id, a, b, className = '' }: { as?: 'h1' | 'h2'; id?: string; a: string; b: string; className?: string }) {
  return (
    <Tag id={id} className={`t-display m-0 ${className}`}>
      <span>{a}</span> <span className="text-lilac-ink">{b}</span>
    </Tag>
  )
}
