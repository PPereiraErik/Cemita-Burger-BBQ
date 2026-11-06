import { z } from 'zod'
import { ORDER_STATUSES, PAYMENT_METHOD, ROLES } from '../domain/constants.js'
import { isInstagramUrl } from '../domain/events.js'
import { cep, cleanText } from './common.js'

/** Entradas do painel. Tudo .strict(): campo desconhecido é recusado, não ignorado. */

export const loginSchema = z.object({ email: z.string().max(160), password: z.string().max(200) }).strict()

export const passwordChangeSchema = z.object({ current: z.string().max(200), next: z.string().max(200) }).strict()

export const statusChangeSchema = z
  .object({
    to: z.enum(ORDER_STATUSES),
    version: z.number().int().min(0),
    reason: cleanText(200).optional(),
  })
  .strict()

const cents = z.number().int().min(0).max(1_000_000)

export const productPatchSchema = z
  .object({
    available: z.boolean(),
    active: z.boolean(),
    orderable: z.boolean(),
    priceCents: cents,
    name: cleanText(120, 1),
    description: cleanText(600).nullable(),
  })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'nada para alterar')

/** Campos que o atendimento (staff) pode mudar num produto. */
export const STAFF_PRODUCT_FIELDS = new Set(['available'])

/**
 * Configurações editáveis pelo painel, uma regra por chave.
 * null = "ainda não definido" (volta ao estado pendente; nada é inventado).
 * Pix e cartão no site (Etapa 6) podem ser ligados; o site só os oferece quando o gateway está configurado.
 */
const METHODS = [PAYMENT_METHOD.CASH_ON_DELIVERY, PAYMENT_METHOD.CARD_ON_DELIVERY, PAYMENT_METHOD.PIX, PAYMENT_METHOD.CARD_ONLINE]
export const SETTING_RULES = {
  orders_paused: z.boolean(),
  ordering_mode: z.enum(['vuca', 'native', 'both']),
  pickup_eta_minutes: z.number().int().min(1).max(240).nullable(),
  min_order_cents: cents.nullable(),
  payment_methods_enabled: z
    .array(z.enum(METHODS, { message: 'forma de pagamento desconhecida' }))
    .max(METHODS.length)
    .transform((a) => [...new Set(a)]),
  data_retention_days: z.number().int().min(1).max(3650).nullable(),
}
/** Chaves que o atendimento (staff) pode mudar. O resto é só administração. */
export const STAFF_SETTING_KEYS = new Set(['orders_paused'])

export const settingsPatchSchema = z
  .object(SETTING_RULES)
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'nada para alterar')

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM')
export const hoursSchema = z
  .object({
    hours: z
      .array(z.object({ weekday: z.number().int().min(0).max(6), opensAt: hhmm, closesAt: hhmm }).strict())
      .max(21)
      .refine((a) => a.every((h) => h.opensAt !== h.closesAt), 'abertura e fechamento iguais'),
  })
  .strict()

const neighborhood = cleanText(80, 2)
export const zoneSchema = z
  .object({
    name: cleanText(80, 2),
    matchType: z.enum(['neighborhood', 'cep_range']),
    neighborhoods: z.array(neighborhood).max(80).nullish(),
    cepStart: cep.nullish(),
    cepEnd: cep.nullish(),
    feeCents: cents,
    minOrderCents: cents.default(0),
    etaMinMinutes: z.number().int().min(1).max(300),
    etaMaxMinutes: z.number().int().min(1).max(300),
    active: z.boolean().default(true),
    position: z.number().int().min(0).max(999).default(0),
  })
  .strict()
  .superRefine((z0, ctx) => {
    if (z0.matchType === 'neighborhood' && !z0.neighborhoods?.length) ctx.addIssue({ code: 'custom', path: ['neighborhoods'], message: 'informe ao menos um bairro' })
    if (z0.matchType === 'cep_range' && !(z0.cepStart && z0.cepEnd && z0.cepStart <= z0.cepEnd)) ctx.addIssue({ code: 'custom', path: ['cepEnd'], message: 'faixa de CEP inválida' })
    if (z0.etaMinMinutes > z0.etaMaxMinutes) ctx.addIssue({ code: 'custom', path: ['etaMaxMinutes'], message: 'prazo máximo menor que o mínimo' })
  })

export const userCreateSchema = z
  .object({ name: cleanText(80, 2), email: z.string().trim().toLowerCase().email().max(160), role: z.enum(ROLES), password: z.string().max(200) })
  .strict()

export const userPatchSchema = z
  .object({ name: cleanText(80, 2), role: z.enum(ROLES), active: z.boolean() })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'nada para alterar')

export const idParam = z.coerce.number().int().min(1).max(2 ** 31)

// ───────────────────────── eventos (Agenda) ─────────────────────────
const optText = (max) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null))
const hhmmEvent = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM')
/** Imagem: data URL (enviar nova), null (tirar a imagem) ou ausente (manter). */
const imageField = z.string().max(2_100_000).nullable().optional()

export const eventSchema = z
  .object({
    title: z.string().trim().min(2, 'nome curto demais').max(120),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD'),
    time: hhmmEvent,
    endTime: hhmmEvent.nullable().optional(),
    summary: optText(300),
    description: optText(1000),
    highlights: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
    reservation: optText(200),
    instagramUrl: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || isInstagramUrl(v), 'cole o link de um post do Instagram (https://www.instagram.com/p/...)'),
    status: z.enum(['draft', 'published']),
    image: imageField,
  })
  .strict()

export const eventExtractSchema = z
  .object({
    caption: z.string().max(4000).optional().default(''),
    image: z.string().max(2_100_000).optional(),
  })
  .strict()
  .refine((v) => v.caption.trim() || v.image, 'mande a imagem do post, a legenda, ou as duas')
