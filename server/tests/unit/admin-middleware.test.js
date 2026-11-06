import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { adminAuth, loginRateLimit, requireCan, requireCsrf } from '../../src/middlewares/adminAuth.js'
import { sameHash, sha256 } from '../../src/utils/ids.js'

const req = (over = {}) => ({ method: 'GET', ip: '1.2.3.4', headers: {}, get(h) { return this.headers[h.toLowerCase()] }, ...over })
const res = () => ({ headers: {}, set(k, v) { this.headers[k] = v; return this } })
const run = async (mw, r = req(), s = res()) => {
  let out = 'not-called'
  await mw(r, s, (err) => (out = err ?? null))
  return out
}
const fakeAuth = { csrfOk: (hash, header) => !!header && sameHash(hash, sha256(header)), authenticate: async (t) => (t === 'bom' ? { user: { role: 'staff' }, csrfHash: sha256('csrf') } : null) }

describe('middlewares do painel', () => {
  it('sem cookie ou com sessão inválida: 401', async () => {
    assert.equal((await run(adminAuth(fakeAuth))).status, 401)
    assert.equal((await run(adminAuth(fakeAuth), req({ headers: { cookie: 'cemita_sess=ruim' } }))).code, 'UNAUTHENTICATED')
  })
  it('sessão válida segue com req.admin', async () => {
    const r = req({ headers: { cookie: 'cemita_sess=bom' } })
    assert.equal(await run(adminAuth(fakeAuth), r), null)
    assert.equal(r.admin.user.role, 'staff')
  })
  it('CSRF: GET passa; escrita sem token ou com token errado = 403', async () => {
    const admin = { csrfHash: sha256('csrf') }
    assert.equal(await run(requireCsrf(fakeAuth), req({ admin })), null)
    assert.equal((await run(requireCsrf(fakeAuth), req({ method: 'POST', admin }))).code, 'CSRF_INVALID')
    assert.equal((await run(requireCsrf(fakeAuth), req({ method: 'PATCH', admin, headers: { 'x-csrf-token': 'outro' } }))).code, 'CSRF_INVALID')
    assert.equal(await run(requireCsrf(fakeAuth), req({ method: 'DELETE', admin, headers: { 'x-csrf-token': 'csrf' } })), null)
  })
  it('permissão: 403 para quem não pode', async () => {
    const r = req({ admin: { user: { role: 'kitchen' } } })
    assert.equal((await run(requireCan('manageUsers'), r)).status, 403)
    assert.equal(await run(requireCan('viewOrders'), r), null)
  })
  it('limite de login por IP: a 4ª tentativa na janela é recusada; outro IP não', async () => {
    let now = new Date('2026-10-19T12:00:00Z')
    const mw = loginRateLimit({ max: 3, windowMs: 60_000, clock: () => now })
    for (let i = 0; i < 3; i++) assert.equal(await run(mw), null)
    const s = res()
    const err = await run(mw, req(), s)
    assert.equal(err.code, 'TOO_MANY_ATTEMPTS')
    assert.equal(s.headers['Retry-After'], '60')
    assert.equal(await run(mw, req({ ip: '9.9.9.9' })), null)
    now = new Date(now.getTime() + 61_000)
    assert.equal(await run(mw), null)
  })
})
