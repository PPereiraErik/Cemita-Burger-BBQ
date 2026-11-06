import { useState } from 'react'
import { AdminError, adminApi, API_BASE } from './adminApi'
import { EMPTY_EVENT, eventProblems, eventToBody, eventToForm, eventWhen, mergeDraft, type AdminEvent, type EventDraft, type EventForm } from './core'
import { shrinkImage } from './image'
import { Field, Modal, Notice, useAction, useLoad } from './ui'

const API_ROOT = API_BASE ? API_BASE.replace(/\/admin$/, '') : ''

/**
 * EVENTOS — a Agenda do site (shows, stand-up, festas).
 * Do Instagram para o site em 3 passos: print/arte do post (+ legenda, se quiser) → "Preencher com IA" → conferir e publicar.
 * A IA só preenche o rascunho; quem publica é a equipe. Evento que já passou sai do site sozinho.
 */
export function Events() {
  const { data, setData, error, loading } = useLoad(() => adminApi.events())
  const [editing, setEditing] = useState<AdminEvent | 'new' | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const act = useAction()

  const replace = (e: AdminEvent) => setData((d) => (d ? { ...d, events: [...d.events.filter((x) => x.id !== e.id), e].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) } : d))

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Eventos</h1>
        <button type="button" className="adm-btn" onClick={() => setEditing('new')}>
          + Novo evento
        </button>
      </div>
      <p className="text-texto-2">
        Postou um evento no Instagram? Toque em <strong>+ Novo evento</strong>, envie o <strong>print do post</strong> (ou a arte) e, se quiser, cole a legenda.
        {data?.aiReady ? ' A IA preenche os dados; você confere e publica.' : ' Depois preencha os dados e publique.'} Evento que já passou sai do site sozinho.
      </p>
      {loading && !data && <p>Carregando…</p>}
      {error && <Notice kind="error">{error}</Notice>}
      {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
      {data && !data.events.length && <Notice kind="info">Nenhum evento cadastrado ainda.</Notice>}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.events.map((e) => {
          const past = e.status === 'published' && !e.visible
          return (
            <li key={e.id} className={`adm-card flex gap-3 p-3 ${past ? 'opacity-70' : ''}`}>
              <div className="h-28 w-24 shrink-0 overflow-hidden rounded-md bg-tinta">
                {e.imageUrl ? <img src={API_ROOT + e.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="grid h-full place-items-center p-1 text-center text-xs text-osso">sem arte</span>}
              </div>
              <div className="grid min-w-0 flex-1 content-start gap-1">
                <p className="font-mono text-sm">{eventWhen(e.date, e.time)}</p>
                <h2 className="font-display text-xl leading-tight">{e.title}</h2>
                <p className="text-sm font-semibold">{e.status === 'draft' ? '✎ Rascunho (não aparece no site)' : past ? '⌛ Já passou (saiu do site)' : '✓ No site'}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <button type="button" className="adm-btn is-ghost min-h-11" onClick={() => setEditing(e)}>
                    Editar <span className="sr-only">{e.title}</span>
                  </button>
                  {!past && (
                    <button
                      type="button"
                      className="adm-btn min-h-11"
                      disabled={act.busy}
                      onClick={() =>
                        act.run(async () => {
                          const r = await adminApi.updateEvent(e.id, eventToBody(eventToForm(e), e.status === 'draft' ? 'published' : 'draft'))
                          replace(r.event)
                        }, e.status === 'draft' ? `${e.title}: publicado no site.` : `${e.title}: saiu do site (virou rascunho).`)
                      }
                    >
                      {e.status === 'draft' ? 'Publicar' : 'Tirar do site'} <span className="sr-only">{e.title}</span>
                    </button>
                  )}
                  {deleting === e.id ? (
                    <span role="group" aria-label={`Confirmar exclusão de ${e.title}`} className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="adm-btn is-danger min-h-11"
                        disabled={act.busy}
                        onClick={() =>
                          act.run(async () => {
                            await adminApi.deleteEvent(e.id)
                            setData((d) => (d ? { ...d, events: d.events.filter((x) => x.id !== e.id) } : d))
                            setDeleting(null)
                          }, `${e.title}: excluído.`)
                        }
                      >
                        Sim, excluir
                      </button>
                      <button type="button" className="adm-btn is-ghost min-h-11" onClick={() => setDeleting(null)}>
                        Não
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="adm-btn is-ghost min-h-11" onClick={() => setDeleting(e.id)}>
                      Excluir <span className="sr-only">{e.title}</span>
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {editing && (
        <EventEditor
          event={editing === 'new' ? null : editing}
          aiReady={!!data?.aiReady}
          onClose={() => setEditing(null)}
          onSaved={(e, published) => {
            replace(e)
            setEditing(null)
            act.setMsg({ kind: 'ok', text: published ? `${e.title}: publicado no site.` : `${e.title}: salvo como rascunho.` })
          }}
        />
      )}
    </div>
  )
}

function EventEditor({ event, aiReady, onClose, onSaved }: { event: AdminEvent | null; aiReady: boolean; onClose: () => void; onSaved: (e: AdminEvent, published: boolean) => void }) {
  const [f, setF] = useState<EventForm>(event ? eventToForm(event) : EMPTY_EVENT)
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | null>(event?.imageUrl ? API_ROOT + event.imageUrl : null)
  const [errors, setErrors] = useState<Partial<Record<keyof EventForm, string>>>({})
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [imgError, setImgError] = useState<string | null>(null)
  const ai = useAction()
  const save = useAction()
  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setF((x) => ({ ...x, [k]: v }))

  const pickImage = async (file: File | undefined) => {
    setImgError(null)
    if (!file) return
    try {
      const data = await shrinkImage(file)
      set('image', data)
      setPreview(data)
    } catch (e) {
      setImgError(e instanceof Error ? e.message : 'Não deu para usar esta imagem.')
    }
  }

  const fill = () =>
    ai.run(async () => {
      const img = typeof f.image === 'string' ? f.image : undefined
      const r = await adminApi.extractEvent(caption, img)
      setDraft(r.draft)
      if (r.draft.isEvent) setF((x) => mergeDraft(x, r.draft))
    })

  const submit = (status: 'draft' | 'published') =>
    save.run(async () => {
      const p = eventProblems(f)
      setErrors(p)
      if (Object.keys(p).length) throw new AdminError(0, 'FORM', 'Confira os campos marcados.')
      const body = eventToBody(f, status)
      const r = event ? await adminApi.updateEvent(event.id, body) : await adminApi.createEvent(body)
      onSaved(r.event, status === 'published')
    })

  const canRead = aiReady && (!!caption.trim() || typeof f.image === 'string')

  return (
    <Modal title={event ? `Editar: ${event.title}` : 'Novo evento'} onClose={onClose}>
      <div className="grid gap-5">
        <fieldset className="grid gap-3 rounded-md border-2 border-texto-2/40 p-3">
          <legend className="adm-label px-1">1 · Do post do Instagram</legend>
          <Field label="Print do post ou arte do evento" hint="No celular: tire um print do post e corte para ficar só a arte (ela aparece no site assim). Ou salve a arte original." error={imgError}>
            {(p) => <input {...p} type="file" accept="image/*" className="adm-input" onChange={(e) => void pickImage(e.target.files?.[0])} />}
          </Field>
          {preview && (
            <div className="flex items-start gap-3">
              <img src={preview} alt="Arte escolhida para o evento" className="max-h-56 rounded-md border-2 border-tinta object-contain" />
              <button
                type="button"
                className="adm-btn is-ghost min-h-11"
                onClick={() => {
                  set('image', null)
                  setPreview(null)
                }}
              >
                Tirar a arte
              </button>
            </div>
          )}
          <Field label="Legenda do post (opcional)" hint="No Instagram: toque em “mais” na legenda, segure o texto e copie.">
            {(p) => <textarea {...p} rows={3} className="adm-input" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={4000} />}
          </Field>
          <Field label="Link do post (opcional)" hint="Toque em ⋯ ou no avião de papel no post → Copiar link. Aparece no site como “ver no Instagram”." error={errors.instagramUrl}>
            {(p) => <input {...p} className="adm-input" inputMode="url" placeholder="https://www.instagram.com/p/..." value={f.instagramUrl} onChange={(e) => set('instagramUrl', e.target.value)} />}
          </Field>
          {aiReady ? (
            <div className="grid gap-2">
              <button type="button" className="adm-btn" disabled={!canRead || ai.busy} aria-busy={ai.busy} onClick={fill}>
                {ai.busy ? 'Lendo o post… (alguns segundos)' : '✨ Preencher com IA'}
              </button>
              {!canRead && <span className="adm-hint">Envie o print ou cole a legenda para a IA ler.</span>}
            </div>
          ) : (
            <span className="adm-hint">Leitura automática desligada no servidor (falta a chave da IA). Preencha os dados abaixo.</span>
          )}
          {ai.msg && <Notice kind={ai.msg.kind}>{ai.msg.text}</Notice>}
          {draft && !draft.isEvent && <Notice kind="warn">A IA achou que este post não é um evento com data{draft.notes ? `: ${draft.notes}` : '.'} Se for, preencha à mão.</Notice>}
          {draft?.isEvent && (
            <Notice kind={draft.warnings.length ? 'warn' : 'ok'}>
              Dados lidos do post. {draft.warnings.length ? `Confira: ${draft.warnings.join(' ')}` : 'Confira antes de publicar.'}
              {draft.notes ? ` Obs.: ${draft.notes}` : ''}
            </Notice>
          )}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="adm-label">2 · Dados do evento</legend>
          <Field label="Nome do evento" error={errors.title}>
            {(p) => <input {...p} className="adm-input" maxLength={120} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Halloween no Cemita" />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Data" error={errors.date}>
              {(p) => <input {...p} type="date" className="adm-input" value={f.date} onChange={(e) => set('date', e.target.value)} />}
            </Field>
            <Field label="Começa às" error={errors.time}>
              {(p) => <input {...p} type="time" className="adm-input" value={f.time} onChange={(e) => set('time', e.target.value)} />}
            </Field>
            <Field label="Termina às (opcional)" hint="Vazio: sai do site 6 h depois do início." error={errors.endTime}>
              {(p) => <input {...p} type="time" className="adm-input" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} />}
            </Field>
          </div>
          <Field label="Atração (uma linha)" hint="Ex.: Som ao vivo com a banda Some Cents · Stand-up com Fulano">
            {(p) => <input {...p} className="adm-input" maxLength={300} value={f.summary} onChange={(e) => set('summary', e.target.value)} />}
          </Field>
          <Field label="Destaques (um por linha)" hint="Ex.: Concurso de fantasias · Drink especial + foto polaroid" error={errors.highlights}>
            {(p) => <textarea {...p} rows={3} className="adm-input" value={f.highlights} onChange={(e) => set('highlights', e.target.value)} />}
          </Field>
          <Field label="Descrição (opcional)">
            {(p) => <textarea {...p} rows={3} className="adm-input" maxLength={1000} value={f.description} onChange={(e) => set('description', e.target.value)} />}
          </Field>
          <Field label="Como reservar (opcional)" hint="Ex.: Reservas pelo direct ou WhatsApp">
            {(p) => <input {...p} className="adm-input" maxLength={200} value={f.reservation} onChange={(e) => set('reservation', e.target.value)} />}
          </Field>
        </fieldset>

        {save.msg && <Notice kind={save.msg.kind}>{save.msg.text}</Notice>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="adm-btn is-big" disabled={save.busy} onClick={() => submit('published')}>
            {event?.status === 'published' ? 'Salvar (continua no site)' : 'Publicar no site'}
          </button>
          <button type="button" className="adm-btn is-ghost" disabled={save.busy} onClick={() => submit('draft')}>
            {event?.status === 'published' ? 'Salvar e tirar do site' : 'Salvar rascunho'}
          </button>
          <button type="button" className="adm-btn is-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}

