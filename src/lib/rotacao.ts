/**
 * POLAROIDS QUE TROCAM SOZINHAS — uma por vez, como um "dump" do Instagram.
 * Estado: qual foto (índice no acervo) está em cada moldura e qual moldura troca na próxima vez.
 * Nunca mostra a mesma foto em duas molduras ao mesmo tempo. Testado em tests/rotacao.test.ts.
 */
export type Rotacao = { slots: number[]; next: number; cursor: number }

export function inicio(slots: number, total: number): Rotacao {
  const n = Math.min(slots, total)
  return { slots: Array.from({ length: n }, (_, i) => i), next: 0, cursor: n - 1 }
}

export function avancar(r: Rotacao, total: number): Rotacao {
  if (total <= r.slots.length) return r // não há foto de reserva: nada troca
  let cursor = r.cursor
  do cursor = (cursor + 1) % total
  while (r.slots.includes(cursor))
  const slots = r.slots.slice()
  slots[r.next] = cursor
  return { slots, next: (r.next + 1) % slots.length, cursor }
}
