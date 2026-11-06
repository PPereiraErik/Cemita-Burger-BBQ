import { useState } from 'react'
import { adminApi } from './adminApi'
import { centsToInput, money, parseCents, type Zone } from './core'
import { Field, Modal, Notice, Switch, useAction, useLoad } from './ui'

/**
 * Zonas de entrega: bairros (lista) ou faixa de CEP, com taxa, mínimo e prazo.
 * Nada vem preenchido: bairros, taxas e prazos são decisão da Cemita.
 */
export function Zones() {
  const { data, setData, error, loading } = useLoad(() => adminApi.zones().then((r) => r.zones))
  const [editing, setEditing] = useState<Zone | 'new' | null>(null)
  const act = useAction()

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Entregas</h1>
        <button type="button" className="adm-btn" onClick={() => setEditing('new')}>
          + Nova zona
        </button>
      </div>
      <p className="text-texto-2">Sem nenhuma zona ativa, o site oferece só retirada. A taxa da zona é somada no servidor, nunca no navegador do cliente.</p>
      {loading && !data && <p>Carregando…</p>}
      {error && <Notice kind="error">{error}</Notice>}
      {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
      {data && !data.length && <Notice kind="warn">Nenhuma zona cadastrada ainda.</Notice>}
      <ul className="grid gap-3 md:grid-cols-2">
        {data?.map((z) => (
          <li key={z.id} className={`adm-card p-4 ${z.active ? '' : 'opacity-75'}`}>
            <h2 className="font-display text-2xl">{z.name}</h2>
            <p className="text-sm">
              {z.matchType === 'neighborhood' ? `Bairros: ${(z.neighborhoods ?? []).join(', ')}` : `CEP ${fmtCep(z.cepStart)} a ${fmtCep(z.cepEnd)}`}
            </p>
            <p className="font-mono text-sm">
              Taxa {money(z.feeCents)} · mínimo {z.minOrderCents ? money(z.minOrderCents) : 'nenhum'} · {z.etaMinMinutes}–{z.etaMaxMinutes} min
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Switch
                label={`${z.name}: ativa`}
                checked={z.active}
                onText="Ativa"
                offText="Desativada"
                disabled={act.busy}
                onChange={(v) =>
                  act.run(async () => {
                    const { id, ...rest } = z
                    const r = await adminApi.updateZone(id, { ...rest, active: v })
                    setData((list) => list?.map((x) => (x.id === id ? r.zone : x)) ?? null)
                  }, `${z.name}: ${v ? 'ativa' : 'desativada'}.`)
                }
              />
              <button type="button" className="adm-btn is-ghost min-h-11" onClick={() => setEditing(z)}>
                Editar <span className="sr-only">{z.name}</span>
              </button>
              <button
                type="button"
                className="adm-btn is-danger min-h-11"
                disabled={act.busy}
                onClick={() => {
                  if (!window.confirm(`Apagar a zona "${z.name}"? Zonas já usadas em pedidos não podem ser apagadas, só desativadas.`)) return
                  void act.run(async () => {
                    await adminApi.deleteZone(z.id)
                    setData((list) => list?.filter((x) => x.id !== z.id) ?? null)
                  }, 'Zona apagada.')
                }}
              >
                Apagar <span className="sr-only">{z.name}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <ZoneForm
          zone={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(z) => {
            setData((list) => (list?.some((x) => x.id === z.id) ? list.map((x) => (x.id === z.id ? z : x)) : [...(list ?? []), z]))
            setEditing(null)
            act.setMsg({ kind: 'ok', text: `${z.name}: salva.` })
          }}
        />
      )}
    </div>
  )
}

const fmtCep = (c: string | null) => (c ? c.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '?')

function ZoneForm({ zone, onClose, onSaved }: { zone: Zone | null; onClose: () => void; onSaved: (z: Zone) => void }) {
  const [name, setName] = useState(zone?.name ?? '')
  const [matchType, setMatchType] = useState<Zone['matchType']>(zone?.matchType ?? 'neighborhood')
  const [hoods, setHoods] = useState((zone?.neighborhoods ?? []).join('\n'))
  const [cepStart, setCepStart] = useState(zone?.cepStart ?? '')
  const [cepEnd, setCepEnd] = useState(zone?.cepEnd ?? '')
  const [fee, setFee] = useState(zone ? centsToInput(zone.feeCents) : '')
  const [min, setMin] = useState(zone ? centsToInput(zone.minOrderCents) : '')
  const [etaMin, setEtaMin] = useState(zone ? String(zone.etaMinMinutes) : '')
  const [etaMax, setEtaMax] = useState(zone ? String(zone.etaMaxMinutes) : '')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const act = useAction()

  return (
    <Modal title={zone ? `Editar ${zone.name}` : 'Nova zona de entrega'} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const e2: Record<string, string> = {}
          const neighborhoods = hoods.split(/\n|;/).map((s) => s.trim()).filter(Boolean)
          const d = (s: string) => s.replace(/\D/g, '')
          const feeC = parseCents(fee)
          const minC = min.trim() ? parseCents(min) : 0
          const a = Number(etaMin)
          const b = Number(etaMax)
          if (name.trim().length < 2) e2.name = 'Dê um nome à zona.'
          if (matchType === 'neighborhood' && !neighborhoods.length) e2.hoods = 'Informe ao menos um bairro.'
          if (matchType === 'cep_range' && !(d(cepStart).length === 8 && d(cepEnd).length === 8 && d(cepStart) <= d(cepEnd))) e2.cep = 'Faixa de CEP inválida (8 dígitos, início ≤ fim).'
          if (feeC === null) e2.fee = 'Use o formato 7,00 (0 para grátis).'
          if (minC === null) e2.min = 'Use o formato 30,00, ou deixe vazio.'
          if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b >= a && b <= 300)) e2.eta = 'Prazo em minutos: mínimo ≤ máximo (até 300).'
          setErrs(e2)
          if (Object.keys(e2).length) return
          const body = {
            name: name.trim(),
            matchType,
            ...(matchType === 'neighborhood' ? { neighborhoods } : { cepStart: d(cepStart), cepEnd: d(cepEnd) }),
            feeCents: feeC!,
            minOrderCents: minC!,
            etaMinMinutes: a,
            etaMaxMinutes: b,
            active: zone?.active ?? true,
            position: zone?.position ?? 0,
          } as Omit<Zone, 'id'>
          await act.run(async () => onSaved((zone ? await adminApi.updateZone(zone.id, body) : await adminApi.createZone(body)).zone))
        }}
      >
        <Field label="Nome da zona" error={errs.name}>
          {(p) => <input {...p} className="adm-input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <fieldset className="grid gap-1">
          <legend className="adm-label">Como reconhecer o endereço</legend>
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name="mt" className="h-5 w-5 accent-[#2b190d]" checked={matchType === 'neighborhood'} onChange={() => setMatchType('neighborhood')} /> Pelo bairro
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name="mt" className="h-5 w-5 accent-[#2b190d]" checked={matchType === 'cep_range'} onChange={() => setMatchType('cep_range')} /> Por faixa de CEP
          </label>
        </fieldset>
        {matchType === 'neighborhood' ? (
          <Field label="Bairros" hint="Um por linha, como o cliente escreve (maiúsculas e acentos não importam)." error={errs.hoods}>
            {(p) => <textarea {...p} className="adm-input min-h-28" value={hoods} onChange={(e) => setHoods(e.target.value)} />}
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="CEP inicial" error={errs.cep}>
              {(p) => <input {...p} className="adm-input font-mono" inputMode="numeric" value={cepStart} onChange={(e) => setCepStart(e.target.value)} />}
            </Field>
            <Field label="CEP final">{(p) => <input {...p} className="adm-input font-mono" inputMode="numeric" value={cepEnd} onChange={(e) => setCepEnd(e.target.value)} />}</Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taxa (R$)" error={errs.fee}>
            {(p) => <input {...p} className="adm-input font-mono" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />}
          </Field>
          <Field label="Pedido mínimo (R$)" hint="Vazio = sem mínimo." error={errs.min}>
            {(p) => <input {...p} className="adm-input font-mono" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />}
          </Field>
          <Field label="Prazo mínimo (min)" error={errs.eta}>
            {(p) => <input {...p} className="adm-input font-mono" inputMode="numeric" value={etaMin} onChange={(e) => setEtaMin(e.target.value)} />}
          </Field>
          <Field label="Prazo máximo (min)">{(p) => <input {...p} className="adm-input font-mono" inputMode="numeric" value={etaMax} onChange={(e) => setEtaMax(e.target.value)} />}</Field>
        </div>
        {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="adm-btn is-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="adm-btn" disabled={act.busy}>
            Salvar zona
          </button>
        </div>
      </form>
    </Modal>
  )
}
