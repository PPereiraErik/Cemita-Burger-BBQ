import { useCallback, useEffect, useState } from 'react'
import { formatPrice } from '../config/menu'
import { restaurant } from '../config/restaurant'
import { ApiError, api, type ApiOrder } from '../lib/api'
import { PAYMENT_LABEL, paymentStage, safeCheckoutUrl, type PaymentMethod } from '../lib/checkout'
import { myOrders } from '../lib/orders'
import { Dialog } from './Dialog'
import { Illus } from './Objects'

/**
 * ACOMPANHAMENTO DO PEDIDO
 * Lê o pedido no servidor com o código + token guardados neste aparelho.
 * Atualiza sozinho a cada 20 s enquanto a tela está aberta (e o pedido não terminou);
 * a cada 5 s enquanto espera a confirmação de um pagamento online.
 * Pix/cartão no site: "Pagar agora" leva de volta à página do Mercado Pago (o mesmo link, nunca outra cobrança).
 * Cancelar: só quando o servidor diz que pode (antes do preparo), com confirmação.
 * O status vem com símbolo e palavra (não depende de cor).
 */
const FINAL = new Set(['completed', 'cancelled'])
const STEPS_PICKUP = ['received', 'preparing', 'ready', 'completed']
const STEPS_DELIVERY = ['received', 'preparing', 'ready', 'out_for_delivery', 'completed']
const STEP_LABEL: Record<string, string> = {
  received: 'Recebido',
  preparing: 'Em preparo',
  ready: 'Pronto',
  out_for_delivery: 'Saiu para entrega',
  completed: 'Finalizado',
}
const cents = (c: number) => formatPrice(c / 100)
const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

export function OrderTracking({ code }: { code: string }) {
  const saved = myOrders.find(code)
  const [order, setOrder] = useState<ApiOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!saved) return setNotFound(true)
      try {
        const r = await api.getOrder(code, saved.token, signal)
        setOrder((prev) => {
          if (prev && prev.status !== r.order.status) setSaid(`Pedido ${r.order.code}: ${r.order.statusLabel}`)
          return r.order
        })
        setError(null)
      } catch (e) {
        if (signal?.aborted) return
        if (e instanceof ApiError && e.status === 404) setNotFound(true)
        else setError('Sem conexão com a Cemita agora. Tentamos de novo sozinhos.')
      }
    },
    [code, saved],
  )

  const stage = order ? paymentStage(order) : null
  const waitingPayment = stage === 'pay' || stage === 'declined'
  useEffect(() => {
    const ctrl = new AbortController()
    void load(ctrl.signal)
    const t = window.setInterval(
      () => {
        if (document.visibilityState === 'visible') void load()
      },
      waitingPayment ? 5_000 : 20_000,
    )
    return () => {
      ctrl.abort()
      window.clearInterval(t)
    }
  }, [load, waitingPayment])

  const payNow = async () => {
    if (!saved) return
    setBusy(true)
    try {
      const url = safeCheckoutUrl(order?.payment?.checkoutUrl) ?? safeCheckoutUrl((await api.pay(code, saved.token)).checkoutUrl)
      if (!url) throw new Error('link inválido')
      window.location.assign(url)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível abrir o pagamento agora. Tente de novo.')
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!saved) return
    setBusy(true)
    try {
      const r = await api.cancelOrder(code, saved.token)
      setOrder(r.order)
      setSaid('Pedido cancelado.')
      setConfirming(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível cancelar agora.')
      setConfirming(false)
      void load()
    } finally {
      setBusy(false)
    }
  }

  const steps = order?.fulfillment === 'delivery' ? STEPS_DELIVERY : STEPS_PICKUP
  const reached = new Set(order?.history.map((h) => h.status))
  const live = order && !FINAL.has(order.status)

  return (
    <Dialog label={`Pedido ${code}`} onClose={myOrders.closeTracking} side="auto" className="paper paper-grain max-h-[94svh] w-full max-w-[520px] overflow-y-auto rounded-t-[14px] border-2 border-b-0 border-tinta bg-sheet text-char lg:h-full lg:max-h-none lg:rounded-none lg:border-0 lg:border-l-2">
      <div className="px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="t-label text-mute">Acompanhar pedido</p>
          <button type="button" data-autofocus onClick={myOrders.closeTracking} className="t-label min-h-11 px-2">
            Fechar ×
          </button>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {said}
        </p>

        {notFound ? (
          <div className="py-6">
            <h2 className="t-display text-[2rem]">Pedido não encontrado</h2>
            <p className="mt-2 text-mute">Este aparelho não tem mais os dados do pedido {code}. Fale com a Cemita pelo WhatsApp e informe o código.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={restaurant.contact.whatsappUrl} target="_blank" rel="noopener" className="btn-ticket is-dark">
                WhatsApp ↗
              </a>
              <button type="button" onClick={() => myOrders.remove(code)} className="btn-line">
                Tirar da lista
              </button>
            </div>
          </div>
        ) : !order ? (
          <p className="py-10 text-center text-mute">{error ?? 'Buscando o pedido…'}</p>
        ) : (
          <>
            <div className="mt-2 flex items-start gap-4">
              <Illus name={order.status === 'cancelled' ? 'lapide-lanterna' : order.status === 'out_for_delivery' ? 'entregador-moto' : order.status === 'completed' ? 'mao-rock' : 'mascote-churrasqueiro'} className="w-24 shrink-0 rounded-[10px] bg-tinta p-1.5" />
              <div className="min-w-0">
                <h2 className="t-display text-[clamp(1.9rem,6vw,2.4rem)] leading-none">{order.statusLabel}</h2>
                <p className="mt-2">
                  Código <strong className="t-mono text-[1.1rem] tracking-wider">{order.code}</strong>
                </p>
                <p className="text-[0.88rem] text-mute">
                  {order.fulfillment === 'delivery' ? `Entrega${order.neighborhood ? ` · ${order.neighborhood}` : ''}` : 'Retirada no balcão'} · feito às {time(order.placedAt)}
                </p>
              </div>
            </div>

            {waitingPayment && (
              <section aria-labelledby="tk-pagar" className="mt-5 rounded-[10px] border-2 border-char bg-lilac p-4">
                <h3 id="tk-pagar" className="font-semibold">
                  {stage === 'declined' ? '✕ O pagamento não foi aprovado' : '⏲ Falta pagar'}
                </h3>
                <p className="mt-1 text-[0.92rem]">
                  {stage === 'declined'
                    ? 'Tente de novo com outro cartão ou com Pix. O pedido fica guardado.'
                    : 'O pedido só vai para a cozinha depois que o Mercado Pago confirmar o pagamento. Se você já pagou, a confirmação aparece aqui em alguns segundos.'}
                </p>
                <button type="button" onClick={payNow} disabled={busy} aria-busy={busy} className="btn-ticket is-dark mt-3 w-full disabled:opacity-50">
                  {busy ? 'Abrindo…' : `Pagar agora · ${cents(order.totalCents)}`}
                </button>
              </section>
            )}
            {stage === 'review' && (
              <p role="status" className="mt-4 rounded-[10px] border-2 border-blood p-3 text-[0.92rem] font-semibold text-blood">
                ⚠ A Cemita precisa conferir este pagamento. Se precisar, fale com a gente pelo WhatsApp e informe o código.
              </p>
            )}

            {order.status !== 'cancelled' && (
              <ol className="mt-5 grid gap-2" aria-label="Andamento do pedido">
                {steps.map((s) => {
                  const done = reached.has(s)
                  const now = order.status === s
                  const at = order.history.find((h) => h.status === s)?.at
                  return (
                    <li key={s} aria-current={now ? 'step' : undefined} className={`flex items-center gap-3 rounded-[8px] border-2 px-3 py-2 ${now ? 'border-char bg-lilac' : done ? 'border-char/30' : 'border-dashed border-char/20 text-mute'}`}>
                      <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-char text-[0.8rem] ${done ? 'bg-char text-bone' : ''}`}>
                        {done ? '✓' : ''}
                      </span>
                      <span className="flex-1 font-semibold">
                        {STEP_LABEL[s]}
                        <span className="sr-only">{done ? ' (feito)' : ' (ainda não)'}</span>
                      </span>
                      {at && <span className="t-mono text-[0.85rem] text-mute">{time(at)}</span>}
                    </li>
                  )
                })}
              </ol>
            )}
            {live && <p className="mt-2 text-[0.82rem] text-mute">Esta tela se atualiza sozinha a cada {waitingPayment ? '5' : '20'} segundos.</p>}
            {error && (
              <p role="status" className="mt-2 text-[0.88rem] font-semibold text-blood">
                ⚠ {error}
              </p>
            )}

            <section aria-labelledby="tk-itens" className="mt-5 rounded-[10px] border-2 border-char/25 p-4">
              <h3 id="tk-itens" className="font-semibold">
                Itens
              </h3>
              <ul className="mt-2 space-y-1 text-[0.95rem]">
                {order.items.map((i, k) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span>
                      <span className="t-mono">{i.quantity}×</span> {i.name}
                      {i.options.length > 0 && <span className="block text-[0.85rem] text-mute">{i.options.map((o) => o.name).join(' · ')}</span>}
                      {i.note && <span className="block text-[0.85rem] text-mute">obs.: {i.note}</span>}
                    </span>
                    <span className="t-price">{cents(i.lineTotalCents)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1 border-t-2 border-dashed border-char/25 pt-2 font-mono text-[0.92rem]">
                {order.deliveryFeeCents > 0 && (
                  <div className="flex justify-between">
                    <dt>Taxa de entrega</dt>
                    <dd>{cents(order.deliveryFeeCents)}</dd>
                  </div>
                )}
                {order.discountCents > 0 && (
                  <div className="flex justify-between">
                    <dt>Desconto</dt>
                    <dd>− {cents(order.discountCents)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-[1.1rem] font-medium">
                  <dt>Total</dt>
                  <dd>{cents(order.totalCents)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[0.9rem]">
                Pagamento: <strong>{PAYMENT_LABEL[order.paymentMethod as PaymentMethod] ?? order.paymentMethod}</strong>
                {stage === 'paid' && <strong> · ✓ pago</strong>}
                {order.changeForCents ? ` · troco para ${cents(order.changeForCents)}` : ''}
              </p>
            </section>

            <div className="mt-5 flex flex-col gap-3">
              <a href={restaurant.contact.whatsappUrl} target="_blank" rel="noopener" className="btn-line justify-center">
                Falar com a Cemita no WhatsApp ↗
              </a>
              {order.canCancel &&
                (confirming ? (
                  <div role="group" aria-label="Confirmar cancelamento" className="rounded-[10px] border-2 border-blood p-3">
                    <p className="font-semibold text-blood">Cancelar o pedido {order.code}?</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button type="button" onClick={cancel} disabled={busy} aria-busy={busy} className="min-h-11 rounded-full bg-blood px-5 font-mono text-[0.8rem] tracking-[.1em] text-bone uppercase disabled:opacity-50">
                        {busy ? 'Cancelando…' : 'Sim, cancelar'}
                      </button>
                      <button type="button" onClick={() => setConfirming(false)} className="btn-line">
                        Não, manter
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirming(true)} className="t-label min-h-11 self-center underline underline-offset-4 hover:text-blood">
                    Cancelar pedido
                  </button>
                ))}
              {!live && (
                <button type="button" onClick={() => myOrders.remove(code)} className="t-label min-h-11 self-center text-mute underline underline-offset-4">
                  Tirar este pedido da lista
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
