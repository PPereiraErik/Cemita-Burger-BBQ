import { formatPrice } from '../config/menu'
import { logo } from '../config/photos'
import { openA11yPanel } from '../lib/a11y'
import { useComanda } from '../lib/comanda'
import { myOrders, useMyOrders } from '../lib/orders'
import { openComanda } from '../lib/ui'
import { Gravura } from './Gravura'
import { IconA11y, IconClose, IconMenu } from './Icons'
import { alternarLateral, useLateralAberta, useSecaoAtiva, useSecoes } from './nav'

/**
 * MENU — computador: barra lateral fixa que abre e fecha (a escolha fica lembrada).
 * Aberta: logo, seções (CARDÁPIO em destaque), comanda com contador, voltar ao início, acessibilidade.
 * Fechada: só ícones (logo, abrir, comanda, acessibilidade, voltar ao início).
 */
const link = 't-kicker flex min-h-11 items-center text-creme no-underline hover:text-laranja'

export function Sidebar() {
  const aberta = useLateralAberta()
  const { qty, total } = useComanda()
  const ativa = useSecaoAtiva()
  const secoes = useSecoes()
  const meus = useMyOrders()
  const ultimo = meus.orders[0]
  const contador = (
    <span key={qty} className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-laranja px-1.5 text-[12px] text-tinta tabular-nums" style={qty ? { animation: 'bump .35s ease-out' } : undefined}>
      {qty}
    </span>
  )

  if (!aberta)
    return (
      <nav aria-label="Menu principal" className="tinta sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col items-center gap-4 bg-barra py-[18px] lg:flex">
        <a href="#inicio" aria-label="Cemita Burger & BBQ — início" className="block">
          <img src={logo} alt="" className="h-[52px] w-[52px] rounded-full" />
        </a>
        <button type="button" onClick={alternarLateral} aria-label="Abrir menu" aria-expanded={false} className="grid h-12 w-12 place-items-center text-creme hover:text-laranja">
          <IconMenu />
        </button>
        <button type="button" onClick={openComanda} aria-label={`Abrir comanda: ${qty} ${qty === 1 ? 'item' : 'itens'}`} className="grid h-12 w-12 place-items-center font-mono">
          {contador}
        </button>
        {ultimo && (
          <button type="button" onClick={() => myOrders.openTracking(ultimo.code)} aria-label={`Acompanhar o pedido ${ultimo.code}`} className="grid h-12 w-12 place-items-center text-xl text-laranja">
            ⏲
          </button>
        )}
        <div className="mt-auto flex flex-col items-center gap-1">
          <button type="button" onClick={openA11yPanel} aria-haspopup="dialog" aria-label="Acessibilidade" className="grid h-12 w-12 place-items-center text-creme-2 hover:text-laranja">
            <IconA11y />
          </button>
          <a href="#inicio" aria-label="Voltar ao início" className="grid h-12 w-12 place-items-center font-mono text-lg text-creme-2 no-underline hover:text-laranja">
            ↑
          </a>
        </div>
      </nav>
    )

  return (
    <nav aria-label="Menu principal" className="tinta sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col gap-[26px] overflow-y-auto bg-barra px-[22px] pt-6 pb-7 lg:flex">
      <div className="flex items-start justify-between gap-3">
        <a href="#inicio" aria-label="Cemita Burger & BBQ — início" className="block">
          <img src={logo} alt="" className="h-[104px] w-[104px] rounded-full" />
        </a>
        <button type="button" onClick={alternarLateral} aria-label="Fechar menu" aria-expanded={true} className="grid h-11 w-11 place-items-center text-creme hover:text-laranja">
          <IconClose />
        </button>
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {secoes.map((s) =>
          s.id === 'cardapio' ? (
            <li key={s.id}>
              <a href="#cardapio" aria-current={ativa === s.id ? 'true' : undefined} className="t-kicker -mx-3 my-1 flex min-h-12 items-center justify-between rounded-[2px] bg-papel px-3 font-medium text-tinta no-underline hover:bg-laranja">
                CARDÁPIO <span aria-hidden="true">→</span>
              </a>
            </li>
          ) : (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={ativa === s.id ? 'true' : undefined} className={`${link} ${ativa === s.id ? 'text-laranja' : ''}`}>
                {s.label.toUpperCase()}
              </a>
            </li>
          ),
        )}
      </ul>
      <Gravura name="morcego" className="flutua w-[110px] opacity-75" />
      <div className="mt-auto flex flex-col gap-2.5">
        {ultimo && (
          <button type="button" onClick={() => myOrders.openTracking(ultimo.code)} className="t-kicker flex min-h-12 items-center justify-between rounded-[2px] border-[1.5px] border-laranja px-2 text-laranja">
            SEU PEDIDO <span aria-hidden="true">⏲</span>
          </button>
        )}
        <button type="button" onClick={openComanda} aria-label={`Abrir comanda: ${qty} ${qty === 1 ? 'item' : 'itens'}${qty ? `, ${formatPrice(total)}` : ''}`} className={`t-kicker flex min-h-12 items-center justify-between border-0 border-b-[1.5px] border-solid bg-transparent px-1 text-creme hover:text-laranja ${qty ? 'border-laranja' : 'border-creme/40'}`}>
          <span className="flex flex-col items-start leading-tight">
            COMANDA
            {qty > 0 && <span className="text-[11px] tracking-normal text-laranja tabular-nums">{formatPrice(total)}</span>}
          </span>
          {contador}
        </button>
        <a href="#inicio" className="t-kicker flex min-h-11 items-center text-creme-2 no-underline hover:text-laranja">
          ↑ VOLTAR AO INÍCIO
        </a>
        <button type="button" onClick={openA11yPanel} aria-haspopup="dialog" className="t-kicker flex min-h-11 items-center gap-2 text-left text-creme-2 underline underline-offset-4 hover:text-laranja">
          <IconA11y size={18} /> ACESSIBILIDADE
        </button>
      </div>
    </nav>
  )
}
