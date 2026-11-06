import { useEffect, useState } from 'react'
import { Account } from './Account'
import { adminApi, AdminError, API_BASE, errorText, onSessionLost } from './adminApi'
import { Audit } from './Audit'
import { Catalog } from './Catalog'
import { Events } from './Events'
import type { Me, Permission } from './core'
import { Login } from './Login'
import { Orders } from './Orders'
import { Store } from './Store'
import { Team } from './Team'
import { Notice } from './ui'
import { Zones } from './Zones'

type Tab = 'pedidos' | 'cardapio' | 'eventos' | 'loja' | 'entregas' | 'equipe' | 'registro' | 'conta'
const TABS: { key: Tab; label: string; need?: Permission }[] = [
  { key: 'pedidos', label: 'Pedidos', need: 'viewOrders' },
  { key: 'cardapio', label: 'Cardápio', need: 'setProductAvailability' },
  { key: 'eventos', label: 'Eventos', need: 'manageEvents' },
  { key: 'loja', label: 'Loja', need: 'pauseStore' },
  { key: 'entregas', label: 'Entregas', need: 'manageZones' },
  { key: 'equipe', label: 'Equipe', need: 'manageUsers' },
  { key: 'registro', label: 'Registro', need: 'viewAudit' },
  { key: 'conta', label: 'Minha conta' },
]

const tabFromHash = (): Tab => (location.hash.replace('#', '') as Tab) || 'pedidos'

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined) // undefined = conferindo a sessão
  const [notice, setNotice] = useState<string | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(tabFromHash)

  useEffect(() => {
    if (!API_BASE) return
    adminApi
      .me()
      .then((r) => setMe(r.user))
      .catch((e) => {
        if (e instanceof AdminError && e.status === 401) setMe(null)
        else setBootError(errorText(e))
      })
    return onSessionLost(() => {
      setMe(null)
      setNotice('Sua sessão terminou. Entre de novo.')
    })
  }, [])

  useEffect(() => {
    const on = () => setTab(tabFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  if (!API_BASE)
    return (
      <main className="mx-auto max-w-xl p-6">
        <Notice kind="error">O painel precisa da API. Defina VITE_API_URL (ex.: http://localhost:3333/api/v1) e rode de novo.</Notice>
      </main>
    )
  if (bootError)
    return (
      <main className="mx-auto grid max-w-xl gap-3 p-6">
        <Notice kind="error">{bootError}</Notice>
        <button type="button" className="adm-btn" onClick={() => location.reload()}>
          Tentar de novo
        </button>
      </main>
    )
  if (me === undefined) return <p className="p-6">Carregando…</p>
  if (me === null)
    return (
      <Login
        notice={notice}
        onDone={(u) => {
          setNotice(null)
          setMe(u)
        }}
      />
    )

  const visible = TABS.filter((t) => !t.need || me.can[t.need])
  const current = visible.some((t) => t.key === tab) ? tab : visible[0].key

  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-osso focus:p-3">
        Pular para o conteúdo
      </a>
      <header className="bg-tinta text-osso">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="font-display text-2xl">Cemita · Painel</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              {me.name} · <strong>{me.roleLabel}</strong>
            </span>
            <button
              type="button"
              className="adm-btn min-h-10 border-osso bg-transparent px-3 text-osso"
              onClick={async () => {
                await adminApi.logout().catch(() => undefined)
                setMe(null)
              }}
            >
              Sair
            </button>
          </div>
        </div>
        <nav aria-label="Seções do painel" className="mx-auto max-w-[110rem] overflow-x-auto px-2">
          <ul className="flex gap-1">
            {visible.map((t) => (
              <li key={t.key}>
                <a
                  href={`#${t.key}`}
                  aria-current={t.key === current ? 'page' : undefined}
                  className={`inline-flex min-h-12 items-center rounded-t-lg px-4 font-mono text-sm tracking-wider uppercase ${t.key === current ? 'bg-papel-3 text-tinta' : 'text-osso-2 hover:text-osso hover:underline'}`}
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-[110rem] p-4 sm:p-6">
        {current === 'pedidos' && <Orders me={me} />}
        {current === 'cardapio' && <Catalog me={me} />}
        {current === 'eventos' && <Events />}
        {current === 'loja' && <Store me={me} />}
        {current === 'entregas' && <Zones />}
        {current === 'equipe' && <Team me={me} />}
        {current === 'registro' && <Audit />}
        {current === 'conta' && (
          <Account
            me={me}
            onPasswordChanged={() => {
              setMe(null)
              setNotice('Senha trocada. Entre com a senha nova.')
            }}
          />
        )}
      </main>
    </div>
  )
}
