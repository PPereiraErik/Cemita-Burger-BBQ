import { adminApi } from './adminApi'
import { auditDetail, auditLabel, ROLE_LABEL } from './core'
import { Notice, useLoad } from './ui'

/** Registro: quem fez o quê e quando (sem senha, sem dado de cliente, IP só como código). */
export function Audit() {
  const { data, error, loading, reload } = useLoad(() => adminApi.audit(200).then((r) => r.entries))
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Registro</h1>
        <button type="button" className="adm-btn is-ghost" onClick={() => void reload()}>
          Atualizar
        </button>
      </div>
      <p className="text-texto-2">As 200 ações mais recentes no painel. Não guarda senha nem dados de clientes.</p>
      {loading && !data && <p>Carregando…</p>}
      {error && <Notice kind="error">{error}</Notice>}
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <caption className="sr-only">Ações recentes no painel</caption>
            <thead>
              <tr className="border-b-2 border-tinta font-mono text-sm">
                <th className="p-2">Quando</th>
                <th className="p-2">Quem</th>
                <th className="p-2">O quê</th>
                <th className="p-2">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-b border-texto-2/40 align-top">
                  <td className="p-2 font-mono text-sm whitespace-nowrap">{new Date(e.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="p-2">{e.user ? `${e.user.name} (${ROLE_LABEL[e.user.role]})` : 'Sistema / linha de comando'}</td>
                  <td className="p-2">{auditLabel(e.action)}</td>
                  <td className="p-2 text-sm break-words">{auditDetail(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
