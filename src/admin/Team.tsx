import { useState } from 'react'
import { adminApi } from './adminApi'
import { passwordHint, ROLE_LABEL, type Me, type Role, type TeamUser } from './core'
import { Field, Modal, Notice, PasswordInput, Switch, useAction, useLoad } from './ui'

const ROLE_HELP: Record<Role, string> = {
  admin: 'tudo: pedidos, cardápio e preços, loja, entregas, equipe e registro',
  staff: 'pedidos (inclusive cancelar), esgotado/disponível e pausar a loja',
  kitchen: 'só a fila da cozinha: começar preparo e marcar pronto, sem telefone e endereço',
}

/** Equipe: contas de quem usa o painel. Não existe conta padrão; cada pessoa tem a sua. */
export function Team({ me }: { me: Me }) {
  const { data, setData, error, loading } = useLoad(() => adminApi.users().then((r) => r.users))
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<TeamUser | null>(null)
  const act = useAction()
  const replace = (u: TeamUser) => setData((l) => l?.map((x) => (x.id === u.id ? u : x)) ?? null)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Equipe</h1>
        <button type="button" className="adm-btn" onClick={() => setCreating(true)}>
          + Nova conta
        </button>
      </div>
      <dl className="grid gap-1 text-sm">
        {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
          <div key={r}>
            <dt className="inline font-semibold">{ROLE_LABEL[r]}:</dt> <dd className="inline">{ROLE_HELP[r]}.</dd>
          </div>
        ))}
      </dl>
      {loading && !data && <p>Carregando…</p>}
      {error && <Notice kind="error">{error}</Notice>}
      {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
      <ul className="grid gap-3">
        {data?.map((u) => {
          const self = u.id === me.id
          return (
            <li key={u.id} className="adm-card flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <div className="min-w-[14rem] grow">
                <p className="font-semibold">
                  {u.name} {self && <span className="adm-tag">você</span>}
                </p>
                <p className="text-sm break-all">{u.email}</p>
                <p className="text-sm text-texto-2">Último acesso: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('pt-BR') : 'nunca'}</p>
              </div>
              <label className="grid">
                <span className="text-sm font-semibold">Papel</span>
                <select
                  className="adm-input w-44"
                  value={u.role}
                  disabled={self || act.busy}
                  onChange={(e) => act.run(async () => replace((await adminApi.patchUser(u.id, { role: e.target.value as Role })).user), `${u.name}: agora ${ROLE_LABEL[e.target.value as Role]}. As sessões abertas dessa pessoa foram encerradas.`)}
                >
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
              <Switch
                label={`${u.name}: conta ativa`}
                checked={u.active}
                onText="Ativa"
                offText="Desativada"
                disabled={self || act.busy}
                onChange={(v) => act.run(async () => replace((await adminApi.patchUser(u.id, { active: v })).user), v ? `${u.name}: conta reativada.` : `${u.name}: conta desativada e desconectada.`)}
              />
              {!self && (
                <button type="button" className="adm-btn is-ghost min-h-11" onClick={() => setResetting(u)}>
                  Definir senha <span className="sr-only">de {u.name}</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-texto-2">Você não muda o próprio papel nem desativa a própria conta. Para trocar a sua senha, use “Minha conta”.</p>
      {creating && (
        <CreateUser
          onClose={() => setCreating(false)}
          onSaved={(u) => {
            setData((l) => [...(l ?? []), u])
            setCreating(false)
            act.setMsg({ kind: 'ok', text: `Conta de ${u.name} criada. Passe a senha para a pessoa pessoalmente, não por mensagem.` })
          }}
        />
      )}
      {resetting && (
        <ResetPassword
          user={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => {
            act.setMsg({ kind: 'ok', text: `Senha de ${resetting.name} definida. As sessões dessa pessoa foram encerradas.` })
            setResetting(null)
          }}
        />
      )}
    </div>
  )
}


function CreateUser({ onClose, onSaved }: { onClose: () => void; onSaved: (u: TeamUser) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('kitchen')
  const [password, setPassword] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const act = useAction()
  return (
    <Modal title="Nova conta" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const h = passwordHint(password)
          setPwErr(h)
          if (h) return
          await act.run(async () => onSaved((await adminApi.createUser({ name: name.trim(), email: email.trim(), role, password })).user))
        }}
      >
        <Field label="Nome">{(p) => <input {...p} className="adm-input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="E-mail" hint="Usado só para entrar no painel.">
          {(p) => <input {...p} className="adm-input" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <fieldset className="grid gap-1">
          <legend className="adm-label">Papel</legend>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <label key={r} className="flex min-h-11 items-start gap-3 py-1">
              <input type="radio" name="role" className="mt-1 h-5 w-5 accent-[#2b190d]" checked={role === r} onChange={() => setRole(r)} />
              <span>
                <strong>{ROLE_LABEL[r]}</strong> — {ROLE_HELP[r]}
              </span>
            </label>
          ))}
        </fieldset>
        <Field label="Senha inicial" hint="12 caracteres ou mais; uma frase é mais fácil de lembrar. Sem o nome ou o e-mail da pessoa." error={pwErr}>
          {(p) => <PasswordInput {...p} value={password} onChange={setPassword} />}
        </Field>
        {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="adm-btn is-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="adm-btn" disabled={act.busy}>
            Criar conta
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPassword({ user, onClose, onSaved }: { user: TeamUser; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const act = useAction()
  return (
    <Modal title={`Nova senha para ${user.name}`} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const h = passwordHint(password)
          setPwErr(h)
          if (h) return
          await act.run(async () => {
            await adminApi.resetPassword(user.id, password)
            onSaved()
          })
        }}
      >
        <p>Use quando a pessoa esqueceu a senha. Ela sai de todos os aparelhos e destrava a conta.</p>
        <Field label="Senha nova" error={pwErr}>
          {(p) => <PasswordInput {...p} value={password} onChange={setPassword} />}
        </Field>
        {act.msg && <Notice kind={act.msg.kind}>{act.msg.text}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="adm-btn is-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="adm-btn" disabled={act.busy}>
            Definir senha
          </button>
        </div>
      </form>
    </Modal>
  )
}
