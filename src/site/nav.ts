import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { EM_DOBRO } from '../config/promocoes'
import { useEvents } from '../lib/events'

/** Seções da página única, na ordem. */
export const SECOES = [
  { id: 'inicio', label: 'Início' },
  { id: 'cardapio', label: 'Cardápio' },
  ...(EM_DOBRO.active ? [{ id: 'dobro', label: 'Joinville em Dobro' }] : []),
  { id: 'historia', label: 'A História' },
  { id: 'fotos', label: 'Quem já veio' },
]

/** Seções com a Agenda logo depois do cardápio, quando há evento publicado. */
export function useSecoes() {
  const temEvento = useEvents().length > 0
  return useMemo(() => (temEvento ? SECOES.flatMap((s) => (s.id === 'cardapio' ? [s, { id: 'agenda', label: 'Agenda' }] : [s])) : SECOES), [temEvento])
}

/** Qual seção está no meio da tela (para marcar o link). */
export function useSecaoAtiva() {
  const [ativa, setAtiva] = useState('inicio')
  const secoes = useSecoes()
  useEffect(() => {
    const els = secoes.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (vis) setAtiva(vis.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.01] },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [secoes])
  return ativa
}

/* barra lateral aberta/fechada: lembrada neste navegador (só conveniência) */
const KEY = 'cemita:menu-lateral'
let aberta = (() => {
  try {
    return localStorage.getItem(KEY) !== 'fechada'
  } catch {
    return true
  }
})()
const subs = new Set<() => void>()
export function alternarLateral() {
  aberta = !aberta
  try {
    localStorage.setItem(KEY, aberta ? 'aberta' : 'fechada')
  } catch {
    /* ok */
  }
  subs.forEach((f) => f())
}
export const useLateralAberta = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => aberta,
    () => true,
  )
