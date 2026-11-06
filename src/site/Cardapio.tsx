import { useEffect, useMemo, useRef, useState } from 'react'
import { menu } from '../config/menu'
import { CATEGORIA_MODELO, CATEGORIA_ORDEM, CATEGORIA_VIEW, modeloDe } from '../config/site'
import { lapides, resumo } from '../lib/cardapio'
import { sound } from '../lib/sound'
import { setCategory, useUI } from '../lib/ui'
import { Gravura, Kicker, Titulo } from './Gravura'
import { IconClose, IconSearch, Risco } from './Icons'
import { Extras } from './Extras'
import { LinhaBebida, Prato } from './Prato'
import { Retrato } from './Retrato'
import { Tombstone } from './Tombstone'

const TITULOS: Record<string, string> = Object.fromEntries(Object.entries(CATEGORIA_VIEW).map(([k, v]) => [k, v.titulo]))
const CATS = CATEGORIA_ORDEM.filter((id) => menu.some((c) => c.id === id && c.items.length))

/**
 * Nº 01 — CARDÁPIO COMPLETO NA PÁGINA (sem redirecionar)
 * Barra fixa com as categorias e a busca; cada categoria no modelo de config/site.ts (CATEGORIA_MODELO):
 * hoje, menu impresso (foto, nome, preço e descrição à vista) e lista compacta para as bebidas.
 * Trocar de categoria: os itens sobem em sequência.
 */
export function Cardapio() {
  const cat = useUI().category
  const [q, setQ] = useState('')
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [viradas, setViradas] = useState<Set<string>>(new Set())
  const [anim, setAnim] = useState<'a' | 'b'>('a')
  const grade = useRef<HTMLDivElement>(null)
  const barra = useRef<HTMLDivElement>(null)
  const trilho = useRef<HTMLDivElement>(null)
  const buscaMob = useRef<HTMLInputElement>(null)

  const itens = useMemo(() => lapides(menu, CATS, TITULOS, cat, q), [cat, q])
  // lanches e entradas viram lápides; BBQ, sobremesa e bebidas, retratos (config/site.ts)
  const lapidesVis = itens.filter((l) => modeloDe(l.categoryId) === 'lapide')
  const retratosVis = itens.filter((l) => modeloDe(l.categoryId) === 'retrato')
  const pratosVis = itens.filter((l) => modeloDe(l.categoryId) === 'prato')
  const listaVis = itens.filter((l) => modeloDe(l.categoryId) === 'lista')

  const escolher = (id: string) => {
    sound.tap()
    setCategory(id)
    setQ('')
    setViradas(new Set())
    setAnim((a) => (a === 'a' ? 'b' : 'a'))
    // se a barra já está grudada no topo, volta para o começo da grade
    const g = grade.current
    const b = barra.current
    if (g && b && g.getBoundingClientRect().top < b.getBoundingClientRect().bottom) {
      window.scrollTo({ top: g.getBoundingClientRect().top + window.scrollY - b.getBoundingClientRect().bottom + 4 })
    }
  }

  // centraliza a categoria escolhida no trilho (só na horizontal)
  useEffect(() => {
    const r = trilho.current
    const b = r?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!r || !b) return
    r.scrollTo({ left: b.offsetLeft - r.clientWidth / 2 + b.clientWidth / 2 })
  }, [cat])

  useEffect(() => {
    if (buscaAberta) buscaMob.current?.focus()
  }, [buscaAberta])

  const virar = (id: string) =>
    setViradas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const buscando = q.trim().length > 0
  const limpar = () => setQ('')

  return (
    <section id="cardapio" aria-labelledby="cardapio-titulo" className="relative bg-fundo px-5 py-14 md:px-12 md:py-[104px]" style={{ overflow: 'clip' }}>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-[22px]">
        <div className="flex flex-col gap-3.5">
          <Kicker n="01">cardápio</Kicker>
          <Titulo id="cardapio-titulo" a="Escolha sua vítima." b="Ou duas." className="text-[clamp(44px,7vw,88px)] leading-[0.95]" />
        </div>

        {/* barra fixa: categorias + busca */}
        <div ref={barra} className="sticky top-[var(--topbar)] z-20 -mx-5 flex items-center gap-1 border-b border-creme/15 bg-fundo py-2.5 pr-2 pl-5 md:mx-0 md:gap-5 md:px-0">
          <div ref={trilho} role="group" aria-label="Categorias do cardápio" className="cats flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {CATS.map((id) => {
              const on = !buscando && id === cat
              const v = CATEGORIA_VIEW[id]
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  aria-controls="cardapio-grade"
                  onClick={() => escolher(id)}
                  className={`relative flex min-h-[52px] shrink-0 items-center gap-2 pr-3 pb-1 pl-1.5 font-display text-[clamp(19px,2.2vw,22px)] leading-none ${on ? 'text-laranja' : 'text-creme-2 hover:text-creme'}`}
                >
                  <Gravura name={v.icone} className={`h-[30px] w-[30px] object-contain ${on ? '' : 'opacity-50'}`} eager />
                  {v.titulo}
                  {on && <Risco className="absolute bottom-0.5 left-1.5 h-[7px] w-[calc(100%-16px)] text-laranja" />}
                </button>
              )
            })}
          </div>
          {/* busca: campo compacto no computador, lupa no celular */}
          <label className="hidden min-h-12 w-[280px] shrink-0 items-center gap-3 rounded-[2px] border-[1.5px] border-creme/35 bg-lapide pr-1.5 pl-4 focus-within:border-laranja md:flex">
            <IconSearch size={20} className="shrink-0 text-laranja" />
            <span className="sr-only">Procurar no cardápio</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar..."
              autoComplete="off"
              aria-controls="cardapio-grade"
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-creme outline-none placeholder:text-creme-2"
            />
          </label>
          <button type="button" onClick={() => setBuscaAberta((v) => !v)} aria-label="Procurar no cardápio" aria-expanded={buscaAberta} aria-controls="busca-celular" className="grid h-12 w-12 shrink-0 place-items-center text-laranja md:hidden">
            <IconSearch />
          </button>
        </div>
        {buscaAberta && (
          <label id="busca-celular" className="-mt-2 flex min-h-14 items-center gap-3 rounded-[2px] border-[1.5px] border-creme/35 bg-lapide pr-1.5 pl-4 focus-within:border-laranja md:hidden">
            <span className="sr-only">Procurar no cardápio</span>
            <input
              ref={buscaMob}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar lanche, ingrediente..."
              autoComplete="off"
              aria-controls="cardapio-grade"
              className="h-12 min-w-0 flex-1 border-0 bg-transparent text-[17px] text-creme outline-none placeholder:text-creme-2"
            />
            <button
              type="button"
              aria-label="Fechar busca"
              onClick={() => {
                setBuscaAberta(false)
                setQ('')
              }}
              className="grid h-11 w-11 place-items-center text-creme-2"
            >
              <IconClose size={16} />
            </button>
          </label>
        )}

        <p aria-live="polite" className="t-kicker m-0 text-[11px] text-creme-2">
          {resumo(cat, TITULOS, q, itens.length, modeloDe(cat) === 'lapide' ? undefined : modeloDe(cat) === 'lista' ? 'TOQUE NO + PARA ADICIONAR' : 'TOQUE NA FOTO PARA VER OS DETALHES')}
        </p>

        <div ref={grade} id="cardapio-grade" className="cardapio-grade">
          {itens.length > 0 ? (
            <div className="flex flex-col gap-12">
              {pratosVis.length > 0 && (
                <ul className="grade-pratos m-0 list-none p-0" aria-label={buscando ? 'Lanches e pratos encontrados' : undefined}>
                  {pratosVis.map((l, i) => (
                    <li key={`${l.categoryId}:${l.item.id}`} className="min-w-0">
                      <Prato item={l.item} className={`sobe-${anim}`} style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }} />
                    </li>
                  ))}
                </ul>
              )}
              {listaVis.length > 0 && (
                <ul className="lista-bebidas m-0 list-none p-0" aria-label={buscando ? 'Bebidas encontradas' : undefined}>
                  {listaVis.map((l) => (
                    <li key={`${l.categoryId}:${l.item.id}`} className="min-w-0">
                      <LinhaBebida item={l.item} />
                    </li>
                  ))}
                </ul>
              )}
              {!buscando && <Extras categoria={cat} />}
              {lapidesVis.length > 0 && (
                <ul className="grade-lapides m-0 list-none p-0" aria-label={buscando ? 'Lanches e entradas encontrados' : undefined}>
                  {lapidesVis.map((l, i) => (
                    <li key={`${l.categoryId}:${l.item.id}`} className="min-w-0">
                      <Tombstone
                        item={l.item}
                        categoryId={l.categoryId}
                        variant={CATEGORIA_MODELO[l.categoryId]?.destaque ? 0 : ((i % 3) as 0 | 1 | 2)}
                        virada={viradas.has(l.item.id)}
                        onVirar={() => virar(l.item.id)}
                        className={`sobe-${anim} ${CATEGORIA_MODELO[l.categoryId]?.destaque ? 'is-destaque' : ''}`}
                        style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {retratosVis.length > 0 && (
                <ul
                  className={`grade-retratos m-0 list-none p-0 ${!buscando && CATEGORIA_MODELO[cat]?.destaque ? 'is-destaque' : ''} ${!buscando && retratosVis.length === 1 ? 'is-unico' : ''}`}
                  aria-label={buscando ? 'Pratos e bebidas encontrados' : undefined}
                >
                  {retratosVis.map((l, i) => (
                    <li key={`${l.categoryId}:${l.item.id}`} className="min-w-0">
                      <Retrato item={l.item} quadrada={CATEGORIA_MODELO[l.categoryId]?.quadrada} className={`h-full sobe-${anim}`} style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-7 py-6">
              <Gravura name="mao-zumbi" className="w-[120px]" />
              <div className="flex max-w-[420px] flex-col gap-2.5">
                <p className="t-display m-0 text-[40px] leading-none">Nada enterrado com esse nome.</p>
                <button type="button" onClick={limpar} className="t-kicker min-h-11 self-start text-laranja underline underline-offset-[6px]">
                  VOLTAR AO CARDÁPIO →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
