import { z } from 'zod'
import { FULFILLMENTS, LIMITS, PAYMENT_METHODS } from '../domain/constants.js'
import { brPhone, cep, cleanText } from './common.js'

/**
 * Schemas ESTRITOS: campo desconhecido = requisição recusada.
 * Não existe campo de preço: o cliente manda só IDs, quantidades e escolhas.
 */
const cartLine = z
  .object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(LIMITS.MAX_QTY_PER_LINE),
    optionIds: z.array(z.number().int().positive()).max(10).default([]),
    note: cleanText(LIMITS.NOTE_MAX).optional(),
  })
  .strict()

const address = z
  .object({
    cep,
    street: cleanText(120, 2),
    number: cleanText(12, 1),
    complement: cleanText(60).optional(),
    neighborhood: cleanText(80, 2),
    reference: cleanText(120).optional(),
  })
  .strict()

const base = {
  lines: z.array(cartLine).min(1, 'a comanda está vazia').max(LIMITS.MAX_LINES_PER_ORDER),
  fulfillment: z.enum(FULFILLMENTS),
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,30}$/)
    .optional(),
}

/** POST /cart/quote — o endereço pode vir incompleto (só CEP ou bairro) para calcular a taxa. */
export const quoteSchema = z.object({ ...base, address: address.partial().strict().optional() }).strict()

/** POST /orders */
export const orderSchema = z
  .object({
    ...base,
    address: address.optional(),
    customer: z.object({ name: cleanText(80, 2), phone: brPhone }).strict(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    changeForCents: z.number().int().positive().max(100_000_00).optional(),
    notes: cleanText(LIMITS.NOTE_MAX).optional(),
    privacyPolicyVersionId: z.number().int().positive(),
    adultConfirmed: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.fulfillment === 'delivery' && !v.address) ctx.addIssue({ code: 'custom', path: ['address'], message: 'endereço obrigatório para entrega' })
    if (v.fulfillment === 'pickup' && v.address) ctx.addIssue({ code: 'custom', path: ['address'], message: 'retirada não leva endereço' })
  })
