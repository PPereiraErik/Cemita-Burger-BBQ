import { useState } from 'react'
import { adminApi } from './adminApi'
import { passwordHint, type Me } from './core'
import { Field, Notice, PasswordInput, Section, useAction } from './ui'

/** Minha conta: dados e troca da própria senha (encerra todas as sessões, inclusive esta). */
export function Account({ me, onPasswordChanged }: { me: Me; onPasswordChanged: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const act = useAction()
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="font-display text-3xl">Minha conta</h1>
      <Section title="Dados">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="font-semibold">Nome</dt>
          <dd>{me.name}</dd>
          <dt className="font-semibold">E-mail</dt>
          <dd className="break-all">{me.email}</dd>
          <dt className="font-semibold">Papel</dt>
          <dd>{me.roleLabel}</dd>
        </dl>
      </Section>
      <Section title="Trocar senha">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const e2: Record<string, string> = {}
            if (!current) e2.current = 'Digite a senha atual.'
            const h = passwordHint(next)
            if (h) e2.next = h
            else if (next !== again) e2.again = 'As senhas não conferem.'
            setErrs(e2)
            if (Object.keys(e2).length) return
            const ok = await act.run(() => adminApi.changePassword(current, next))
            if (ok) onPasswordChanged()
          }}
        >
          <Field label="Senha atual" error={errs.current}>
            {(p) => <PasswordInput {...p} autoComplete="current-password" value={current} onChange={setCurrent} />}
          </Field>
          <Field label="Senha nova" hint="12 caracteres ou mais. Você vai precisar entrar de novo em todos os aparelhos." error={errs.next}>
            {(p) => <PasswordInput {...p} value={next} onChange={setNext} />}
          </Field>
          <Field label="Repita a senha nova" error={errs.again}>
            {(p) => <PasswordInput {...p} value={again} onChange={setAgain} />}
          </Field>
          {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
          <div>
            <button className="adm-btn" disabled={act.busy}>
              Trocar senha
            </button>
          </div>
        </form>
      </Section>
    </div>
  )
}
