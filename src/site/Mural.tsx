import { useEffect, useRef, useState } from 'react'
import { MURAL, type MuralItem } from '../config/midia'
import { restaurant } from '../config/restaurant'
import { MURAL_TEXTO } from '../config/site'
import { prefersReducedMotion } from '../lib/motion'
import { Gravura, Kicker, Titulo } from './Gravura'
import { IconPause, IconPlay } from './Icons'
import { Polaroid } from './Polaroid'
import { usePolaroids } from './usePolaroids'

/** Onde fica cada polaroid do mural (em % do quadro), no computador e no celular. */
const PC = [
  { left: '1%', top: '6%', rot: -5 },
  { left: '20.5%', top: '40%', rot: 3 },
  { left: '39%', top: '3%', rot: -2 },
  { left: '57.5%', top: '41%', rot: 4 },
  { left: '76%', top: '7%', rot: -3 },
]
const CEL = [
  { left: '2%', top: '1%', rot: -5 },
  { left: '44%', top: '20%', rot: 3 },
  { left: '12%', top: '48%', rot: -2 },
]
const SIZES = '(max-width: 767px) 54vw, 23vw'

function useCelular() {
  const [cel, setCel] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const m = window.matchMedia('(max-width: 767px)')
    const on = () => setCel(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return cel
}

/** Vídeo da polaroid: em loop, sem som, só toca na tela; com movimento reduzido fica o pôster. */
function Video({ item }: { item: MuralItem }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [reduzido] = useState(() => prefersReducedMotion())
  useEffect(() => {
    const v = ref.current
    if (!v || reduzido) return
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? void v.play().catch(() => {}) : v.pause()), { threshold: 0.3 })
    io.observe(v)
    return () => io.disconnect()
  }, [reduzido])
  if (reduzido) return null
  return <video ref={ref} src={item.video} poster={item.foto.src} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} style={{ objectPosition: item.foto.focus }} />
}

/** Nº 04 — QUEM JÁ VEIO: mural de polaroids que trocam sozinhas (5 no computador, 3 no celular). */
export function Mural() {
  const cel = useCelular()
  const pos = cel ? CEL : PC
  const fotos = MURAL.map((m) => m.foto)
  const p = usePolaroids(fotos, pos.length, SIZES)
  return (
    <section id="fotos" aria-labelledby="fotos-titulo" className="relative overflow-hidden bg-fundo px-5 py-14 md:px-12 md:py-[104px]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-12">
        <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14">
          <div className="flex flex-col gap-3.5">
            <Kicker n="04">quem já veio</Kicker>
            <Titulo id="fotos-titulo" a={MURAL_TEXTO.titulo} b={MURAL_TEXTO.virada} className="text-[clamp(36px,5vw,60px)] leading-none" />
            <p className="m-0 text-creme-2">
              Fotos e vídeos de quem veio, e do salão à noite. Marque{' '}
              <a href={restaurant.social.instagramUrl} target="_blank" rel="noopener" className="text-laranja underline underline-offset-4">
                {restaurant.social.instagramHandle}
              </a>{' '}
              e apareça aqui.
            </p>
          </div>
          <Gravura name="esqueleto-celular" className="hidden w-full max-w-[340px] justify-self-end md:block" />
        </div>

        <div ref={p.ref} {...p.handlers} role="group" aria-label="Mural de fotos e vídeos" className={`relative mx-auto w-full ${cel ? 'aspect-[4/5] max-w-[420px]' : 'aspect-video'}`}>
          {pos.map((m, i) => {
            const item = MURAL[p.slots[i]]
            if (!item) return null
            const ant = p.prev[i] != null ? fotos[p.prev[i]!] : null
            return (
              <Polaroid
                key={i}
                foto={item.foto}
                anterior={ant}
                legenda={item.caption}
                sizes={SIZES}
                style={{ left: m.left, top: m.top, width: cel ? '54%' : '23%', transform: `rotate(${m.rot}deg)` }}
                extra={
                  item.kind === 'video' ? (
                    <>
                      <Video key={item.id} item={item} />
                      <IconPlay className="absolute top-2 right-2" />
                    </>
                  ) : null
                }
              />
            )
          })}
        </div>
        {p.podeTrocar && (
          <button type="button" onClick={p.alternar} aria-pressed={p.pausado} className="t-kicker -mt-6 flex min-h-11 items-center gap-2 self-center text-[11px] text-creme-2 hover:text-laranja">
            {p.pausado ? '▶ TROCAR AS FOTOS' : <><IconPause size={14} /> PAUSAR AS FOTOS</>}
          </button>
        )}
      </div>
    </section>
  )
}
