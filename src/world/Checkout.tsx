import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { formatPrice } from '../config/menu'
import { restaurant } from '../config/restaurant'
import { ApiError, api, type ApiQuote } from '../lib/api'
import {
  EMPTY_FORM,
  isOnlineMethod,
  PAYMENT_HINT,
  PAYMENT_LABEL,
  safeCheckoutUrl,
  SERVER_CODE_FIELD,
  fieldErrorsFromServer,
  formatCep,
  formatPhone,
  newIdempotencyKey,
  quoteAddress,
  storeBlocker,
  toOrderBody,
  validateForm,
  type CheckoutForm,
  type FieldErrors,
  type PaymentMethod,
} from '../lib/checkout'
import { comanda, useComanda } from '../lib/comanda'
import { useLive } from '../lib/live'
import { toQuoteLines } from '../lib/liveCore'
import { myOrders } from '../lib/orders'
import { closeCheckout, openComanda } from '../lib/ui'
import { Dialog } from './Dialog'

/**
 * CHECKOUT — o pedido pelo próprio site (só com o modo native/both ligado no painel).
 * - O formulário só junta dados: quem calcula total, taxa e desconto é o servidor (cotação ao vivo).
 * - Enviar usa uma chave de idempotência: se a internet cair e a pessoa tentar de novo,
 *   o servidor devolve o MESMO pedido (nunca duplica). A chave muda só se o conteúdo mudar.
 * - Pagamento na entrega/retirada (dinheiro ou maquininha) ou, com o Mercado Pago configurado, Pix/cartão no site:
 *   o cliente vai para a página do Mercado Pago e volta para o acompanhamento; o pedido só vai para a cozinha
 *   quando o servidor recebe a confirmação do pagamento (webhook).
 * - Sucesso só aparece com a resposta 201/200 do servidor. Depois disso, a tela de acompanhamento abre.
 * Os dados digitados ficam só na memória desta aba (não são salvos no aparelho).
 */
let draft: CheckoutForm = EMPTY_FORM

type QuoteState = { state: 'idle' | 'loading' | 'error' } | { state: 'ok'; q: ApiQuote }

const centsToBRL = (c: number) => formatPrice(c / 100)

function Field({ id, label, hint, error, children }: { id: string; label: ReactNode; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[0.92rem] font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-[0.82rem] text-mute">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-[0.86rem] font-semibold text-blood">
          ⚠ {error}
        </p>
      )}
    </div>
  )
}

const inputCls = (err?: string) =>
  `w-full rounded-[8px] border-2 bg-bone px-3 py-2.5 text-[1rem] text-char placeholder:text-mute/70 focus:border-char focus:outline-none ${err ? 'border-blood' : 'border-char/30'}`

export function Checkout() {
  const live = useLive()
  const { items } = useComanda()
  const store = live.store
  const [f, setF] = useState<CheckoutForm>(draft)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [quote, setQuote] = useState<QuoteState>({ state: 'idle' })
  const key = useRef<{ body: string; key: string } | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    draft = f
  }, [f])

  const set = <K extends keyof CheckoutForm>(k: K, v: CheckoutForm[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  // linhas para o servidor (ids e quantidades) + o que não dá para pedir pelo site
  const payload = useMemo(() => (live.index ? toQuoteLines(items, live.index) : null), [items, live.index])
  const methods = (store?.paymentMethods ?? []) as PaymentMethod[]
  const deliveryAvailable = !!store?.fulfillment.delivery.available
  const blocker = storeBlocker(store)

  // primeira forma de pagamento já marcada quando só existe uma
  useEffect(() => {
    if (!f.paymentMethod && methods.length === 1) set('paymentMethod', methods[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods.join(',')])

  // cotação ao vivo, com a forma de entrega e o endereço (taxa da zona)
  const addr = quoteAddress(f)
  const quoteKey = JSON.stringify([payload?.lines, f.fulfillment, addr])
  useEffect(() => {
    if (!payload || !payload.lines.length) return
    const ctrl = new AbortController()
    setQuote({ state: 'loading' })
    const t = window.setTimeout(() => {
      api
        .quote(payload.lines, ctrl.signal, { fulfillment: f.fulfillment, address: addr })
        .then((q) => setQuote({ state: 'ok', q }))
        .catch(() => !ctrl.signal.aborted && setQuote({ state: 'error' }))
    }, 350)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey])

  const q = quote.state === 'ok' ? quote.q : null
  const hasAdultItems = !!q?.hasAdultItems
  const deliveryMiss = f.fulfillment === 'delivery' && q?.errors.some((e) => e.code === 'DELIVERY_UNAVAILABLE') && !!addr
  const generalIssues = (q?.errors ?? []).filter((e) => typeof e.line !== 'number' && e.code !== 'DELIVERY_UNAVAILABLE')
  const lineIssues = (q?.errors ?? []).filter((e) => typeof e.line === 'number')
  const notSendable = (payload?.problems.length ?? 0) > 0 || lineIssues.length > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setGeneral(null)
    if (!store || !payload || !store.privacyPolicy) return setGeneral(blocker ?? 'Não foi possível falar com a Cemita agora.')
    const errs = validateForm(f, { totalCents: q?.totalCents ?? null, hasAdultItems, paymentMethods: methods, deliveryAvailable })
    setErrors(errs)
    if (Object.keys(errs).length) {
      window.setTimeout(() => summaryRef.current?.focus(), 0)
      return
    }
    if (notSendable) return setGeneral('Alguns itens da comanda não podem ser pedidos pelo site. Volte à comanda e ajuste.')

    const body = toOrderBody(f, payload.lines, store.privacyPolicy.id, hasAdultItems)
    const bodyJson = JSON.stringify(body)
    // mesma tentativa (mesmo conteúdo) = mesma chave: reenviar nunca duplica
    if (!key.current || key.current.body !== bodyJson) key.current = { body: bodyJson, key: newIdempotencyKey() }

    setSending(true)
    try {
      const r = await api.createOrder(body, key.current.key)
      myOrders.add({ code: r.order.code, token: r.trackingToken, placedAt: r.order.placedAt })
      comanda.clear()
      draft = { ...EMPTY_FORM, name: f.name, phone: f.phone }
      key.current = null
      // Pix/cartão no site: segue para a página de pagamento do Mercado Pago (a volta abre o acompanhamento)
      const pay = isOnlineMethod(f.paymentMethod) ? safeCheckoutUrl(r.order.payment?.checkoutUrl) : null
      if (pay) {
        window.location.assign(pay)
        return
      }
      closeCheckout()
      myOrders.openTracking(r.order.code)
    } catch (err) {
      const a = err instanceof ApiError ? err : null
      const field = a ? SERVER_CODE_FIELD[a.code] : undefined
      if (a?.code === 'VALIDATION_ERROR') {
        setErrors(fieldErrorsFromServer(a.details?.fields))
        setGeneral('Confira os campos marcados.')
      } else if (field) {
        setErrors((x) => ({ ...x, [field]: a!.message }))
        setGeneral(a!.message)
      } else if (a?.code === 'ORDER_INVALID') {
        setGeneral(a.details?.errors?.map((x) => x.message).join(' ') || a.message)
      } else if (a && (a.code === 'TIMEOUT' || a.code === 'NETWORK_ERROR')) {
        setGeneral('A conexão caiu antes da resposta. Toque em "Enviar pedido" de novo: se o pedido já chegou, ele não será duplicado.')
      } else {
        setGeneral(a?.message ?? 'Não foi possível enviar o pedido. Tente de novo.')
      }
      window.setTimeout(() => summaryRef.current?.focus(), 0)
    } finally {
      setSending(false)
    }
  }

  const errorList = Object.entries(errors).filter(([, v]) => v) as [keyof CheckoutForm, string][]
  const describe = (k: keyof CheckoutForm, hint = false) => (errors[k] ? `ck-${k}-err` : hint ? `ck-${k}-hint` : undefined)

  return (
    <Dialog label="Fazer pedido" onClose={closeCheckout} side="auto" className="paper paper-grain max-h-[94svh] w-full max-w-[560px] overflow-y-auto rounded-t-[14px] border-2 border-b-0 border-tinta bg-sheet text-char lg:h-full lg:max-h-none lg:rounded-none lg:border-0 lg:border-l-2">
      <div className="px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="t-display text-[2rem]">Fazer pedido</h2>
          <button type="button" data-autofocus onClick={closeCheckout} className="t-label min-h-11 px-2" aria-label="Fechar o pedido (a comanda continua anotada)">
            Fechar ×
          </button>
        </div>
        <p className="text-[0.95rem] text-mute">Pagamento na entrega ou na retirada. Nada é cobrado pelo site.</p>

        {blocker && (
          <p role="alert" className="mt-4 rounded-[10px] border-2 border-blood p-3 font-semibold text-blood">
            ⚠ {blocker}
          </p>
        )}

        {/* o que está sendo pedido */}
        <section aria-labelledby="ck-itens" className="mt-5 rounded-[10px] border-2 border-char/25 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 id="ck-itens" className="font-semibold">
              Seu pedido
            </h3>
            <button
              type="button"
              onClick={() => {
                closeCheckout()
                openComanda()
              }}
              className="t-label min-h-10 underline underline-offset-4"
            >
              Editar comanda
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-[0.95rem]">
            {items.map((l) => {
              const problem = payload?.problems.find((p) => p.key === l.key)?.message
              return (
                <li key={l.key}>
                  <span className="t-mono">{l.qty}×</span> {l.item.name}
                  {l.combo && <span className="text-mute"> · em combo</span>}
                  {l.extras && <span className="text-mute"> · {l.extras}</span>}
                  {l.note && <span className="text-mute"> · obs.: {l.note}</span>}
                  {problem && <span className="block text-[0.85rem] font-semibold text-blood">⚠ {problem}</span>}
                </li>
              )
            })}
          </ul>
          {lineIssues.map((e, i) => (
            <p key={i} className="mt-1 text-[0.85rem] font-semibold text-blood">
              ⚠ {e.message}
            </p>
          ))}
        </section>

        <form noValidate onSubmit={submit} className="mt-5 flex flex-col gap-5" aria-describedby="ck-pagamento-info">
          {/* resumo de erros: recebe o foco quando algo falta */}
          {(errorList.length > 0 || general) && (
            <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-[10px] border-2 border-blood p-3 text-blood focus:outline-none">
              <p className="font-semibold">⚠ {general ?? 'Falta pouco: confira os campos abaixo.'}</p>
              {errorList.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-[0.9rem]">
                  {errorList.map(([k, v]) => (
                    <li key={k}>
                      <a href={`#ck-${k}`} className="underline underline-offset-2">
                        {v}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <fieldset className="flex flex-col gap-3">
            <legend className="t-label mb-2 text-mute">1 · Você</legend>
            <Field id="ck-name" label="Nome" error={errors.name}>
              <input id="ck-name" name="name" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={80} aria-invalid={!!errors.name} aria-describedby={describe('name')} className={inputCls(errors.name)} />
            </Field>
            <Field id="ck-phone" label="Telefone (WhatsApp)" hint="Para a Cemita falar com você sobre o pedido." error={errors.phone}>
              <input id="ck-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" value={f.phone} onChange={(e) => set('phone', formatPhone(e.target.value))} placeholder="(47) 99999-9999" aria-invalid={!!errors.phone} aria-describedby={describe('phone', true)} className={inputCls(errors.phone)} />
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-3" aria-describedby={errors.fulfillment ? 'ck-fulfillment-err' : undefined}>
            <legend className="t-label mb-2 text-mute">2 · Como vai receber</legend>
            <div id="ck-fulfillment" className="grid gap-2 sm:grid-cols-2">
              <label className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-[10px] border-2 p-3 ${f.fulfillment === 'pickup' ? 'border-char bg-lilac' : 'border-char/25'}`}>
                <input type="radio" name="fulfillment" value="pickup" checked={f.fulfillment === 'pickup'} onChange={() => set('fulfillment', 'pickup')} className="mt-1 h-5 w-5 accent-[#2b190d]" />
                <span>
                  <span className="block font-semibold">Retirar no balcão</span>
                  <span className="block text-[0.85rem] text-mute">
                    {restaurant.address.street}
                    {store?.fulfillment.pickup.etaMinutes ? ` · pronto em ~${store.fulfillment.pickup.etaMinutes} min` : ''}
                  </span>
                </span>
              </label>
              <label className={`flex min-h-12 items-start gap-3 rounded-[10px] border-2 p-3 ${deliveryAvailable ? 'cursor-pointer' : 'opacity-55'} ${f.fulfillment === 'delivery' ? 'border-char bg-lilac' : 'border-char/25'}`}>
                <input type="radio" name="fulfillment" value="delivery" disabled={!deliveryAvailable} checked={f.fulfillment === 'delivery'} onChange={() => set('fulfillment', 'delivery')} className="mt-1 h-5 w-5 accent-[#2b190d]" />
                <span>
                  <span className="block font-semibold">Entrega</span>
                  <span className="block text-[0.85rem] text-mute">{deliveryAvailable ? 'Taxa conforme o bairro ou CEP.' : 'Ainda não disponível pelo site.'}</span>
                </span>
              </label>
            </div>
            {errors.fulfillment && (
              <p id="ck-fulfillment-err" className="text-[0.86rem] font-semibold text-blood">
                ⚠ {errors.fulfillment}
              </p>
            )}

            {f.fulfillment === 'delivery' && (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <Field id="ck-cep" label="CEP" error={errors.cep}>
                  <input id="ck-cep" inputMode="numeric" autoComplete="postal-code" value={f.cep} onChange={(e) => set('cep', formatCep(e.target.value))} placeholder="89200-000" aria-invalid={!!errors.cep} aria-describedby={describe('cep')} className={inputCls(errors.cep)} />
                </Field>
                <Field id="ck-neighborhood" label="Bairro" error={errors.neighborhood}>
                  <input id="ck-neighborhood" autoComplete="address-level3" value={f.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} maxLength={80} aria-invalid={!!errors.neighborhood} aria-describedby={describe('neighborhood')} className={inputCls(errors.neighborhood)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field id="ck-street" label="Rua" error={errors.street}>
                    <input id="ck-street" autoComplete="address-line1" value={f.street} onChange={(e) => set('street', e.target.value)} maxLength={120} aria-invalid={!!errors.street} aria-describedby={describe('street')} className={inputCls(errors.street)} />
                  </Field>
                </div>
                <Field id="ck-number" label="Número" error={errors.number}>
                  <input id="ck-number" value={f.number} onChange={(e) => set('number', e.target.value)} maxLength={12} aria-invalid={!!errors.number} aria-describedby={describe('number')} className={inputCls(errors.number)} />
                </Field>
                <Field id="ck-complement" label={<>Complemento <span className="font-normal text-mute">(opcional)</span></>}>
                  <input id="ck-complement" autoComplete="address-line2" value={f.complement} onChange={(e) => set('complement', e.target.value)} maxLength={60} className={inputCls()} />
                </Field>
                <div className="sm:col-span-2">
                  <Field id="ck-reference" label={<>Ponto de referência <span className="font-normal text-mute">(opcional)</span></>}>
                    <input id="ck-reference" value={f.reference} onChange={(e) => set('reference', e.target.value)} maxLength={120} className={inputCls()} />
                  </Field>
                </div>
                {deliveryMiss && (
                  <p role="status" className="text-[0.9rem] font-semibold text-blood sm:col-span-2">
                    ⚠ Ainda não entregamos neste endereço. Você pode retirar no balcão.
                  </p>
                )}
                {q?.zone && (
                  <p role="status" className="text-[0.9rem] sm:col-span-2">
                    ✓ Entregamos em <strong>{q.zone.name}</strong>
                    {q.zone.etaMinMinutes && q.zone.etaMaxMinutes ? ` · ${q.zone.etaMinMinutes} a ${q.zone.etaMaxMinutes} min` : ''}.
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-3" aria-describedby={errors.paymentMethod ? 'ck-paymentMethod-err' : undefined}>
            <legend className="t-label mb-2 text-mute">3 · Pagamento</legend>
            <div id="ck-paymentMethod" className="grid gap-2">
              {methods.length === 0 && <p className="text-mute">Nenhuma forma de pagamento disponível agora.</p>}
              {methods.map((m) => (
                <label key={m} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border-2 p-3 ${f.paymentMethod === m ? 'border-char bg-lilac' : 'border-char/25'}`}>
                  <input type="radio" name="paymentMethod" value={m} checked={f.paymentMethod === m} onChange={() => set('paymentMethod', m)} className="h-5 w-5 accent-[#2b190d]" />
                  <span>
                    <span className="block font-semibold">{PAYMENT_LABEL[m] ?? m}</span>
                    {PAYMENT_HINT[m] && <span className="block text-[0.85rem] text-mute">{PAYMENT_HINT[m]}</span>}
                  </span>
                </label>
              ))}
            </div>
            {errors.paymentMethod && (
              <p id="ck-paymentMethod-err" className="text-[0.86rem] font-semibold text-blood">
                ⚠ {errors.paymentMethod}
              </p>
            )}
            {f.paymentMethod === 'cash_on_delivery' && (
              <div className="flex flex-col gap-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={f.needsChange} onChange={(e) => set('needsChange', e.target.checked)} className="h-5 w-5 accent-[#2b190d]" />
                  <span>Vou precisar de troco</span>
                </label>
                {f.needsChange && (
                  <Field id="ck-changeFor" label="Troco para quanto?" hint={q ? `O total é ${centsToBRL(q.totalCents)}.` : undefined} error={errors.changeFor}>
                    <input id="ck-changeFor" inputMode="decimal" value={f.changeFor} onChange={(e) => set('changeFor', e.target.value)} placeholder="100,00" aria-invalid={!!errors.changeFor} aria-describedby={describe('changeFor', true)} className={inputCls(errors.changeFor)} />
                  </Field>
                )}
              </div>
            )}
            <p id="ck-pagamento-info" className="text-[0.85rem] text-mute">
              Pix e cartão pelo site ainda não estão disponíveis.
            </p>
          </fieldset>

          <Field id="ck-notes" label={<>Observação do pedido <span className="font-normal text-mute">(opcional)</span></>}>
            <textarea id="ck-notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={140} rows={2} placeholder="Ex.: interfone com defeito, bater na porta" className={`${inputCls()} resize-none`} />
          </Field>

          {/* valores: sempre os do servidor */}
          <section aria-labelledby="ck-total" aria-live="polite" className="rounded-[10px] border-2 border-char p-4">
            <h3 id="ck-total" className="sr-only">
              Total
            </h3>
            {quote.state === 'loading' && <p className="text-mute">Conferindo o total…</p>}
            {quote.state === 'error' && <p className="font-semibold text-blood">⚠ Não deu para conferir o total agora. Tente de novo em instantes.</p>}
            {q && (
              <dl className="space-y-1 font-mono text-[0.95rem]">
                <div className="flex justify-between">
                  <dt>Itens</dt>
                  <dd>{centsToBRL(q.subtotalCents)}</dd>
                </div>
                {f.fulfillment === 'delivery' && (
                  <div className="flex justify-between">
                    <dt>Taxa de entrega</dt>
                    <dd>{q.zone ? centsToBRL(q.deliveryFeeCents) : '—'}</dd>
                  </div>
                )}
                {q.discountCents > 0 && (
                  <div className="flex justify-between">
                    <dt>Desconto</dt>
                    <dd>− {centsToBRL(q.discountCents)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-dashed border-char/30 pt-2 text-[1.15rem] font-medium">
                  <dt>Total</dt>
                  <dd>{centsToBRL(q.totalCents)}</dd>
                </div>
              </dl>
            )}
            {generalIssues.map((e, i) => (
              <p key={i} className="mt-2 text-[0.9rem] font-semibold text-blood">
                ⚠ {e.message}
              </p>
            ))}
          </section>

          {hasAdultItems && (
            <div>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input id="ck-adultConfirmed" type="checkbox" checked={f.adultConfirmed} onChange={(e) => set('adultConfirmed', e.target.checked)} aria-invalid={!!errors.adultConfirmed} aria-describedby={describe('adultConfirmed')} className="mt-0.5 h-5 w-5 accent-[#2b190d]" />
                <span>Tenho 18 anos ou mais (o pedido tem bebida alcoólica).</span>
              </label>
              {errors.adultConfirmed && (
                <p id="ck-adultConfirmed-err" className="mt-1 text-[0.86rem] font-semibold text-blood">
                  ⚠ {errors.adultConfirmed}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input id="ck-privacyAccepted" type="checkbox" checked={f.privacyAccepted} onChange={(e) => set('privacyAccepted', e.target.checked)} aria-invalid={!!errors.privacyAccepted} aria-describedby={describe('privacyAccepted')} className="mt-0.5 h-5 w-5 accent-[#2b190d]" />
              <span>
                Li e aceito a{' '}
                {store?.privacyPolicy ? (
                  <a href={store.privacyPolicy.url} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">
                    política de privacidade ↗
                  </a>
                ) : (
                  'política de privacidade'
                )}
                .
              </span>
            </label>
            {errors.privacyAccepted && (
              <p id="ck-privacyAccepted-err" className="mt-1 text-[0.86rem] font-semibold text-blood">
                ⚠ {errors.privacyAccepted}
              </p>
            )}
          </div>

          <button type="submit" disabled={sending || !!blocker || !items.length} aria-busy={sending} className="btn-ticket is-dark w-full !min-h-14 disabled:opacity-50">
            {sending ? 'Enviando…' : `${isOnlineMethod(f.paymentMethod) ? 'Ir para o pagamento' : 'Enviar pedido'}${q ? ` · ${centsToBRL(q.totalCents)}` : ''}`}
          </button>
          <p className="-mt-2 text-center text-[0.82rem] text-mute">
            {isOnlineMethod(f.paymentMethod)
              ? 'Você vai para a página segura do Mercado Pago. Depois de pagar, volta aqui para acompanhar o pedido.'
              : 'Só confirmamos o pedido depois da resposta da Cemita. Você acompanha tudo na próxima tela.'}
          </p>
        </form>
      </div>
    </Dialog>
  )
}
