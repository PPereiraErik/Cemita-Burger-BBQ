import { useEffect, useRef, useState } from 'react'
import { formatPrice } from '../config/menu'
import { logo } from '../config/photos'
import { restaurant } from '../config/restaurant'
import { openA11yPanel } from '../lib/a11y'
import { useComanda } from '../lib/comanda'
import { myOrders, useMyOrders } from '../lib/orders'
import { startScroll, stopScroll } from '../lib/scroll'
import { openComanda, useUI } from '../lib/ui'
import { IconA11y, IconClose, IconMenu } from './Icons'
import { irPara } from './MenuLink'
import { useSecaoAtiva, useSecoes } from './nav'

/**
 * MENU — celular e tablet:
 * - barra fixa no topo (logo + botão do menu, que abre em tela cheia);
 * - barra fixa embaixo: Comanda (com contador) | Cardápio.
 */
export function MobileTop() {
  const [open, setOpen] = useState(false)
  const meus = useMyOrders()
  const ultimo = meus.orders[0]
  return (
    <>
      <header className="tinta sticky top-0 z-40 border-b-[1.5px] border-creme/15 bg-barra lg:hidden">
        <div className="flex h-[70px] items-center justify-between gap-3 py-2 pr-2.5 pl-4">
          <a href="#inicio" aria-label="Cemita Burger & BBQ — início" className="block">
            <img src={logo} alt="" className="h-[54px] w-[54px] rounded-full" />
          </a>
          <div className="flex items-center gap-1">
            {ultimo && (
              <button type="button" onClick={() => myOrders.openTracking(ultimo.code)} className="t-kicker flex min-h-11 items-center gap-1.5 rounded-[2px] border-[1.5px] border-laranja px-3 text-laranja" aria-label={`Acompanhar o pedido ${ultimo.code}`}>
                <span aria-hidden="true">⏲</span> SEU PEDIDO
              </button>
            )}
            <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open} aria-haspopup="dialog" className="grid h-12 w-12 place-items-center text-creme">
              <IconMenu />
            </button>
          </div>
        </div>
      </header>
      {open && <MenuTelaCheia onClose={() => setOpen(false)} />}
    </>
  )
}

function MenuTelaCheia({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const ativa = useSecaoAtiva()
  const secoes = useSecoes()
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    stopScroll()
    box.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !box.current) return
      const f = [...box.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault()
        f[f.length - 1].focus()
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault()
        f[0].focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('keydown', key)
      startScroll()
      prev?.focus?.({ preventScroll: true })
    }
  }, [onClose])
  return (
    <div ref={box} role="dialog" aria-modal="true" aria-label="Menu" className="tinta fixed inset-0 z-[110] flex flex-col overflow-y-auto bg-barra lg:hidden">
      <div className="flex h-[70px] shrink-0 items-center justify-between border-b-[1.5px] border-creme/15 py-2 pr-2.5 pl-4">
        <a href="#inicio" onClick={irPara('inicio', onClose)} aria-label="Cemita Burger & BBQ — início" className="block">
          <img src={logo} alt="" className="h-[54px] w-[54px] rounded-full" />
        </a>
        <button type="button" data-autofocus onClick={onClose} aria-label="Fechar menu" className="grid h-12 w-12 place-items-center text-creme">
          <IconClose />
        </button>
      </div>
      <nav aria-label="Seções" className="flex flex-col px-5 pt-2 pb-8">
        {secoes.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={irPara(s.id, onClose)}
            aria-current={ativa === s.id ? 'true' : undefined}
            className={`t-display flex min-h-[60px] items-center justify-between border-b border-creme/12 text-[30px] no-underline ${s.id === 'cardapio' ? 'text-laranja' : 'text-creme'}`}
          >
            {s.label} <span className="font-mono text-sm text-laranja">→</span>
          </a>
        ))}
        <div className="mt-6 flex flex-col gap-1">
          <a href={restaurant.contact.whatsappUrl} target="_blank" rel="noopener" className="t-kicker flex min-h-12 items-center text-creme-2 no-underline">
            WHATSAPP {restaurant.contact.phoneDisplay} ↗
          </a>
          <button
            type="button"
            onClick={() => {
              onClose()
              openA11yPanel()
            }}
            className="t-kicker flex min-h-12 items-center gap-2 text-left text-creme-2 underline underline-offset-4"
          >
            <IconA11y size={18} /> ACESSIBILIDADE
          </button>
        </div>
      </nav>
    </div>
  )
}

export function MobileBottom() {
  const { qty, total } = useComanda()
  const ui = useUI()
  if (ui.comanda) return null
  const cheia = qty > 0
  return (
    <div className="tinta fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t-[1.5px] border-creme/20 bg-barra px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] lg:hidden">
      <button
        type="button"
        onClick={openComanda}
        aria-label={`Abrir comanda: ${qty} ${qty === 1 ? 'item' : 'itens'}${cheia ? `, ${formatPrice(total)}` : ''}`}
        className={`t-kicker flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-[2px] border-[1.5px] bg-transparent text-creme ${cheia ? 'border-laranja' : 'border-creme/45'}`}
      >
        <span className="flex flex-col items-start leading-tight">
          COMANDA
          {cheia && <span className="text-[11px] tracking-normal text-laranja tabular-nums">{formatPrice(total)}</span>}
        </span>
        <span key={qty} className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-laranja px-1.5 text-tinta tabular-nums" style={qty ? { animation: 'bump .35s ease-out' } : undefined}>
          {qty}
        </span>
      </button>
      <a href="#cardapio" className="t-kicker flex min-h-[52px] flex-1 items-center justify-center rounded-[2px] bg-papel font-medium text-tinta no-underline">
        CARDÁPIO →
      </a>
    </div>
  )
}
