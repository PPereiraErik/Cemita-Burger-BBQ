import { useMemo, useState } from 'react'
import { adminApi } from './adminApi'
import { centsToInput, money, parseCents, type AdminProduct, type Me } from './core'
import { Field, Modal, Notice, Switch, useAction, useLoad } from './ui'

/**
 * Cardápio: atendimento marca esgotado/disponível; administração também muda preço,
 * nome, descrição e se o produto aparece. Mudança vale na hora para o site (e fica no Registro).
 */
export function Catalog({ me }: { me: Me }) {
  const { data, setData, error, loading } = useLoad(() => adminApi.catalog().then((r) => r.categories))
  const [q, setQ] = useState('')
  const [onlyOut, setOnlyOut] = useState(false)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const act = useAction()

  const replace = (p: AdminProduct) => setData((cats) => cats?.map((c) => ({ ...c, products: c.products.map((x) => (x.id === p.id ? p : x)) })) ?? null)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data ?? [])
      .map((c) => ({ ...c, products: c.products.filter((p) => (!term || p.name.toLowerCase().includes(term)) && (!onlyOut || !p.available)) }))
      .filter((c) => c.products.length)
  }, [data, q, onlyOut])

  const outCount = (data ?? []).flatMap((c) => c.products).filter((p) => p.active && !p.available).length

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">Cardápio</h1>
      <p className="text-texto-2">
        {me.can.editProducts ? 'Mudanças valem na hora para o site.' : 'Você pode marcar produtos como esgotados ou disponíveis. Preço e texto só a administração muda.'}{' '}
        Pedidos já feitos guardam o preço da hora do pedido.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] grow">
          <Field label="Buscar produto">{(p) => <input {...p} type="search" className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
        </div>
        <label className="flex min-h-11 items-center gap-2 font-medium">
          <input type="checkbox" className="h-5 w-5 accent-[#2b190d]" checked={onlyOut} onChange={(e) => setOnlyOut(e.target.checked)} /> Só esgotados ({outCount})
        </label>
      </div>
      {loading && !data && <p>Carregando…</p>}
      {error && <Notice kind="error">{error}</Notice>}
      {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}

      {filtered.map((c) => (
        <section key={c.id} aria-labelledby={`cat-${c.id}`} className="adm-card overflow-hidden">
          <h2 id={`cat-${c.id}`} className="bg-tinta px-4 py-2 font-display text-2xl text-osso">
            {c.name}
          </h2>
          <ul>
            {c.products.map((p) => (
              <li key={p.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-texto-2/30 px-4 py-3 ${p.active ? '' : 'bg-papel/60'}`}>
                <div className="min-w-[12rem] grow">
                  <p className="font-semibold">
                    {p.name} {!p.active && <span className="adm-tag">fora do cardápio</span>} {!p.orderable && <span className="adm-tag">não pedível no site</span>}
                  </p>
                  <p className="font-mono text-sm">
                    {p.priceFrom ? 'a partir de ' : ''}
                    {money(p.priceCents)}
                    {p.isAdult ? ' · 18+' : ''}
                  </p>
                </div>
                <Switch
                  label={`${p.name}: disponível`}
                  checked={p.available}
                  onText="Disponível"
                  offText="Esgotado"
                  disabled={act.busy || !me.can.setProductAvailability}
                  onChange={(v) => act.run(async () => replace((await adminApi.patchProduct(p.id, { available: v })).product), `${p.name}: ${v ? 'disponível' : 'esgotado'}.`)}
                />
                {me.can.editProducts && (
                  <button type="button" className="adm-btn is-ghost min-h-11" onClick={() => setEditing(p)}>
                    Editar <span className="sr-only">{p.name}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {data && !filtered.length && <p className="text-texto-2">Nenhum produto encontrado.</p>}
      {editing && (
        <EditProduct
          p={editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            replace(p)
            setEditing(null)
            act.setMsg({ kind: 'ok', text: `${p.name}: salvo.` })
          }}
        />
      )}
    </div>
  )
}

function EditProduct({ p, onClose, onSaved }: { p: AdminProduct; onClose: () => void; onSaved: (p: AdminProduct) => void }) {
  const [name, setName] = useState(p.name)
  const [description, setDescription] = useState(p.description ?? '')
  const [price, setPrice] = useState(centsToInput(p.priceCents))
  const [active, setActive] = useState(p.active)
  const [orderable, setOrderable] = useState(p.orderable)
  const [priceErr, setPriceErr] = useState<string | null>(null)
  const act = useAction()
  return (
    <Modal title={`Editar ${p.name}`} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const cents = parseCents(price)
          if (cents === null) return setPriceErr('Use o formato 39,90.')
          setPriceErr(null)
          const patch: Parameters<typeof adminApi.patchProduct>[1] = {}
          if (name.trim() !== p.name) patch.name = name.trim()
          if ((description.trim() || null) !== p.description) patch.description = description.trim() || null
          if (cents !== p.priceCents) patch.priceCents = cents
          if (active !== p.active) patch.active = active
          if (orderable !== p.orderable) patch.orderable = orderable
          if (!Object.keys(patch).length) return onClose()
          await act.run(async () => onSaved((await adminApi.patchProduct(p.id, patch)).product))
        }}
      >
        <Field label="Nome">{(f) => <input {...f} className="adm-input" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Descrição" hint="Aparece no cardápio do site.">
          {(f) => <textarea {...f} className="adm-input min-h-24" maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <Field label="Preço (R$)" error={priceErr} hint={p.priceFrom ? 'Este produto é "a partir de": o preço final depende da escolha feita no pedido.' : 'Confira com o VUCA: os dois precisam bater durante a transição.'}>
          {(f) => <input {...f} className="adm-input max-w-[10rem] font-mono" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />}
        </Field>
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="adm-label">Aparece no cardápio</p>
            <Switch label="Aparece no cardápio" checked={active} onChange={setActive} />
          </div>
          <div>
            <p className="adm-label">Pode ser pedido no site</p>
            <Switch label="Pode ser pedido no site" checked={orderable} onChange={setOrderable} />
          </div>
        </div>
        {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="adm-btn is-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="adm-btn" disabled={act.busy}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}
