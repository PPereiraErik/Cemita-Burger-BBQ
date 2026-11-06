import { useState } from 'react'
import { MENU_PRICES_CHECKED_AT, categoryOf, findItem, formatPrice, orderLink } from '../config/menu'
import { COMBO_DRINKS, COMBO_INCLUDES, groupsFor } from '../config/options'
import { photo } from '../config/photos'
import { restaurant } from '../config/restaurant'
import { CATEGORIA_VIEW } from '../config/site'
import { canCombo, comanda, unitPrice, useComanda, useServerQuote, whatsappComandaUrl } from '../lib/comanda'
import { nativeOrdering, useAvailability, useComboOffered, useComboPrice, useLive } from '../lib/live'
import { sound } from '../lib/sound'
import { storeBlocker } from '../lib/checkout'
import { closeComanda, closeProduct, openCheckout, openProduct, useUI } from '../lib/ui'
import { Dialog } from './Dialog'
import { Art, ArtImage, Img, Price, Unavailable } from './Objects'
import { OptionsPicker } from './OptionsPicker'

/**
 * COMANDA E DETALHES DO PRODUTO
 * - ProductModal: foto, descrição, combo, adicionais obrigatórios (ex.: ponto da carne), observação e quantidade.
 * - Receipt: a comanda (gaveta). No modo VUCA leva ao delivery; com o pedido pelo site ligado, abre o checkout.
 */
/* ---------- detalhes do produto ---------- */
export function ProductModal({ id }: { id: string }) {
  const item = findItem(id)
  // "virar combo" (aviso de anotado ou linha da comanda): abre já com o combo marcado e as escolhas da linha
  const preset = useUI().preset
  const [qty, setQty] = useState(preset?.qty ?? 1)
  const [combo, setCombo] = useState(!!preset?.combo)
  const [note, setNote] = useState(preset?.note ?? '')
  const [opts, setOpts] = useState<string[]>(preset?.opts ?? [])
  const hasPhoto = !!photo(`cardapio/${id}`)
  const comboOk = useComboOffered(id, canCombo(id))
  const comboPrice = useComboPrice()
  const availability = useAvailability(id)
  useLive() // preço novo da API redesenha o botão
  const isCombo = combo && comboOk
  const groups = groupsFor(categoryOf(id))
  const chosen = opts.filter((o) => isCombo || !o.startsWith('bebida:'))
  const unit = unitPrice(item, isCombo, chosen)
  // o que falta escolher (grupos obrigatórios)
  const missing = [...groups, ...(isCombo ? [COMBO_DRINKS] : [])].filter((g) => g.required && !chosen.some((o) => o.startsWith(`${g.id}:`)))
  return (
    <Dialog label={item.name} onClose={closeProduct} className="paper paper-grain max-h-[92svh] w-full max-w-[880px] overflow-y-auto rounded-t-[14px] bg-sheet text-char sm:rounded-[14px]">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* a foto fica parada enquanto as opções rolam (não estica com a altura do conteúdo) */}
        <div className="relative sm:sticky sm:top-0 sm:self-start">
          {hasPhoto ? (
            <Img k={`cardapio/${id}`} alt={`${item.name}: ${item.description ?? ''}`} className="aspect-[16/11] w-full sm:aspect-[4/5]" priority />
          ) : (
            <div className="grid aspect-[16/9] place-items-center bg-char text-bone sm:aspect-[4/5]">
              <Art name="caldeirao" className="aspect-[900/642] w-[62%] text-bone" />
              <p className="t-label absolute bottom-4 left-0 w-full text-center !text-[0.7rem] text-bone/70">foto em breve</p>
            </div>
          )}
          <button type="button" onClick={closeProduct} data-autofocus className="absolute top-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-sheet text-2xl text-char shadow-md hover:bg-lilac" aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <p className="t-label text-mute">{CATEGORIA_VIEW[categoryOf(id)]?.titulo ?? ''}</p>
          <h3 className="t-display -mt-2 text-[clamp(2rem,4vw,2.8rem)]">{item.name}</h3>
          {item.description && <p className="leading-snug text-mute">{item.description}</p>}
          <Price item={item} className="text-[1.4rem]" />

          {comboOk && (
            <label className={`flex cursor-pointer items-start gap-3 rounded-[10px] border-2 p-3 transition-colors ${combo ? 'border-char bg-lilac' : 'border-char/25 hover:border-char/60'}`}>
              <input type="checkbox" checked={combo} onChange={(e) => setCombo(e.target.checked)} className="mt-1 h-5 w-5 accent-[#3b393e]" />
              <span>
                <span className="block font-semibold">Transformar em combo · + {formatPrice(comboPrice)}</span>
                <span className="block text-[0.88rem] text-mute">{COMBO_INCLUDES}.</span>
              </span>
            </label>
          )}
          {isCombo && <OptionsPicker groups={[COMBO_DRINKS]} value={opts} onChange={setOpts} />}
          {groups.length > 0 && <OptionsPicker groups={groups} value={opts} onChange={setOpts} />}

          <label className="block">
            <span className="mb-1 block text-[0.92rem] font-semibold">
              Observação <span className="font-normal text-mute">(opcional)</span>
            </span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} rows={2} placeholder="Ex.: sem cebola" className="w-full resize-none rounded-[8px] border-2 border-char/25 bg-bone px-3 py-2 text-[1rem] placeholder:text-mute/70 focus:border-char focus:outline-none" />
          </label>

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center rounded-full border-2 border-char" role="group" aria-label="Quantidade">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-11 place-items-center text-xl" aria-label="Menos um">
                −
              </button>
              <span className="t-price w-8 text-center text-lg" aria-live="polite">
                {qty}
              </span>
              <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className="grid h-11 w-11 place-items-center text-xl" aria-label="Mais um">
                +
              </button>
            </div>
            {availability === 'ok' ? (
              <button
                type="button"
                aria-disabled={missing.length > 0}
                aria-describedby={missing.length ? 'falta-escolher' : undefined}
                onClick={() => {
                  if (missing.length) return document.getElementById('falta-escolher')?.focus()
                  if (preset?.replaceKey) comanda.replace(preset.replaceKey, item, { qty, combo: isCombo, note, opts: chosen })
                  else comanda.add(item, { qty, combo: isCombo, note, opts: chosen })
                  sound.tap()
                  closeProduct()
                }}
                className={`btn-ticket flex-1 ${missing.length ? 'opacity-50' : ''}`}
              >
                {preset?.replaceKey ? 'Atualizar' : 'Anotar'} · {formatPrice(unit * qty)}
              </button>
            ) : (
              <Unavailable item={item} />
            )}
          </div>
          {missing.length > 0 && availability === 'ok' && (
            <p id="falta-escolher" tabIndex={-1} role="status" className="-mt-2 text-[0.9rem] font-semibold text-blood">
              ⚠ Falta escolher: {missing.map((g) => g.title.replace(/^Escolha (o|a) /, '').toLowerCase()).join(' e ')}.
            </p>
          )}
          <a href={orderLink(item)} target="_blank" rel="noopener" className="btn-line self-start !min-h-10 !text-[0.78rem] text-mute">
            Pedir só este no delivery ↗
          </a>
        </div>
      </div>
    </Dialog>
  )
}

/* ---------- a comanda ---------- */
export function Receipt({ inDrawer = false }: { inDrawer?: boolean }) {
  const { items, total: localTotal, qty, quip, tick } = useComanda()
  const live = useLive()
  const server = useServerQuote()
  const subtotal = items.reduce((t, l) => t + unitPrice(l.item, false, l.opts) * l.qty, 0)
  const combos = localTotal - subtotal
  // Pedido pelo site ligado: o total oficial é o do servidor; sem resposta ainda, mostra o local.
  const total = server.state === 'ok' ? server.totalCents / 100 : localTotal
  const problemOf = (key: string) => (server.state === 'ok' ? server.problems.find((p) => p.key === key)?.message : undefined)
  const native = nativeOrdering(live)
  const blocker = native ? storeBlocker(live.store) : null
  const hasProblems = server.state === 'ok' && (server.problems.length > 0 || server.general.length > 0)
  // oferta "virar combo": só onde o combo existe (no pedido pelo site, só se estiver publicado no banco)
  const comboPrice = useComboPrice()
  const comboFor = (slug: string) => canCombo(slug) && (!native || !!live.index?.get(slug)?.combo)
  return (
    <div className={`sheet zigzag relative px-5 pt-5 pb-9 font-mono text-[0.9rem] ${inDrawer ? '' : 'rounded-t-[10px] border-2 border-b-0 border-char'}`}>
      <div className="flex items-center gap-3">
        <ArtImage name="caveira" className="h-12 w-12 shrink-0 object-contain" />
        <div>
          <p className="t-display text-[1.9rem] leading-none">Comanda</p>
          <p className="mt-1 text-[0.7rem] tracking-[.16em] text-mute uppercase">nº 0165 · mesa sua</p>
        </div>
      </div>
      <div aria-hidden="true" className="my-4 border-t-2 border-dashed border-char/30" />

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-4 text-center">
          <Art name="lapide" className="aspect-[775/898] w-20 text-char/80" />
          <p className="t-display mt-3 text-[1.5rem]">Comanda vazia.</p>
          <p className="text-mute">Por enquanto. Toque no + de um lanche.</p>
        </div>
      ) : (
        <ul className={`no-scrollbar space-y-3 overflow-y-auto ${inDrawer ? 'max-h-[44svh]' : 'max-h-[46svh]'}`} aria-label="Itens da comanda">
          {items.map((l) => (
            <li key={l.key} className="border-b border-dashed border-char/15 pb-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-sans text-[1rem] leading-snug font-semibold">{l.item.name}</span>
                <span className="t-price">{formatPrice(l.lineTotal)}</span>
              </div>
              {problemOf(l.key) && (
                <p role="status" className="mt-1 text-[0.8rem] font-semibold text-blood">
                  ⚠ {problemOf(l.key)}
                </p>
              )}
              {!l.combo && comboFor(l.id) && (
                <button
                  type="button"
                  onClick={() => openProduct(l.id, { combo: true, replaceKey: l.key, qty: l.qty, note: l.note, opts: l.opts })}
                  className="mt-1 min-h-11 text-left text-[0.8rem] font-semibold underline underline-offset-4 hover:text-blood"
                  aria-label={`Transformar ${l.item.name} em combo: ${COMBO_INCLUDES.toLowerCase()}, mais ${formatPrice(comboPrice)}`}
                >
                  + Virar combo: fritas e bebida por + {formatPrice(comboPrice)}
                </button>
              )}
              {(l.combo || l.note || l.extras) && (
                <p className="mt-0.5 text-[0.78rem] leading-snug text-mute">
                  {l.combo && <span className="tag mr-1 !py-0 !text-[0.62rem]">combo</span>}
                  {l.extras && <span className="mr-1">{l.extras}</span>}
                  {l.note && <span>obs.: {l.note}</span>}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center rounded-full border-2 border-char/70" role="group" aria-label={`Quantidade de ${l.item.name}`}>
                  <button type="button" onClick={() => comanda.dec(l.key)} className="grid h-9 w-10 place-items-center text-lg" aria-label={`Tirar um ${l.item.name}`}>
                    −
                  </button>
                  <span className="t-price w-6 text-center">{l.qty}</span>
                  <button type="button" onClick={() => comanda.inc(l.key)} className="grid h-9 w-10 place-items-center text-lg" aria-label={`Mais um ${l.item.name}`}>
                    +
                  </button>
                </div>
                <button type="button" onClick={() => comanda.remove(l.key)} className="min-h-9 px-1 text-[0.72rem] tracking-[.12em] text-mute uppercase underline underline-offset-4 hover:text-blood" aria-label={`Remover ${l.item.name} da comanda`}>
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div aria-hidden="true" className="my-4 border-t-2 border-dashed border-char/30" />
      {combos > 0 && server.state !== 'ok' && (
        <div className="space-y-1 text-[0.86rem] text-mute">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="t-price">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Combos</span>
            <span className="t-price">{formatPrice(combos)}</span>
          </div>
        </div>
      )}
      <div className="mt-1 flex items-baseline justify-between text-[1.1rem]">
        <span className="tracking-[.16em] uppercase">Total</span>
        <span className="t-price text-[1.35rem]" aria-busy={server.state === 'loading'}>
          {formatPrice(total)}
        </span>
      </div>
      <p className="mt-1 text-[0.72rem] text-mute">
        {qty} {qty === 1 ? 'item' : 'itens'} ·{' '}
        {server.state === 'ok' ? 'total conferido pelo Cemita' : server.state === 'loading' ? 'conferindo o total…' : live.index ? 'preços do cardápio atual' : `preços do delivery em ${MENU_PRICES_CHECKED_AT}`}
      </p>
      {server.state === 'ok' &&
        server.general.map((m) => (
          <p key={m} role="status" className="mt-1 text-[0.8rem] font-semibold text-blood">
            ⚠ {m}
          </p>
        ))}
      {quip && items.length > 0 && (
        <p key={tick} role="status" className="mt-4 inline-block -rotate-2 rounded-[4px] border-2 border-blood px-3 py-1 text-[0.8rem] tracking-[.1em] text-blood uppercase" style={{ animation: 'pop-in .3s ease-out' }}>
          {quip}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {native ? (
          <>
            {/* pedido pelo próprio site (modo native/both, ligado no painel) */}
            <button
              type="button"
              onClick={openCheckout}
              disabled={!items.length || !!blocker || hasProblems}
              aria-describedby={blocker || hasProblems ? 'pedido-bloqueio' : undefined}
              className="btn-ticket w-full disabled:pointer-events-none disabled:opacity-40"
            >
              Fazer pedido →
            </button>
            {items.length > 0 && (blocker || hasProblems) && (
              <p id="pedido-bloqueio" role="status" className="text-[0.8rem] leading-snug font-semibold text-blood">
                ⚠ {blocker ?? 'Ajuste os itens marcados acima para pedir pelo site.'}
              </p>
            )}
            {live.store?.orderingMode === 'both' && (
              <a href={restaurant.order.url} target="_blank" rel="noopener" className="btn-line justify-center !min-h-11 !text-[0.78rem]">
                ou finalize no delivery ↗
              </a>
            )}
          </>
        ) : (
          <a href={restaurant.order.url} target="_blank" rel="noopener" className={`btn-ticket w-full ${items.length ? '' : 'pointer-events-none opacity-40'}`} aria-disabled={!items.length}>
            Finalizar no delivery →
          </a>
        )}
        {items.length > 0 && (
          <a href={whatsappComandaUrl(items, total)} target="_blank" rel="noopener" className="btn-line justify-center !min-h-11 !text-[0.78rem]">
            Mandar a comanda no WhatsApp
          </a>
        )}
        {inDrawer && (
          <a href="#cardapio" onClick={closeComanda} className="btn-line justify-center !min-h-11 !text-[0.78rem]">
            ← Continuar escolhendo
          </a>
        )}
        <p className="text-[0.72rem] leading-snug text-mute">
          {native
            ? 'O total é conferido pela Cemita. Você paga na entrega ou na retirada: nada é cobrado pelo site.'
            : 'A comanda é um lembrete: o pedido é feito no delivery oficial. Combo, adicionais e observações você confirma lá (ou manda a comanda pelo WhatsApp).'}
        </p>
        {items.length > 0 && (
          <button type="button" onClick={() => comanda.clear()} className="self-start text-[0.72rem] tracking-[.12em] text-mute uppercase underline underline-offset-4 hover:text-blood">
            Limpar comanda
          </button>
        )}
      </div>
    </div>
  )
}

