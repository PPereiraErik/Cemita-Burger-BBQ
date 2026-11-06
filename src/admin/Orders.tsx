import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi, AdminError, errorText } from './adminApi'
import {
  actionsFor,
  columnsFor,
  FULFILLMENT_LABEL,
  hhmm,
  money,
  newOrderCodes,
  PAYMENT_LABEL,
  since,
  STATUS_SHORT,
  type Action,
  type AdminOrder,
  type Me,
  paymentNote,
} from './core'
import { alertNewOrder, setSoundWanted, soundReady, soundWanted, unlockSound } from './alerts'
import { printOrder } from './print'
import { Field, Modal, Notice } from './ui'

const REFRESH_MS = 10_000

/** Quadro de pedidos: atualiza sozinho a cada 10 s e anuncia pedido novo (leitor de tela + destaque). */
export function Orders({ me }: { me: Me }) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number>(0)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [announce, setAnnounce] = useState('')
  const [flash, setFlash] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [cancelling, setCancelling] = useState<AdminOrder | null>(null)
  const [showRecent, setShowRecent] = useState(false)
  const [now, setNow] = useState(Date.now())
  const prev = useRef<AdminOrder[] | null>(null)
  const busyIds = useRef(new Set<number>())
  const [, force] = useState(0)

  const load = useCallback(async () => {
    try {
      const r = await adminApi.orders('active')
      const added = newOrderCodes(prev.current, r.orders)
      if (added.length) {
        setFresh((s) => new Set([...s, ...added]))
        const msg = added.length === 1 ? `Pedido novo: ${added[0]}` : `${added.length} pedidos novos: ${added.join(', ')}`
        setAnnounce(msg)
        alertNewOrder(msg)
      }
      prev.current = r.orders
      setOrders(r.orders)
      setError(null)
      setUpdatedAt(Date.now())
    } catch (e) {
      if (!(e instanceof AdminError && e.status === 401)) setError(errorText(e))
    }
  }, [])

  useEffect(() => {
    void load()
    // continua buscando com a aba em segundo plano (o tablet do balcão pode estar em outra aba): o som avisa
    const t = window.setInterval(() => {
      void load()
      setNow(Date.now())
    }, REFRESH_MS)
    const onVis = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  // contagem de novos na aba do navegador
  useEffect(() => {
    const n = (orders ?? []).filter((o) => o.status === 'received').length
    document.title = n ? `(${n}) Pedidos · Cemita` : 'Pedidos · Cemita'
    return () => {
      document.title = 'Painel · Cemita'
    }
  }, [orders])

  async function move(o: AdminOrder, a: Action, reason?: string) {
    if (busyIds.current.has(o.id)) return
    busyIds.current.add(o.id)
    force((n) => n + 1)
    setFlash(null)
    try {
      const r = await adminApi.setStatus(o.id, a.to, o.version, reason)
      setFlash({ kind: 'ok', text: `${o.code}: ${STATUS_SHORT[r.order.status]}.` })
      setFresh((s) => {
        const n = new Set(s)
        n.delete(o.code)
        return n
      })
      setCancelling(null)
    } catch (e) {
      const conflict = e instanceof AdminError && (e.code === 'ORDER_CHANGED' || e.code === 'INVALID_TRANSITION')
      setFlash({ kind: 'error', text: conflict ? `${o.code}: alguém mudou este pedido agora. A lista foi atualizada; confira e tente de novo.` : `${o.code}: ${errorText(e)}` })
      if (conflict) setCancelling(null)
      else if (a.to === 'cancelled') throw e
    } finally {
      busyIds.current.delete(o.id)
      await load()
    }
  }

  const [sound, setSound] = useState(() => soundWanted() && soundReady())
  const toggleSound = async () => {
    if (sound) {
      setSoundWanted(false)
      setSound(false)
    } else {
      setSoundWanted(true)
      setSound(await unlockSound())
    }
  }

  const cols = columnsFor(me.role)
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Pedidos</h1>
        <p className="font-mono text-sm text-texto-2" aria-live="off">
          {updatedAt ? `Atualizado às ${new Date(updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · a cada 10 s` : 'Carregando…'}{' '}
          <button type="button" className="adm-btn is-ghost ml-2 min-h-10 px-3" onClick={() => void load()}>
            Atualizar agora
          </button>
          <button type="button" role="switch" aria-checked={sound} className={`adm-btn ml-2 min-h-10 px-3 ${sound ? '' : 'is-ghost'}`} onClick={() => void toggleSound()}>
            {sound ? '🔔 Som de pedido novo: ligado' : '🔕 Ligar som de pedido novo'}
          </button>
        </p>
      </div>
      <p className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {announce}
      </p>
      {error && <Notice kind="error">{error} Tentando de novo a cada 10 s.</Notice>}
      {flash && <Notice kind={flash.kind}>{flash.text}</Notice>}

      {orders && (
        <div className={`grid gap-4 ${cols.length === 4 ? 'xl:grid-cols-4 md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {cols.map((c) => {
            const list = orders.filter((o) => c.statuses.includes(o.status))
            return (
              <section key={c.key} aria-labelledby={`col-${c.key}`} className="min-w-0 rounded-xl bg-papel p-3">
                <h2 id={`col-${c.key}`} className="mb-3 flex items-baseline justify-between font-display text-2xl">
                  {c.title} <span className="font-mono text-base">{list.length}</span>
                </h2>
                {list.length === 0 ? (
                  <p className="py-6 text-center text-texto-2">Nada aqui.</p>
                ) : (
                  <ol className="grid gap-3">
                    {list.map((o) => (
                      <li key={o.id}>
                        <OrderCard o={o} me={me} now={now} isNew={fresh.has(o.code)} busy={busyIds.current.has(o.id)} onAction={(a) => (a.to === 'cancelled' ? setCancelling(o) : void move(o, a))} />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )
          })}
        </div>
      )}

      {me.role !== 'kitchen' && (
        <div>
          <button type="button" className="adm-btn is-ghost" aria-expanded={showRecent} onClick={() => setShowRecent((v) => !v)}>
            {showRecent ? 'Esconder' : 'Ver'} finalizados e cancelados (últimas 12 h)
          </button>
          {showRecent && <Recent />}
        </div>
      )}

      {cancelling && <CancelDialog o={cancelling} onClose={() => setCancelling(null)} onConfirm={(reason) => move(cancelling, { to: 'cancelled', label: 'Cancelar', kind: 'danger' }, reason)} />}
    </div>
  )
}

function OrderCard({ o, me, now, isNew, busy, onAction }: { o: AdminOrder; me: Me; now: number; isNew: boolean; busy: boolean; onAction: (a: Action) => void }) {
  const actions = actionsFor(o, me.role)
  const waitingPayment = o.status === 'pending' || o.status === 'awaiting_payment'
  return (
    <article aria-label={`Pedido ${o.code}`} className={`adm-card p-3 ${isNew ? 'adm-new border-caramelo' : ''}`}>
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-mono text-lg font-medium">
          {o.code} {isNew && <span className="adm-tag is-strong">★ novo</span>}
        </h3>
        <span className="font-mono text-sm" title={`Pedido às ${hhmm(o.placedAt)}`}>
          ⏲ {since(o.placedAt, now)} <span className="text-texto-2">({hhmm(o.placedAt)})</span>
        </span>
      </header>
      <p className="mb-2 flex flex-wrap gap-1.5">
        <span className="adm-tag is-strong">{o.fulfillment === 'delivery' ? '→ ' : '■ '}{FULFILLMENT_LABEL[o.fulfillment]}</span>
        {o.fulfillment === 'delivery' && o.neighborhood && <span className="adm-tag">{o.neighborhood}</span>}
        {o.hasAdultItems && <span className="adm-tag">18+ confirmado</span>}
        {waitingPayment && <span className="adm-tag">⏲ {STATUS_SHORT[o.status]}</span>}
      </p>
      <p className="font-semibold">{o.customerName ?? 'Sem nome'}</p>

      <ul className="my-2 grid gap-1 border-y border-dashed border-texto-2 py-2">
        {o.items.map((i, k) => (
          <li key={k}>
            <span className="font-mono font-medium">{i.quantity}×</span> {i.name}
            {i.options.length > 0 && <span className="block pl-6 text-sm text-texto-2">+ {i.options.map((x) => x.name).join(', ')}</span>}
            {i.note && <span className="block pl-6 text-sm font-medium">✎ {i.note}</span>}
          </li>
        ))}
      </ul>
      {o.notes && <p className="mb-2 rounded bg-papel px-2 py-1 text-sm font-medium">✎ Observação: {o.notes}</p>}

      {me.can.viewCustomerContact && (
        <div className="mb-2 grid gap-0.5 text-sm">
          {o.customerPhone && (
            <a className="font-mono underline underline-offset-2" href={`tel:+55${o.customerPhone.replace(/\D/g, '')}`}>
              ☎ {o.customerPhone}
            </a>
          )}
          {o.address && (
            <p>
              ⌂ {o.address.street}, {o.address.number}
              {o.address.complement ? ` — ${o.address.complement}` : ''} · {o.address.neighborhood}
              {o.address.cep ? ` · CEP ${o.address.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : ''}
              {o.address.reference && <span className="block text-texto-2">Ref.: {o.address.reference}</span>}
            </p>
          )}
          <p>
            {PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod} · <strong className="font-mono">{money(o.totalCents)}</strong>
            {o.changeForCents != null && <span className="block font-medium">Troco para {money(o.changeForCents)} (levar {money(o.changeForCents - o.totalCents)})</span>}
            {(() => {
              const n = paymentNote(o.paymentMethod, o.paymentStatus, o.status)
              return n && <span className={`block font-semibold ${n.alerta ? 'text-erro' : ''}`}>{n.text}</span>
            })()}
          </p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="adm-btn is-ghost min-h-11" onClick={() => printOrder(o, me.can.viewCustomerContact)}>
          🖨 Imprimir <span className="sr-only">pedido {o.code}</span>
        </button>
      </div>
      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button key={a.to} type="button" disabled={busy} className={`adm-btn ${a.kind === 'danger' ? 'is-danger' : 'is-big grow'}`} onClick={() => onAction(a)}>
              {a.kind === 'primary' ? '→ ' : '✕ '}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

function CancelDialog({ o, onClose, onConfirm }: { o: AdminOrder; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={`Cancelar ${o.code}?`} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (reason.trim().length < 3) return setError('Escreva o motivo (fica no histórico do pedido e o cliente vê o status cancelado).')
          setBusy(true)
          try {
            await onConfirm(reason.trim())
          } catch (err) {
            setError(errorText(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <p>O cliente vê o pedido como cancelado. Pagamento pendente é cancelado junto.</p>
        <Field label="Motivo" error={error}>
          {(p) => <input {...p} className="adm-input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="adm-btn is-ghost" onClick={onClose}>
            Voltar
          </button>
          <button className="adm-btn is-danger" disabled={busy}>
            ✕ Cancelar pedido
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Recent() {
  const [list, setList] = useState<AdminOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    adminApi
      .orders('recent')
      .then((r) => setList(r.orders.slice().reverse()))
      .catch((e) => setError(errorText(e)))
  }, [])
  if (error) return <Notice kind="error">{error}</Notice>
  if (!list) return <p className="mt-3">Carregando…</p>
  if (!list.length) return <p className="mt-3 text-texto-2">Nenhum pedido finalizado ou cancelado nas últimas 12 horas.</p>
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <caption className="sr-only">Pedidos finalizados e cancelados nas últimas 12 horas</caption>
        <thead>
          <tr className="border-b-2 border-tinta font-mono text-sm">
            <th className="p-2">Pedido</th>
            <th className="p-2">Hora</th>
            <th className="p-2">Status</th>
            <th className="p-2">Total</th>
            <th className="p-2">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id} className="border-b border-texto-2/40">
              <td className="p-2 font-mono">{o.code}</td>
              <td className="p-2">{hhmm(o.placedAt)}</td>
              <td className="p-2">{o.statusLabel}</td>
              <td className="p-2 font-mono">{money(o.totalCents)}</td>
              <td className="p-2">{o.cancelReason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
