import express from 'express'
import { z } from 'zod'
import { CAN, ROLE_LABEL } from '../domain/permissions.js'
import { adminAuth, loginRateLimit, requireCan, requireCsrf } from '../middlewares/adminAuth.js'
import { validateBody } from '../middlewares/validate.js'
import { clearSessionCookie, sessionCookie } from '../utils/cookies.js'
import { AppError } from '../utils/errors.js'
import {
  eventExtractSchema,
  eventSchema,
  hoursSchema,
  idParam,
  loginSchema,
  passwordChangeSchema,
  productPatchSchema,
  settingsPatchSchema,
  statusChangeSchema,
  userCreateSchema,
  userPatchSchema,
  zoneSchema,
} from '../validators/admin.js'

const INVALID = 'Alguns dados estão inválidos.'
const body = (schema) => validateBody(schema, INVALID)
const id = (req) => {
  const r = idParam.safeParse(req.params.id)
  if (!r.success) throw new AppError(404, 'NOT_FOUND', 'Não encontrado.')
  return r.data
}
const resetPasswordSchema = z.object({ password: z.string().max(200) }).strict()

/** O que o painel precisa saber da pessoa logada (inclui as permissões, para esconder botões). */
const me = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  roleLabel: ROLE_LABEL[user.role],
  can: Object.fromEntries(Object.entries(CAN).map(([k, roles]) => [k, roles.includes(user.role)])),
})

/**
 * /api/v1/admin — painel da equipe.
 * Sem sessão: só POST /login. Com sessão: GET livre; escrita exige X-CSRF-Token.
 * Respostas nunca vão para cache.
 */
export function createAdminRouter({ env, auth, admin, audit, clock, events }) {
  const r = express.Router()
  const secure = env.NODE_ENV === 'production'
  const ctx = (req) => ({ ip: req.ip })
  r.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  r.post('/login', loginRateLimit({ max: env.LOGIN_RATE_LIMIT, clock }), body(loginSchema), async (req, res) => {
    const s = await auth.login(req.valid.email, req.valid.password, ctx(req))
    res.set('Set-Cookie', sessionCookie(s.sessionToken, { maxAgeSeconds: s.maxAgeSeconds, secure }))
    res.json({ user: me(s.user), csrfToken: s.csrfToken })
  })

  r.use(adminAuth(auth))
  r.use(requireCsrf(auth))

  // ── sessão
  r.get('/me', async (req, res) => {
    // ao recarregar a página o painel perde o token anti-CSRF (fica só na memória): gera outro
    const csrfToken = await auth.refreshCsrf(req.admin.session)
    res.json({ user: me(req.admin.user), csrfToken })
  })
  r.post('/logout', async (req, res) => {
    await auth.logout(req.admin.session, ctx(req))
    res.set('Set-Cookie', clearSessionCookie({ secure })).status(204).end()
  })
  r.post('/password', body(passwordChangeSchema), async (req, res) => {
    await auth.changePassword(req.admin.user.id, req.valid.current, req.valid.next, ctx(req))
    res.set('Set-Cookie', clearSessionCookie({ secure })).status(204).end()
  })

  // ── pedidos
  r.get('/orders', requireCan('viewOrders'), async (req, res) => {
    const scope = req.query.scope === 'recent' ? 'recent' : 'active'
    res.json({ orders: await admin.listOrders({ scope }, req.admin.user), serverTime: clock() })
  })
  r.get('/orders/:id', requireCan('viewOrders'), async (req, res) => res.json({ order: await admin.getOrder(id(req), req.admin.user) }))
  r.post('/orders/:id/status', requireCan('viewOrders'), body(statusChangeSchema), async (req, res) =>
    res.json({ order: await admin.changeStatus(id(req), req.valid, req.admin.user, ctx(req)) }),
  )

  // ── cardápio
  r.get('/catalog', async (_req, res) => res.json({ categories: await admin.listCatalog() }))
  r.patch('/products/:id', body(productPatchSchema), async (req, res) => res.json({ product: await admin.patchProduct(id(req), req.valid, req.admin.user, ctx(req)) }))

  // ── loja
  r.get('/store', async (_req, res) => res.json(await admin.getStore()))
  r.patch('/store/settings', body(settingsPatchSchema), async (req, res) => res.json(await admin.patchSettings(req.valid, req.admin.user, ctx(req))))
  r.put('/store/hours', requireCan('editStoreSettings'), body(hoursSchema), async (req, res) => res.json(await admin.replaceHours(req.valid.hours, req.admin.user, ctx(req))))

  // ── zonas de entrega
  r.get('/zones', requireCan('manageZones'), async (_req, res) => res.json({ zones: await admin.listZones() }))
  r.post('/zones', requireCan('manageZones'), body(zoneSchema), async (req, res) => res.status(201).json({ zone: await admin.createZone(req.valid, req.admin.user, ctx(req)) }))
  r.put('/zones/:id', requireCan('manageZones'), body(zoneSchema), async (req, res) => res.json({ zone: await admin.updateZone(id(req), req.valid, req.admin.user, ctx(req)) }))
  r.delete('/zones/:id', requireCan('manageZones'), async (req, res) => {
    await admin.deleteZone(id(req), req.admin.user, ctx(req))
    res.status(204).end()
  })

  // ── equipe
  r.get('/users', requireCan('manageUsers'), async (_req, res) => res.json({ users: await admin.listUsers() }))
  r.post('/users', requireCan('manageUsers'), body(userCreateSchema), async (req, res) =>
    res.status(201).json({ user: await auth.createUser(req.valid, { actorId: req.admin.user.id, ip: req.ip }) }),
  )
  r.patch('/users/:id', requireCan('manageUsers'), body(userPatchSchema), async (req, res) => res.json({ user: await admin.updateUser(id(req), req.valid, req.admin.user, ctx(req)) }))
  r.post('/users/:id/password', requireCan('manageUsers'), body(resetPasswordSchema), async (req, res) => {
    await admin.resetUserPassword(id(req), req.valid.password, req.admin.user, ctx(req))
    res.status(204).end()
  })

  // ── eventos (Agenda do site)
  r.get('/events', requireCan('manageEvents'), async (_req, res) => res.json({ events: await events.listAdmin(), aiReady: events.aiReady }))
  r.post('/events', requireCan('manageEvents'), body(eventSchema), async (req, res) => res.status(201).json({ event: await events.create(req.valid, req.admin.user, ctx(req)) }))
  r.put('/events/:id', requireCan('manageEvents'), body(eventSchema), async (req, res) => res.json({ event: await events.update(id(req), req.valid, req.admin.user, ctx(req)) }))
  r.delete('/events/:id', requireCan('manageEvents'), async (req, res) => {
    await events.remove(id(req), req.admin.user, ctx(req))
    res.status(204).end()
  })
  r.get('/events/:id/image', requireCan('manageEvents'), async (req, res) => {
    const img = await events.adminImage(id(req))
    res.set({ 'Content-Type': img.mime, 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' }).send(img.data)
  })
  r.post('/events/extract', requireCan('manageEvents'), body(eventExtractSchema), async (req, res) => res.json({ draft: await events.extract(req.valid) }))

  // ── registro
  r.get('/audit', requireCan('viewAudit'), async (req, res) => {
    const limit = Math.max(1, Math.min(300, Number(req.query.limit) || 100))
    res.json({ entries: await audit.latest({ limit }) })
  })

  return r
}
