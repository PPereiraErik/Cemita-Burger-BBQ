import { z } from 'zod'

/** Texto livre do cliente: sem caracteres de controle, normalizado, aparado. */
export const cleanText = (max, min = 0) =>
  z
    .string()
    .transform((s) => s.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(min).max(max))

export const digitsOnly = (s) => String(s).replace(/\D/g, '')

/**
 * Telefone brasileiro com DDD: 10 dígitos (fixo) ou 11 (celular, começando com 9).
 * Aceita +55 na frente. Devolve { normalized: '47996838894', display: '(47) 99683-8894' }.
 */
export const brPhone = z
  .string()
  .max(25)
  .transform(digitsOnly)
  .transform((d) => (d.length >= 12 && d.startsWith('55') ? d.slice(2) : d))
  .refine((d) => /^[1-9][1-9]\d{8}$/.test(d) || /^[1-9][1-9]9\d{8}$/.test(d), 'telefone com DDD inválido')
  .transform((d) => ({
    normalized: d,
    display: d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`,
  }))

export const cep = z
  .string()
  .max(9)
  .transform(digitsOnly)
  .refine((d) => /^\d{8}$/.test(d), 'CEP precisa ter 8 dígitos')

export const idempotencyKey = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, 'Idempotency-Key precisa ter de 16 a 64 caracteres (letras, números, - ou _)')
export const publicCode = z.string().regex(/^CEM-[2-9A-HJ-NP-Z]{6}$/)
