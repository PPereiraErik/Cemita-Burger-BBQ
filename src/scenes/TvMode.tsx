import { useEffect, useState, type ReactNode } from 'react'
import { bbqItems, findItem, formatPrice } from '../config/menu'
import { logo } from '../config/photos'
import { fullAddress, restaurant } from '../config/restaurant'
import { useOpenNow } from '../hooks/useOpenNow'
import { useComboPrice } from '../lib/live'
import { Illus, Img, Price } from '../world/Objects'

/**
 * MODO TV (abra o site com ?tv)
 * Para a TV do salão: uma vitrine que troca sozinha a cada poucos segundos,
 * com letras grandes para ler de longe. Discreta: sem efeitos, só a troca.
 * Controles: ← → trocam, espaço pausa, Esc volta para o site.
 */
type Slide =
  | { kind: 'item'; id: string; photo: string; tag: string }
  | { kind: 'combo' }
  | { kind: 'bbq' }
  | { kind: 'brand' }

const SLIDES: Slide[] = [
  { kind: 'brand' },
  { kind: 'item', id: 'smash-rib', photo: 'cardapio/smash-rib', tag: 'Smash' },
  { kind: 'item', id: 'burger-bacon-supremo', photo: 'cardapio/burger-bacon-supremo', tag: 'Burger' },
  { kind: 'bbq' },
  { kind: 'item', id: 'smash-blue-cheese', photo: 'cardapio/smash-blue-cheese', tag: 'Smash' },
  { kind: 'combo' },
  { kind: 'item', id: 'buffalo-wings', photo: 'cardapio/buffalo-wings', tag: 'Entrada' },
]
const SECONDS = 9

export function TvMode() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const status = useOpenNow()
  const comboPrice = useComboPrice()
  const go = (d: number) => setI((x) => (x + d + SLIDES.length) % SLIDES.length)

  useEffect(() => {
    if (paused) return
    const t = window.setTimeout(() => go(1), SECONDS * 1000)
    return () => window.clearTimeout(t)
  }, [i, paused])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      }
      if (e.key === 'Escape') location.search = ''
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const s = SLIDES[i]
  return (
    <main className="fixed inset-0 flex flex-col bg-bone text-char" aria-roledescription="apresentação" aria-label="Cemita na TV">
      <div key={i} className="grid min-h-0 flex-1 items-center gap-[4vw] px-[5vw] pt-[4vh]" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', animation: 'rise-up .5s ease-out' }}>
        {s.kind === 'item' && <ItemSlide id={s.id} photo={s.photo} tag={s.tag} />}
        {s.kind === 'combo' && (
          <>
            <Frame>
              <Img k="burger-combo" alt="Burger com fritas e refrigerante" className="h-full w-full" priority />
            </Frame>
            <div>
              <span className="tag !text-[1.4vw]">Combo</span>
              <h1 className="t-display mt-[2vh] text-[7vw]">Monte seu combo</h1>
              <p className="mt-[2vh] max-w-[30ch] text-[2vw] leading-snug text-mute">Smash, burger grelhado ou sanduíche viram combo no pedido.</p>
              <p className="t-price mt-[3vh] text-[5vw]">+ {formatPrice(comboPrice)}</p>
            </div>
          </>
        )}
        {s.kind === 'bbq' && (
          <>
            <div className="tinta grid h-full max-h-[72vh] place-items-center rounded-t-[999px] rounded-b-[2vw] border-[0.35vw] border-osso bg-bone">
              <Illus name="mascote-churrasqueiro" className="w-[86%]" />
            </div>
            <div>
              <span className="tag !text-[1.4vw]">American BBQ</span>
              <h1 className="t-display mt-[2vh] text-[6.4vw]">Saindo do defumador.</h1>
              <ul className="mt-[3vh] space-y-[1.4vh]">
                {bbqItems.map((it) => (
                  <li key={it.id} className="flex items-baseline gap-[1vw] text-[2.6vw]">
                    <span className="t-display">{it.name}</span>
                    <span aria-hidden="true" className="leader" />
                    <Price item={it} />
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {s.kind === 'brand' && (
          <>
            <div className="tinta grid h-full max-h-[72vh] place-items-center rounded-t-[999px] rounded-b-[2vw] border-[0.35vw] border-osso bg-bone">
              <Illus name="mascote-servindo-bbq" className="w-[86%]" />
            </div>
            <div>
              <img src={logo} alt="" className="h-[14vh] w-[14vh] rounded-full" />
              <h1 className="t-display mt-[3vh] text-[7.4vw]">
                Aqui jaz <span className="block text-lilac-ink">a sua fome.</span>
              </h1>
              <p className="mt-[2vh] text-[2vw] text-mute">Burger &amp; american BBQ defumado.</p>
            </div>
          </>
        )}
      </div>

      {/* rodapé fixo: marca, endereço, horário */}
      <footer className="tinta flex items-center justify-between gap-[2vw] border-t-[0.25vw] border-osso bg-bone px-[5vw] py-[2.2vh] text-char">
        <p className="t-display text-[2.4vw]">Cemita Burger &amp; BBQ</p>
        <p className="text-[1.3vw]">{fullAddress}</p>
        <p className="flex items-center gap-[0.8vw] text-[1.4vw] font-semibold">
          <span aria-hidden="true" className={`h-[1vw] w-[1vw] rounded-full border-2 border-osso ${status.open ? 'bg-caramelo-claro' : ''}`} />
          {status.open ? 'Aberto agora' : `${restaurant.hours[0].days} · ${restaurant.hours[0].time}`}
        </p>
      </footer>
      {/* progresso + controles discretos */}
      <div className="absolute inset-x-0 bottom-0 h-[0.5vh] bg-tinta">
        {!paused && <div key={i} className="h-full origin-left bg-caramelo-claro" style={{ animation: `tv-progress ${SECONDS}s linear both` }} />}
      </div>
      <div className="absolute top-[2vh] right-[2vw] flex gap-2 opacity-60 focus-within:opacity-100 hover:opacity-100">
        <button type="button" onClick={() => go(-1)} className="t-label min-h-11 rounded-full border-2 border-char px-3" aria-label="Anterior">
          ←
        </button>
        <button type="button" onClick={() => setPaused((p) => !p)} className="t-label min-h-11 rounded-full border-2 border-char px-3">
          {paused ? 'Continuar' : 'Pausar'}
        </button>
        <button type="button" onClick={() => go(1)} className="t-label min-h-11 rounded-full border-2 border-char px-3" aria-label="Próximo">
          →
        </button>
        <a href="./" className="t-label flex min-h-11 items-center rounded-full border-2 border-char px-3">
          Sair
        </a>
      </div>
    </main>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="h-full max-h-[72vh] overflow-hidden rounded-t-[999px] rounded-b-[2vw] border-[0.35vw] border-char shadow-[0.8vw_0.8vw_0_var(--color-lilac)]">{children}</div>
}

function ItemSlide({ id, photo, tag }: { id: string; photo: string; tag: string }) {
  const item = findItem(id)
  return (
    <>
      <Frame>
        <Img k={photo} alt={`${item.name}: ${item.description ?? ''}`} className="h-full w-full" priority />
      </Frame>
      <div>
        <span className="tag !text-[1.4vw]">{tag}</span>
        <h1 className="t-display mt-[2vh] text-[6.6vw]">{item.name}</h1>
        {item.description && <p className="mt-[2vh] max-w-[34ch] text-[1.9vw] leading-snug text-mute">{item.description}</p>}
        <Price item={item} className="mt-[3vh] block text-[5vw]" />
      </div>
    </>
  )
}
