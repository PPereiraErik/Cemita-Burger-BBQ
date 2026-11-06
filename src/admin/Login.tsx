import { useState, type FormEvent } from 'react'
import { adminApi, AdminError, errorText } from './adminApi'
import type { Me } from './core'
import { Field, Notice, PasswordInput } from './ui'

export function Login({ onDone, notice }: { onDone: (me: Me) => void; notice?: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Preencha e-mail e senha.')
    setBusy(true)
    setError(null)
    try {
      const r = await adminApi.login(email.trim(), password)
      setPassword('')
      onDone(r.user)
    } catch (err) {
      setError(err instanceof AdminError && err.code === 'VALIDATION_ERROR' ? 'Preencha e-mail e senha.' : errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-terra p-4">
      <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-xl border-2 border-tinta bg-papel-3 p-6 shadow-[6px_6px_0_var(--color-tinta)]">
        <p className="font-mono text-sm tracking-widest text-texto-2 uppercase">Cemita Burger &amp; BBQ</p>
        <h1 className="mb-5 font-display text-4xl">Painel da equipe</h1>
        <div className="grid gap-4">
          {notice && <Notice kind="info">{notice}</Notice>}
          <Field label="E-mail">{(p) => <input {...p} className="adm-input" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Senha">{(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={setPassword} />}</Field>
          {error && <Notice kind="error">{error}</Notice>}
          <button className="adm-btn is-big" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="text-sm text-texto-2">Sem conta? Quem administra cria pelo painel (Equipe). A primeira conta é criada no servidor com <code className="font-mono">npm run admin:create</code>.</p>
        </div>
      </form>
    </main>
  )
}
