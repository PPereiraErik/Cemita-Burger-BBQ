/** Regras puras da Agenda (sem React, sem rede). Testadas em tests/events.test.ts. */
import type { ApiEvent } from './api'

const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** Partes da data para o cartão: { day: '31', month: 'out', weekday: 'sábado', hour: '20h' }. Pura. */
export function eventDateParts(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':')
  return {
    day: String(d).padStart(2, '0'),
    month: MES[m - 1],
    weekday: WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
    hour: `${Number(hh)}h${mm === '00' ? '' : mm}`,
  }
}

/** Mensagem pronta para reservar pelo WhatsApp. */
export const reservaTexto = (e: Pick<ApiEvent, 'title' | 'date'>) => {
  const [, m, d] = e.date.split('-')
  return `Olá! Quero reservar uma mesa para o evento "${e.title}" (${d}/${m}).`
}
