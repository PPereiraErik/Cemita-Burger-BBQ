import { useSyncExternalStore } from 'react'
import { api, apiEnabled, type ApiEvent } from './api'

/**
 * AGENDA — eventos publicados no painel (vêm da API). Sem API, ou sem eventos, a seção e o item
 * do menu simplesmente não aparecem (nada de evento de exemplo no site).
 * Busca uma vez ao abrir a página e de novo a cada 5 minutos com a aba visível.
 */
let events: ApiEvent[] = []
let started = false
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

async function load() {
  try {
    const r = await api.events()
    events = r.events
    emit()
  } catch {
    /* sem API agora: mantém o que já tinha */
  }
}

function start() {
  if (started || !apiEnabled || typeof window === 'undefined') return
  started = true
  void load()
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void load()
  }, 5 * 60_000)
}

export function useEvents(): ApiEvent[] {
  return useSyncExternalStore(
    (f) => {
      start()
      subs.add(f)
      return () => subs.delete(f)
    },
    () => events,
    () => events,
  )
}

export { eventDateParts, reservaTexto } from './eventsCore'
