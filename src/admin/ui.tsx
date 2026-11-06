import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { errorText } from './adminApi'

/** Aviso com símbolo + texto (nunca só cor). `role` alert para erro, status para o resto. */
export function Notice({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'error' | 'warn'; children: ReactNode }) {
  if (!children) return null
  const sym = { info: 'ℹ', ok: '✓', error: '⚠', warn: '⚠' }[kind]
  const tone = { info: 'border-texto-2 bg-papel', ok: 'border-ok bg-[#e7f0d8] text-ok', error: 'border-erro bg-[#f8dccf] text-erro', warn: 'border-caramelo-escuro bg-[#f6e2bf]' }[kind]
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-md border-2 px-3 py-2 font-medium ${tone}`}>
      <span aria-hidden="true">{sym}</span>
      <span>{children}</span>
    </p>
  )
}

/** Campo com rótulo, dica e erro ligados ao controle (aria-describedby). */
export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode }) {
  const id = useId()
  const hintId = hint ? `${id}-h` : undefined
  const errId = error ? `${id}-e` : undefined
  const describedby = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="adm-label">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedby, ...(error ? { 'aria-invalid': true } : {}) })}
      {hint && (
        <span id={hintId} className="adm-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} className="mt-1 block font-medium text-erro">
          ⚠ {error}
        </span>
      )}
    </div>
  )
}

/** Interruptor acessível (role=switch) com o estado escrito ao lado. */
export function Switch({ checked, onChange, label, onText = 'Sim', offText = 'Não', disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; onText?: string; offText?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-2 pr-3 font-mono text-sm ${checked ? 'border-ok bg-[#e7f0d8] text-ok' : 'border-texto-2 bg-papel text-texto-2'}`}
    >
      <span aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-full text-xs ${checked ? 'bg-ok text-papel-3' : 'bg-texto-2 text-papel-3'}`}>
        {checked ? '✓' : '✕'}
      </span>
      {checked ? onText : offText}
    </button>
  )
}

/**
 * Janela modal nativa (<dialog>): o navegador cuida do foco preso e do Esc.
 * Abre ao montar; `onClose` ao fechar por qualquer caminho.
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) {
      d.showModal()
      // foco no primeiro campo do formulário (o navegador focaria o botão Fechar)
      d.querySelector<HTMLElement>('input, textarea, select')?.focus()
    }
    // sem close() na limpeza: o evento "close" chamaria onClose de novo (e o StrictMode monta duas vezes).
    // Ao desmontar, o elemento sai da página e da camada do modal sozinho.
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onMouseDown={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border-2 border-tinta bg-papel-3 p-0 text-tinta"
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-2xl">
            {title}
          </h2>
          <button type="button" className="adm-btn is-ghost min-h-10 px-3" onClick={onClose}>
            Fechar <span aria-hidden="true">✕</span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

/** Carrega dados com estado de carregando/erro e função de recarregar. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await load())
      setError(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => {
    void reload()
  }, [reload])
  return { data, setData, error, loading, reload }
}

/** Executa uma ação e guarda mensagem de sucesso/erro para mostrar. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const run = useCallback(async (fn: () => Promise<unknown>, okText?: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      if (okText) setMsg({ kind: 'ok', text: okText })
      return true
    } catch (e) {
      setMsg({ kind: 'error', text: errorText(e) })
      return false
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, msg, setMsg, run }
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="adm-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">{title}</h2>
        {aside}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}

/** Senha com botão Mostrar/Ocultar. */
export function PasswordInput({ value, onChange, autoComplete = 'new-password', ...p }: { value: string; onChange: (v: string) => void; autoComplete?: string; id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex gap-2">
      <input {...p} className="adm-input" type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="adm-btn is-ghost shrink-0 px-3" aria-pressed={show} onClick={() => setShow((v) => !v)}>
        {show ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}
