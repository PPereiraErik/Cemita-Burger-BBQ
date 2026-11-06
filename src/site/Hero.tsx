import type { ReactNode } from 'react'
import { HERO_FOTOS, HOUSE_CAPTION } from '../config/midia'
import { fullAddress, mapsDirectionsUrl, restaurant } from '../config/restaurant'
import { HERO } from '../config/site'
import { useOpenNow } from '../hooks/useOpenNow'
import { Gravura, Titulo } from './Gravura'
import { IconArrow, IconChat, IconClock, IconPause, IconPin, Linha } from './Icons'
import { Polaroid } from './Polaroid'
import { usePolaroids } from './usePolaroids'

/** Posição de cada polaroid do topo (em % do quadro), como no mockup. */
const MOLDURAS = [
  { left: '3%', top: '8%', rot: -5, aspect: '1 / 1', fita: '32%', fitaRot: 3 },
  { left: '47%', top: '6%', rot: 5, aspect: '1 / 1', fita: '30%', fitaRot: -4 },
  { left: '12%', top: '52%', rot: -1.5, aspect: '4 / 3', fita: '36%', fitaRot: 2 },
]
const SIZES = '(max-width: 767px) 48vw, (max-width: 1279px) 25vw, 280px'

function Info({ icon, rotulo, children, href, external }: { icon: ReactNode; rotulo: string; children: ReactNode; href?: string; external?: boolean }) {
  const inner = (
    <>
      <span className="mt-0.5 shrink-0 text-laranja">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="t-kicker text-[11px] text-laranja">{rotulo}</span>
        <span className="text-[15px] leading-snug">{children}</span>
      </span>
    </>
  )
  return href ? (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined} className="flex min-h-11 min-w-0 items-start gap-3 text-creme no-underline hover:text-laranja">
      {inner}
    </a>
  ) : (
    <div className="flex min-w-0 items-start gap-3">{inner}</div>
  )
}

export function Hero() {
  const p = usePolaroids(HERO_FOTOS, 3, SIZES)
  const aberto = useOpenNow()
  return (
    <section id="inicio" aria-labelledby="inicio-titulo" className="secao relative overflow-hidden bg-secao px-5 py-14 md:px-12 md:py-[104px]">
      <Gravura name="teia" className="absolute -top-10 -left-10 hidden w-[200px] opacity-35 md:block" eager />
      <div className="relative mx-auto flex max-w-[1180px] flex-col gap-10 md:gap-14">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="t-kicker flex items-center gap-3.5">
              <span className="rounded-[2px] bg-papel px-3 py-1.5 font-medium text-tinta">{HERO.selo}</span>
              <span className="text-creme-3">{HERO.cidade}</span>
            </p>
            <Titulo as="h1" id="inicio-titulo" a={HERO.titulo} b={HERO.virada} className="text-[clamp(44px,6.2vw,82px)] leading-[0.98] tracking-[0.01em]" />
            <p className="m-0 max-w-[440px] font-mono text-[15px] leading-relaxed text-creme-3">{HERO.subtitulo}</p>
            <a href="#cardapio" className="btn-papel -rotate-1 self-start">
              {HERO.cta}
            </a>
          </div>

          {/* polaroids: um "dump" de fotos que troca sozinho */}
          <div className="relative w-full max-w-[420px] justify-self-center pt-[10%] md:max-w-[560px]">
            <div ref={p.ref} {...p.handlers} role="group" aria-label="Fotos dos lanches" className="relative aspect-square w-full">
              <Gravura name="morcego" className="flutua absolute top-[-16%] left-[-4%] z-[6] w-[24%]" eager />
              {MOLDURAS.map((m, i) => {
                const foto = HERO_FOTOS[p.slots[i]]
                if (!foto) return null
                const ant = p.prev[i] != null ? HERO_FOTOS[p.prev[i]!] : null
                return (
                  <Polaroid
                    key={i}
                    foto={foto}
                    anterior={ant}
                    legenda={HOUSE_CAPTION}
                    sizes={SIZES}
                    aspect={m.aspect}
                    fitaLeft={m.fita}
                    fitaRot={m.fitaRot}
                    eager
                    style={{ left: m.left, top: m.top, width: '50%', transform: `rotate(${m.rot}deg)` }}
                    className="hero-pola"
                  />
                )
              })}
              <Gravura name="coroa" className="absolute top-[-12%] left-[86%] z-[6] w-[11%] rotate-[14deg]" eager />
              <Gravura name="caveira-burger" className="absolute right-0 bottom-[-6%] z-[6] w-[28%]" eager />
            </div>
            {p.podeTrocar && (
              <button type="button" onClick={p.alternar} aria-pressed={p.pausado} className="t-kicker relative z-[7] mt-[9%] flex min-h-11 items-center gap-2 text-[11px] text-creme-3 hover:text-laranja">
                {p.pausado ? '▶ TROCAR AS FOTOS' : <><IconPause size={14} /> PAUSAR AS FOTOS</>}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Linha className="block text-creme" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4 md:gap-x-8 md:gap-y-6">
            <Info icon={<IconPin />} rotulo="ONDE FICA">
              {fullAddress}
            </Info>
            <Info icon={<IconClock />} rotulo="HORÁRIO">
              {restaurant.hours.map((h) => `${h.days}: ${h.time}`).join(' · ')}
              <span className={`mt-1 block font-mono text-[12px] ${aberto.open ? 'text-laranja' : 'text-creme-3'}`}>
                {aberto.open ? '● Aberto agora' : '○ Fechado agora'} · {aberto.note}
              </span>
            </Info>
            <Info icon={<IconChat />} rotulo="WHATSAPP" href={restaurant.contact.whatsappUrl} external>
              <span className="underline decoration-[1.5px] underline-offset-4">{restaurant.contact.phoneDisplay} →</span>
            </Info>
            <Info icon={<IconArrow />} rotulo="COMO CHEGAR" href={mapsDirectionsUrl} external>
              <span className="underline decoration-[1.5px] underline-offset-4">Abrir no mapa →</span>
            </Info>
          </div>
        </div>
      </div>
    </section>
  )
}
