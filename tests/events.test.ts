/** Agenda do site (src/lib/eventsCore.ts). */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { eventDateParts, reservaTexto } from '../src/lib/eventsCore.ts'

describe('agenda do site', () => {
  it('data do cartaz: dia, mês, dia da semana e hora', () => {
    assert.deepEqual(eventDateParts('2026-10-31', '20:00'), { day: '31', month: 'out', weekday: 'sábado', hour: '20h' })
    assert.deepEqual(eventDateParts('2026-11-07', '21:30'), { day: '07', month: 'nov', weekday: 'sábado', hour: '21h30' })
  })
  it('mensagem de reserva com o nome e a data do evento', () => {
    assert.equal(reservaTexto({ title: 'Halloween no Cemita', date: '2026-10-31' }), 'Olá! Quero reservar uma mesa para o evento "Halloween no Cemita" (31/10).')
  })
})
