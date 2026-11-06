/**
 * Dinheiro sempre em CENTAVOS inteiros. Nada de float em conta de pedido.
 */
export function assertCents(value, label = 'valor') {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} precisa ser centavos inteiros >= 0 (recebido: ${value})`)
  return value
}

/** Reais (número com até 2 casas) → centavos, sem erro de arredondamento binário. */
export function reaisToCents(reais) {
  if (typeof reais !== 'number' || !Number.isFinite(reais) || reais < 0) throw new RangeError(`preço inválido: ${reais}`)
  const cents = Math.round(Number(reais.toFixed(2)) * 100)
  return assertCents(cents)
}

export function sumCents(values) {
  return values.reduce((t, v) => assertCents(t + assertCents(v), 'soma'), 0)
}

export function multiplyCents(cents, qty) {
  if (!Number.isSafeInteger(qty) || qty < 0) throw new RangeError(`quantidade inválida: ${qty}`)
  return assertCents(assertCents(cents) * qty)
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const formatCents = (cents) => brl.format(assertCents(cents) / 100)
