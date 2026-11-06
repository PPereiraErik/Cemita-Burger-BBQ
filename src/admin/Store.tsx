import { useEffect, useState } from 'react'
import { adminApi } from './adminApi'
import { centsToInput, hoursProblem, ORDERING_MODE_LABEL, parseCents, PAYMENT_LABEL, REASON_LABEL, WEEKDAY, type AdminStore, type Hour, type Me, type StoreSettings } from './core'
import { Field, Notice, Section, useAction, useLoad } from './ui'

/**
 * Loja: pausar/retomar pedidos (atendimento e administração) e, só para administração,
 * modo de pedido, formas de pagamento, prazos e horário. Campo vazio = "ainda não definido".
 */
export function Store({ me }: { me: Me }) {
  const { data, setData, error, loading } = useLoad(() => adminApi.store())
  const pause = useAction()

  if (loading && !data) return <p>Carregando…</p>
  if (error) return <Notice kind="error">{error}</Notice>
  if (!data) return null
  const s = data.status
  const paused = data.settings.orders_paused === true

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">Loja</h1>

      <section aria-labelledby="st" className={`rounded-xl border-2 p-4 ${s.acceptsOrders ? 'border-ok bg-[#e7f0d8]' : 'border-caramelo-escuro bg-[#f6e2bf]'}`}>
        <h2 id="st" className="font-display text-2xl">
          {s.acceptsOrders ? '✓ O site está aceitando pedidos' : '■ O site não está aceitando pedidos'}
        </h2>
        {!s.acceptsOrders && (
          <ul className="mt-2 list-disc pl-6">
            {s.reasons.map((r) => (
              <li key={r}>{REASON_LABEL[r] ?? r}</li>
            ))}
          </ul>
        )}
        {me.can.pauseStore && (
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              className={`adm-btn is-big ${paused ? '' : 'is-danger'}`}
              disabled={pause.busy}
              onClick={() => pause.run(async () => setData(await adminApi.patchSettings({ orders_paused: !paused })), paused ? 'Pedidos retomados.' : 'Pedidos pausados. O site avisa o cliente.')}
            >
              {paused ? '▶ Retomar pedidos' : '❚❚ Pausar pedidos agora'}
            </button>
            <p className="text-sm text-texto-2">Use quando a cozinha estiver cheia. Pedidos já feitos continuam no quadro.</p>
            {pause.msg && <Notice kind={pause.msg.kind}>{pause.msg.text}</Notice>}
          </div>
        )}
      </section>

      {me.can.editStoreSettings && <SettingsForm store={data} onSaved={setData} />}
      {me.can.editStoreSettings && <HoursForm store={data} onSaved={setData} />}
    </div>
  )
}

const ON_DELIVERY = ['cash_on_delivery', 'card_on_delivery'] as const
const ONLINE = ['pix', 'card_online'] as const

function SettingsForm({ store, onSaved }: { store: AdminStore; onSaved: (s: AdminStore) => void }) {
  const st = store.settings
  const [mode, setMode] = useState(st.ordering_mode ?? 'vuca')
  const [methods, setMethods] = useState<string[]>(st.payment_methods_enabled ?? [])
  const [eta, setEta] = useState(st.pickup_eta_minutes == null ? '' : String(st.pickup_eta_minutes))
  const [minOrder, setMinOrder] = useState(st.min_order_cents == null ? '' : centsToInput(st.min_order_cents))
  const [retention, setRetention] = useState(st.data_retention_days == null ? '' : String(st.data_retention_days))
  const [errs, setErrs] = useState<Record<string, string>>({})
  const act = useAction()

  useEffect(() => {
    setMode(st.ordering_mode ?? 'vuca')
    setMethods(st.payment_methods_enabled ?? [])
  }, [st.ordering_mode, st.payment_methods_enabled])

  const int = (v: string, min: number, max: number) => (v.trim() === '' ? null : /^\d+$/.test(v.trim()) && +v >= min && +v <= max ? +v : NaN)

  return (
    <Section title="Configurações">
      <form
        className="grid gap-5"
        onSubmit={async (e) => {
          e.preventDefault()
          const e2: Record<string, string> = {}
          const etaV = int(eta, 1, 240)
          if (Number.isNaN(etaV)) e2.eta = 'De 1 a 240 minutos, ou vazio.'
          const minV = minOrder.trim() === '' ? null : parseCents(minOrder)
          if (minOrder.trim() !== '' && minV === null) e2.min = 'Use o formato 30,00, ou deixe vazio.'
          const retV = int(retention, 1, 3650)
          if (Number.isNaN(retV)) e2.ret = 'De 1 a 3650 dias, ou vazio.'
          setErrs(e2)
          if (Object.keys(e2).length) return
          const patch: Partial<StoreSettings> = {}
          if (mode !== st.ordering_mode) patch.ordering_mode = mode
          if (JSON.stringify([...methods].sort()) !== JSON.stringify([...(st.payment_methods_enabled ?? [])].sort())) patch.payment_methods_enabled = methods
          if (etaV !== st.pickup_eta_minutes) patch.pickup_eta_minutes = etaV
          if (minV !== st.min_order_cents) patch.min_order_cents = minV
          if (retV !== st.data_retention_days) patch.data_retention_days = retV
          if (!Object.keys(patch).length) return act.setMsg({ kind: 'ok', text: 'Nada mudou.' })
          await act.run(async () => onSaved(await adminApi.patchSettings(patch)), 'Configurações salvas.')
        }}
      >
        <fieldset className="grid gap-2">
          <legend className="adm-label">Como o site recebe pedidos</legend>
          {(Object.keys(ORDERING_MODE_LABEL) as (keyof typeof ORDERING_MODE_LABEL)[]).map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-3">
              <input type="radio" name="mode" className="h-5 w-5 accent-[#2b190d]" checked={mode === k} onChange={() => setMode(k)} />
              {ORDERING_MODE_LABEL[k]}
            </label>
          ))}
          <span className="adm-hint">Durante a transição o VUCA continua funcionando. Ligar o pedido próprio exige política de privacidade publicada e ao menos uma forma de pagamento.</span>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="adm-label">Formas de pagamento no site</legend>
          {[...ON_DELIVERY, ...ONLINE].map((m) => {
            const off = (ONLINE as readonly string[]).includes(m) && !store.status.onlinePaymentsReady
            return (
              <label key={m} className={`flex min-h-11 items-center gap-3 ${off ? 'opacity-60' : ''}`}>
                <input type="checkbox" disabled={off} className="h-5 w-5 accent-[#2b190d]" checked={methods.includes(m)} onChange={(e) => setMethods((cur) => (e.target.checked ? [...cur, m] : cur.filter((x) => x !== m)))} />
                {PAYMENT_LABEL[m]}
                {(ONLINE as readonly string[]).includes(m) && <span className="text-sm text-texto-2">(Mercado Pago)</span>}
              </label>
            )
          })}
          <span className="adm-hint">
            {store.status.onlinePaymentsReady
              ? 'Pix e cartão pelo site: o cliente paga no Mercado Pago e o pedido só chega à cozinha depois da confirmação do pagamento.'
              : 'Pix e cartão pelo site ficam disponíveis quando o Mercado Pago estiver configurado no servidor (veja PAGAMENTO-MERCADOPAGO.md).'}
          </span>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tempo de retirada (min)" hint="Vazio = não mostrar prazo." error={errs.eta}>
            {(p) => <input {...p} className="adm-input font-mono" inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value)} />}
          </Field>
          <Field label="Pedido mínimo (R$)" hint="Vazio = sem mínimo geral (zonas têm o próprio)." error={errs.min}>
            {(p) => <input {...p} className="adm-input font-mono" inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />}
          </Field>
          <Field label="Guardar dados de pedidos (dias)" hint="Definição pendente com o responsável jurídico (LGPD). Vazio = não definido." error={errs.ret}>
            {(p) => <input {...p} className="adm-input font-mono" inputMode="numeric" value={retention} onChange={(e) => setRetention(e.target.value)} />}
          </Field>
        </div>
        {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
        <div>
          <button className="adm-btn" disabled={act.busy}>
            Salvar configurações
          </button>
        </div>
      </form>
    </Section>
  )
}

function HoursForm({ store, onSaved }: { store: AdminStore; onSaved: (s: AdminStore) => void }) {
  const [hours, setHours] = useState<Hour[]>(store.hours)
  const [problem, setProblem] = useState<string | null>(null)
  const act = useAction()
  const set = (i: number, patch: Partial<Hour>) => setHours((h) => h.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  return (
    <Section title="Horário de funcionamento" aside={<span className="font-mono text-sm text-texto-2">fuso: {store.timezone}</span>}>
      <p className="text-texto-2">Fechamento antes da abertura = fecha depois da meia-noite. Dia sem linha = fechado.</p>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const p = hoursProblem(hours)
          setProblem(p)
          if (p) return
          await act.run(async () => {
            const s = await adminApi.putHours(hours)
            onSaved(s)
            setHours(s.hours)
          }, 'Horário salvo.')
        }}
      >
        <ul className="grid gap-2">
          {hours.map((h, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <label className="grid">
                <span className="text-sm font-semibold">Dia</span>
                <select className="adm-input w-36" value={h.weekday} onChange={(e) => set(i, { weekday: +e.target.value })}>
                  {WEEKDAY.map((d, k) => (
                    <option key={k} value={k}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid">
                <span className="text-sm font-semibold">Abre</span>
                <input type="time" className="adm-input w-40 font-mono" value={h.opensAt} onChange={(e) => set(i, { opensAt: e.target.value })} />
              </label>
              <label className="grid">
                <span className="text-sm font-semibold">Fecha</span>
                <input type="time" className="adm-input w-40 font-mono" value={h.closesAt} onChange={(e) => set(i, { closesAt: e.target.value })} />
              </label>
              <button type="button" className="adm-btn is-danger min-h-11" onClick={() => setHours((x) => x.filter((_, k) => k !== i))}>
                Remover <span className="sr-only">{WEEKDAY[h.weekday]}</span>
              </button>
            </li>
          ))}
        </ul>
        {problem && <Notice kind="error">{problem}</Notice>}
        {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="adm-btn is-ghost" onClick={() => setHours((x) => [...x, { weekday: 0, opensAt: '18:00', closesAt: '23:00' }])}>
            + Adicionar dia
          </button>
          <button className="adm-btn" disabled={act.busy}>
            Salvar horário
          </button>
        </div>
      </form>
    </Section>
  )
}
