import { useEffect, useState } from 'react'
import { useA11yPanel } from '../lib/a11y'
import { formatPrice } from '../config/menu'
import { canCombo, useComanda } from '../lib/comanda'
import { nativeOrdering, useComboPrice, useLive } from '../lib/live'
import { useMyOrders } from '../lib/orders'
import { closeComanda, openComanda, openProduct, useUI } from '../lib/ui'
import { A11yPanel } from '../world/A11yPanel'
import { Checkout } from '../world/Checkout'
import { ProductModal, Receipt } from '../world/Comanda'
import { Dialog } from '../world/Dialog'
import { OrderTracking } from '../world/OrderTracking'

/**
 * Aviso discreto depois de anotar: "✓ Anotado: 1× Smash Rib".
 * Lanche que pode virar combo e foi anotado sem combo: oferece "Virar combo" (fritas + bebida) ali mesmo.
 */
function Toast() {
  const { last, tick, items } = useComanda()
  const live = useLive()
  const comboPrice = useComboPrice()
  const [shown, setShown] = useState<{ text: string; tick: number; offer: { id: string; key: string } | null } | null>(null)
  useEffect(() => {
    if (!last) return
    const offerable = !last.combo && canCombo(last.id) && (!nativeOrdering(live) || !!live.index?.get(last.id)?.combo)
    setShown({ text: `${last.qty}× ${last.name}`, tick, offer: offerable ? { id: last.id, key: last.key } : null })
    const t = window.setTimeout(() => setShown(null), offerable ? 7000 : 2600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, tick])
  const line = shown?.offer ? items.find((l) => l.key === shown.offer!.key) : undefined
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottombar,0px)+12px)] z-[90] flex justify-center px-4 lg:bottom-6">
      {shown && (
        <div key={shown.tick} className="pointer-events-auto flex max-w-[600px] flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-[26px] border-2 border-tinta bg-laranja py-1.5 pr-1.5 pl-5 text-tinta shadow-[4px_4px_0_var(--color-tinta)]" style={{ animation: 'rise-up .25s ease-out' }}>
          <span className="text-[0.95rem]">
            <strong>✓ Anotado:</strong> {shown.text}
          </span>
          {line && (
            <button
              type="button"
              onClick={() => {
                setShown(null)
                openProduct(line.id, { combo: true, replaceKey: line.key, qty: line.qty, note: line.note, opts: line.opts })
              }}
              className="min-h-11 rounded-full border-2 border-tinta bg-creme px-4 font-mono text-[0.74rem] tracking-[.08em] text-tinta uppercase"
            >
              Virar combo · + {formatPrice(comboPrice)}
            </button>
          )}
          <button type="button" onClick={openComanda} className="min-h-11 rounded-full bg-tinta px-4 font-mono text-[0.74rem] tracking-[.1em] text-creme uppercase">
            Ver comanda
          </button>
        </div>
      )}
    </div>
  )
}

/** Tudo que abre por cima da página: comanda, produto, checkout, acompanhamento, acessibilidade. */
export function Overlays() {
  const ui = useUI()
  const a11yOpen = useA11yPanel()
  const mine = useMyOrders()
  return (
    <>
      {a11yOpen && <A11yPanel />}
      {ui.checkout && <Checkout />}
      {mine.open && <OrderTracking key={mine.open} code={mine.open} />}
      {ui.comanda && (
        <Dialog label="Sua comanda" onClose={closeComanda} side="auto" className="paper max-h-[94svh] w-full max-w-[460px] overflow-y-auto lg:h-full lg:max-h-none lg:border-l-2 lg:border-tinta lg:bg-sheet">
          <div className="flex items-center justify-between bg-sheet px-5 pt-3">
            <span className="t-label text-mute">Sua comanda</span>
            <button type="button" data-autofocus onClick={closeComanda} className="t-label min-h-11 px-2" aria-label="Fechar comanda">
              Fechar ×
            </button>
          </div>
          <Receipt inDrawer />
        </Dialog>
      )}
      {ui.product && <ProductModal key={ui.product + (ui.preset?.replaceKey ?? "")} id={ui.product} />}
      <Toast />
    </>
  )
}
