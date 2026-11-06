import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ' // sem 0/O, 1/I/L: fácil de ditar no balcão

/** Código público do pedido (ex.: CEM-4F7K2Q). Aleatório: não revela quantos pedidos existem. */
export function newPublicCode() {
  let s = ''
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return `CEM-${s}`
}

export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex')

/**
 * Token de acompanhamento: HMAC(código + chave de idempotência). Só quem criou o pedido o recebe.
 * Guardamos apenas o hash; um reenvio idêntico (mesma chave) recalcula o mesmo token.
 */
export const trackingToken = (secret, publicCode, idempotencyKey) => createHmac('sha256', secret).update(`${publicCode}:${idempotencyKey}`).digest('base64url')

export function sameHash(a, b) {
  const x = Buffer.from(String(a), 'hex')
  const y = Buffer.from(String(b), 'hex')
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

/** JSON com chaves ordenadas: o mesmo pedido gera sempre o mesmo hash. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`
  return JSON.stringify(value)
}
