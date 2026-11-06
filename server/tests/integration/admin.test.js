import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { seedDevData } from '../../src/db/seeders/dev.js'
import { seedDatabase } from '../../src/db/seeders/index.js'
import { initModels } from '../../src/models/index.js'
import { createAuditService } from '../../src/services/audit.service.js'
import { createAuthService } from '../../src/services/auth.service.js'
import { sha256 } from '../../src/utils/ids.js'
import { freshDatabase } from '../helpers/db.js'
import { newKey, startApi } from '../helpers/http.js'

/**
 * Painel da equipe de ponta a ponta contra MySQL de teste.
 * Contas criadas aqui são de TESTE (nenhuma conta padrão existe no sistema).
 */
const OPEN = new Date('2026-10-07T23:00:00Z')
const PW = {
  admin: 'fumaca de lenha no domingo',
  staff: 'balcao com fila boa de sabado',
  kitchen: 'chapa quente e pao tostado',
}

let db, api, ids, policyId, models

const one = async (sql, replacements = []) => (await db.sequelize.query(sql, { replacements }))[0][0]
const setting = (key, value) => db.sequelize.query('UPDATE store_settings SET value = ? WHERE `key` = ?', { replacements: [JSON.stringify(value), key] })

/** Cliente do painel: guarda o cookie e o token anti-CSRF como o navegador + painel fariam. */
function client() {
  const c = { cookie: '', csrf: '' }
  const headers = (extra = {}) => ({ ...(c.cookie ? { cookie: c.cookie } : {}), ...(c.csrf ? { 'x-csrf-token': c.csrf } : {}), ...extra })
  c.call = async (method, path, body, { csrf = true } = {}) => {
    const h = headers()
    if (!csrf) delete h['x-csrf-token']
    const r = await api.request(method, '/admin' + path, { body, headers: h })
    const set = r.headers.getSetCookie?.() ?? []
    for (const s of set) {
      const [pair] = s.split(';')
      c.cookie = pair.endsWith('=') ? '' : pair
    }
    if (r.body?.csrfToken) c.csrf = r.body.csrfToken
    return r
  }
  c.login = (email, password) => c.call('POST', '/login', { email, password })
  return c
}

async function placeOrder(over = {}) {
  const body = {
    lines: [{ productId: ids['smash-bacon'], quantity: 1 }],
    fulfillment: 'delivery',
    address: { cep: '89203001', street: 'Rua de Teste', number: '1', neighborhood: 'Bairro de Teste' },
    customer: { name: 'Cliente Teste Sobrenome', phone: '(47) 99999-0000' },
    paymentMethod: 'cash_on_delivery',
    privacyPolicyVersionId: policyId,
    ...over,
  }
  const r = await api.post('/orders', body, { headers: { 'idempotency-key': newKey() } })
  assert.equal(r.status, 201, JSON.stringify(r.body))
  return (await one('SELECT id, version FROM orders WHERE public_code = ?', [r.body.order.code])).id
}

let A, S, K // clientes logados: administração, atendimento, cozinha

before(async () => {
  db = await freshDatabase()
  await db.migrator.up()
  await seedDatabase(db.sequelize)
  await seedDevData(db.sequelize, { nodeEnv: 'test' })
  const [rows] = await db.sequelize.query('SELECT id, slug FROM products')
  ids = Object.fromEntries(rows.map((r) => [r.slug, r.id]))
  policyId = (await one("SELECT id FROM privacy_policy_versions WHERE version = 'DEV-0'")).id

  models = initModels(db.sequelize)
  const audit = createAuditService({ models, env: db.env })
  const auth = createAuthService({ models, env: db.env, clock: () => new Date(), audit })
  await auth.createUser({ name: 'Admin Teste', email: 'admin@teste.local', role: 'admin', password: PW.admin })
  await auth.createUser({ name: 'Atendimento Teste', email: 'staff@teste.local', role: 'staff', password: PW.staff })
  await auth.createUser({ name: 'Cozinha Teste', email: 'kitchen@teste.local', role: 'kitchen', password: PW.kitchen })

  api = await startApi({ env: { ...db.env, LOGIN_RATE_LIMIT: 1000 }, sequelize: db.sequelize, now: OPEN })
  A = client()
  S = client()
  K = client()
  assert.equal((await A.login('admin@teste.local', PW.admin)).status, 200)
  assert.equal((await S.login('staff@teste.local', PW.staff)).status, 200)
  assert.equal((await K.login('kitchen@teste.local', PW.kitchen)).status, 200)
})
after(async () => {
  await api?.close()
  await db?.sequelize.close()
})
beforeEach(async () => {
  api.clock.current = OPEN
  await setting('ordering_mode', 'both')
  await setting('orders_paused', false)
})

describe('login e sessão', () => {
  it('sem sessão: 401 em tudo, menos no login', async () => {
    const c = client()
    for (const p of ['/me', '/orders', '/catalog', '/store', '/users', '/audit']) assert.equal((await c.call('GET', p)).status, 401, p)
  })
  it('e-mail inexistente e senha errada dão a MESMA resposta', async () => {
    const a = await client().login('ninguem@teste.local', 'qualquer senha longa')
    const b = await client().login('staff@teste.local', 'senha errada mas longa')
    assert.equal(a.status, 401)
    assert.equal(b.status, 401)
    assert.deepEqual([a.body.error.code, a.body.error.message], [b.body.error.code, b.body.error.message])
    await db.sequelize.query("UPDATE users SET failed_logins = 0 WHERE email = 'staff@teste.local'")
  })
  it('cookie HttpOnly, SameSite=Strict, só no caminho do painel; token só como hash no banco', async () => {
    const c = client()
    const r = await c.login('admin@teste.local', PW.admin)
    const cookie = r.headers.getSetCookie()[0]
    for (const part of ['HttpOnly', 'SameSite=Strict', 'Path=/api/v1/admin']) assert.ok(cookie.includes(part), part)
    const token = decodeURIComponent(c.cookie.split('=')[1])
    assert.equal((await one('SELECT COUNT(*) AS n FROM sessions WHERE sid = ?', [token])).n, 0)
    assert.equal((await one('SELECT COUNT(*) AS n FROM sessions WHERE sid = ?', [sha256(token)])).n, 1)
    assert.equal(r.body.user.role, 'admin')
    assert.equal(r.body.user.can.manageUsers, true)
    assert.equal(JSON.stringify(r.body).includes('password'), false)
  })
  it('escrita sem o token anti-CSRF é recusada', async () => {
    const r = await S.call('PATCH', '/store/settings', { orders_paused: true }, { csrf: false })
    assert.equal(r.status, 403)
    assert.equal(r.body.error.code, 'CSRF_INVALID')
    assert.equal((await one("SELECT value FROM store_settings WHERE `key` = 'orders_paused'")).value, false)
  })
  it('/me renova o token anti-CSRF (o antigo deixa de valer)', async () => {
    const c = client()
    await c.login('staff@teste.local', PW.staff)
    const old = c.csrf
    const me = await c.call('GET', '/me')
    assert.equal(me.status, 200)
    assert.notEqual(c.csrf, old)
    c.csrf = old
    assert.equal((await c.call('PATCH', '/store/settings', { orders_paused: false })).body.error.code, 'CSRF_INVALID')
  })
  it('5 senhas erradas travam a conta por 15 minutos, mesmo com a senha certa', async () => {
    const auth = createAuthService({ models, env: db.env, clock: () => new Date(), audit: createAuditService({ models, env: db.env }) })
    await auth.createUser({ name: 'Trava Teste', email: 'trava@teste.local', role: 'staff', password: 'uma senha so para travar' })
    for (let i = 0; i < 4; i++) assert.equal((await client().login('trava@teste.local', 'errada errada errada')).status, 401)
    const fifth = await client().login('trava@teste.local', 'errada errada errada')
    assert.equal(fifth.status, 429)
    assert.equal(fifth.body.error.code, 'ACCOUNT_LOCKED')
    assert.equal((await client().login('trava@teste.local', 'uma senha so para travar')).status, 429)
    // passa o tempo da trava (o relógio do servidor é o do teste)
    api.clock.current = new Date(OPEN.getTime() + 16 * 60_000)
    assert.equal((await client().login('trava@teste.local', 'uma senha so para travar')).status, 200)
    const actions = (await db.sequelize.query("SELECT action FROM audit_logs a JOIN users u ON u.id = a.user_id WHERE u.email = 'trava@teste.local' ORDER BY a.id"))[0].map((r) => r.action)
    assert.deepEqual(actions.slice(-7), ['login.fail', 'login.fail', 'login.fail', 'login.fail', 'login.lock', 'login.locked', 'login.ok'])
  })
  it('limite por aparelho (IP) no login', async () => {
    const limited = await startApi({ env: { ...db.env, LOGIN_RATE_LIMIT: 2 }, sequelize: db.sequelize, now: OPEN })
    try {
      const go = () => limited.post('/admin/login', { email: 'ninguem@teste.local', password: 'x' })
      assert.equal((await go()).status, 401)
      assert.equal((await go()).status, 401)
      const third = await go()
      assert.equal(third.status, 429)
      assert.equal(third.body.error.code, 'TOO_MANY_ATTEMPTS')
      assert.ok(Number(third.headers.get('retry-after')) > 0)
    } finally {
      await limited.close()
    }
  })
  it('sair invalida a sessão no servidor (o cookie antigo não vale mais)', async () => {
    const c = client()
    await c.login('kitchen@teste.local', PW.kitchen)
    const saved = c.cookie
    assert.equal((await c.call('POST', '/logout')).status, 204)
    assert.equal(c.cookie, '')
    c.cookie = saved
    assert.equal((await c.call('GET', '/me')).status, 401)
  })
  it('sessão vencida não vale', async () => {
    const c = client()
    await c.login('kitchen@teste.local', PW.kitchen)
    const sid = sha256(decodeURIComponent(c.cookie.split('=')[1]))
    await db.sequelize.query('UPDATE sessions SET expires = ? WHERE sid = ?', { replacements: [new Date(OPEN.getTime() - 60_000), sid] })
    assert.equal((await c.call('GET', '/me')).status, 401)
    assert.equal((await one('SELECT COUNT(*) AS n FROM sessions WHERE sid = ?', [sid])).n, 0)
  })
})

describe('pedidos no painel', () => {
  it('atendimento vê telefone e endereço; cozinha vê só o primeiro nome', async () => {
    const id = await placeOrder()
    const s = (await S.call('GET', '/orders')).body.orders.find((o) => o.id === id)
    assert.equal(s.customerPhone, '(47) 99999-0000')
    assert.equal(s.address.street, 'Rua de Teste')
    const k = (await K.call('GET', '/orders')).body.orders.find((o) => o.id === id)
    assert.equal(k.customerName, 'Cliente')
    assert.equal(k.customerPhone, undefined)
    assert.equal(k.address, undefined)
    assert.ok(!JSON.stringify(k).includes('99999'))
  })
  it('cozinha: recebido → em preparo → pronto; não cancela nem despacha', async () => {
    const id = await placeOrder()
    let o = (await K.call('GET', `/orders/${id}`)).body.order
    let r = await K.call('POST', `/orders/${id}/status`, { to: 'preparing', version: o.version })
    assert.equal(r.status, 200)
    assert.equal(r.body.order.status, 'preparing')
    r = await K.call('POST', `/orders/${id}/status`, { to: 'cancelled', version: r.body.order.version, reason: 'teste' })
    assert.equal(r.status, 403)
    o = (await K.call('GET', `/orders/${id}`)).body.order
    r = await K.call('POST', `/orders/${id}/status`, { to: 'ready', version: o.version })
    assert.equal(r.body.order.status, 'ready')
    r = await K.call('POST', `/orders/${id}/status`, { to: 'out_for_delivery', version: r.body.order.version })
    assert.equal(r.status, 403)
    // o atendimento despacha e finaliza
    o = (await S.call('GET', `/orders/${id}`)).body.order
    r = await S.call('POST', `/orders/${id}/status`, { to: 'out_for_delivery', version: o.version })
    r = await S.call('POST', `/orders/${id}/status`, { to: 'completed', version: r.body.order.version })
    assert.equal(r.body.order.status, 'completed')
    assert.deepEqual(r.body.order.history.map((h) => h.status), ['pending', 'received', 'preparing', 'ready', 'out_for_delivery', 'completed'])
    const actors = (await db.sequelize.query('SELECT actor_type, actor_user_id FROM order_status_history WHERE order_id = ? ORDER BY id', { replacements: [id] }))[0]
    assert.ok(actors.slice(2).every((a) => a.actor_type === 'staff' && a.actor_user_id))
  })
  it('versão desatualizada (dois cliques ao mesmo tempo) = 409', async () => {
    const id = await placeOrder()
    const o = (await S.call('GET', `/orders/${id}`)).body.order
    const [a, b] = await Promise.all([S.call('POST', `/orders/${id}/status`, { to: 'preparing', version: o.version }), K.call('POST', `/orders/${id}/status`, { to: 'preparing', version: o.version })])
    assert.deepEqual([a.status, b.status].sort(), [200, 409])
  })
  it('transição fora da máquina de status = 409', async () => {
    const id = await placeOrder()
    const o = (await S.call('GET', `/orders/${id}`)).body.order
    const r = await S.call('POST', `/orders/${id}/status`, { to: 'completed', version: o.version })
    assert.equal(r.status, 409)
    assert.equal(r.body.error.code, 'INVALID_TRANSITION')
  })
  it('cancelar exige motivo; cancela o pagamento pendente e devolve o uso do cupom', async () => {
    await db.sequelize.query("INSERT INTO coupons (code, type, value, max_uses, active) VALUES ('PAINEL1', 'fixed', 100, 5, 1)")
    const id = await placeOrder({ couponCode: 'painel1' })
    assert.equal((await one("SELECT used_count FROM coupons WHERE code = 'PAINEL1'")).used_count, 1)
    const o = (await S.call('GET', `/orders/${id}`)).body.order
    const noReason = await S.call('POST', `/orders/${id}/status`, { to: 'cancelled', version: o.version })
    assert.equal(noReason.body.error.code, 'CANCEL_REASON_REQUIRED')
    const r = await S.call('POST', `/orders/${id}/status`, { to: 'cancelled', version: o.version, reason: 'cliente desistiu por telefone' })
    assert.equal(r.status, 200)
    assert.equal(r.body.order.cancelReason, 'cliente desistiu por telefone')
    assert.equal((await one('SELECT status FROM payments WHERE order_id = ?', [id])).status, 'cancelled')
    assert.equal((await one("SELECT used_count FROM coupons WHERE code = 'PAINEL1'")).used_count, 0)
  })
  it('lista "recentes" mostra finalizados e cancelados; cozinha não acessa', async () => {
    const r = await S.call('GET', '/orders?scope=recent')
    assert.equal(r.status, 200)
    assert.ok(r.body.orders.every((o) => ['completed', 'cancelled'].includes(o.status)))
    assert.equal((await K.call('GET', '/orders?scope=recent')).status, 403)
  })
})

describe('cardápio no painel', () => {
  it('atendimento marca esgotado; o cardápio público reflete na hora', async () => {
    const r = await S.call('PATCH', `/products/${ids.brisket}`, { available: false })
    assert.equal(r.status, 200)
    const pub = (await api.get('/catalog')).body.categories.flatMap((c) => c.products).find((p) => p.slug === 'brisket')
    assert.equal(pub.available, false)
    await S.call('PATCH', `/products/${ids.brisket}`, { available: true })
  })
  it('atendimento não muda preço; cozinha não muda nada', async () => {
    assert.equal((await S.call('PATCH', `/products/${ids.brisket}`, { priceCents: 100 })).status, 403)
    assert.equal((await K.call('PATCH', `/products/${ids.brisket}`, { available: false })).status, 403)
  })
  it('administração muda o preço; a cotação passa a usar o preço novo; fica no registro', async () => {
    const before = (await one("SELECT price_cents FROM products WHERE slug = 'smash-bacon'")).price_cents
    try {
      const r = await A.call('PATCH', `/products/${ids['smash-bacon']}`, { priceCents: before + 100 })
      assert.equal(r.body.product.priceCents, before + 100)
      const q = await api.post('/cart/quote', { lines: [{ productId: ids['smash-bacon'], quantity: 1 }], fulfillment: 'pickup' })
      assert.equal(q.body.totalCents, before + 100)
      const log = await one("SELECT meta FROM audit_logs WHERE action = 'product.update' ORDER BY id DESC LIMIT 1")
      const meta = typeof log.meta === 'string' ? JSON.parse(log.meta) : log.meta
      assert.deepEqual([meta.before.priceCents, meta.after.priceCents], [before, before + 100])
    } finally {
      await db.sequelize.query("UPDATE products SET price_cents = ? WHERE slug = 'smash-bacon'", { replacements: [before] })
    }
  })
  it('campo que não existe é recusado', async () => {
    assert.equal((await A.call('PATCH', `/products/${ids.brisket}`, { vucaRef: 1 })).status, 400)
  })
})

describe('loja no painel', () => {
  it('atendimento pausa e retoma; o site para de aceitar pedidos', async () => {
    assert.equal((await S.call('PATCH', '/store/settings', { orders_paused: true })).status, 200)
    const st = (await api.get('/store/status')).body
    assert.equal(st.acceptsOrders, false)
    assert.ok(st.reasons.includes('STORE_PAUSED'))
    await S.call('PATCH', '/store/settings', { orders_paused: false })
    assert.equal((await api.get('/store/status')).body.acceptsOrders, true)
  })
  it('atendimento não muda o modo de pedido; administração muda', async () => {
    assert.equal((await S.call('PATCH', '/store/settings', { ordering_mode: 'vuca' })).status, 403)
    const r = await A.call('PATCH', '/store/settings', { ordering_mode: 'vuca' })
    assert.equal(r.body.settings.ordering_mode, 'vuca')
    assert.ok(r.body.status.reasons.includes('ORDERING_DISABLED'))
  })
  it('pagamento online ainda não pode ser ligado (depende do gateway)', async () => {
    assert.equal((await A.call('PATCH', '/store/settings', { payment_methods_enabled: ['pix'] })).status, 400)
  })
  it('pendências continuam pendentes (null) até a Cemita definir', async () => {
    const r = await A.call('GET', '/store')
    assert.equal(r.body.settings.pickup_eta_minutes, null)
    assert.equal(r.body.settings.min_order_cents, null)
  })
  it('horário: administração substitui; formato HH:MM conferido', async () => {
    const old = (await A.call('GET', '/store')).body.hours
    try {
      assert.equal((await A.call('PUT', '/store/hours', { hours: [{ weekday: 3, opensAt: '25:00', closesAt: '23:00' }] })).status, 400)
      assert.equal((await S.call('PUT', '/store/hours', { hours: old })).status, 403)
      const r = await A.call('PUT', '/store/hours', { hours: [{ weekday: 3, opensAt: '18:00', closesAt: '19:00' }] })
      assert.equal(r.body.hours.length, 1)
      assert.equal(r.body.status.open, false) // quarta 20h fora do novo horário
    } finally {
      await A.call('PUT', '/store/hours', { hours: old })
    }
  })
})

describe('zonas de entrega no painel', () => {
  it('administração cria zona e a cotação usa a taxa dela; atendimento não acessa', async () => {
    assert.equal((await S.call('GET', '/zones')).status, 403)
    const z = await A.call('POST', '/zones', { name: '[TESTE] Zona do painel', matchType: 'neighborhood', neighborhoods: ['Bairro do Painel'], feeCents: 750, etaMinMinutes: 20, etaMaxMinutes: 40 })
    assert.equal(z.status, 201)
    const q = await api.post('/cart/quote', { lines: [{ productId: ids['smash-bacon'], quantity: 1 }], fulfillment: 'delivery', address: { neighborhood: 'Bairro do Painel' } })
    assert.equal(q.body.deliveryFeeCents, 750)
    const bad = await A.call('PUT', `/zones/${z.body.zone.id}`, { name: 'x', matchType: 'cep_range', cepStart: '2', cepEnd: '1', feeCents: 1, etaMinMinutes: 1, etaMaxMinutes: 2 })
    assert.equal(bad.status, 400)
    assert.equal((await A.call('DELETE', `/zones/${z.body.zone.id}`)).status, 204)
  })
  it('zona já usada em pedido não é apagada (desative em vez disso)', async () => {
    await placeOrder()
    const used = await one("SELECT delivery_zone_id AS id FROM orders WHERE delivery_zone_id IS NOT NULL ORDER BY id DESC LIMIT 1")
    const r = await A.call('DELETE', `/zones/${used.id}`)
    assert.equal(r.status, 409)
    assert.equal(r.body.error.code, 'ZONE_IN_USE')
  })
})

describe('equipe e registro', () => {
  it('administração cria conta; senha fraca e e-mail repetido são recusados', async () => {
    assert.equal((await A.call('POST', '/users', { name: 'Nova Pessoa', email: 'nova@teste.local', role: 'kitchen', password: 'curta' })).body.error.code, 'WEAK_PASSWORD')
    const ok = await A.call('POST', '/users', { name: 'Nova Pessoa', email: 'nova@teste.local', role: 'kitchen', password: 'grelha de ferro fundido' })
    assert.equal(ok.status, 201)
    assert.equal(ok.body.user.passwordHash, undefined)
    assert.equal((await A.call('POST', '/users', { name: 'Outra', email: 'nova@teste.local', role: 'kitchen', password: 'grelha de ferro fundido' })).body.error.code, 'EMAIL_TAKEN')
    assert.equal((await S.call('POST', '/users', { name: 'X', email: 'x@teste.local', role: 'admin', password: 'grelha de ferro fundido' })).status, 403)
  })
  it('desativar alguém derruba as sessões dessa pessoa', async () => {
    const c = client()
    assert.equal((await c.login('nova@teste.local', 'grelha de ferro fundido')).status, 200)
    const id = (await one("SELECT id FROM users WHERE email = 'nova@teste.local'")).id
    assert.equal((await A.call('PATCH', `/users/${id}`, { active: false })).status, 200)
    assert.equal((await c.call('GET', '/me')).status, 401)
    assert.equal((await c.login('nova@teste.local', 'grelha de ferro fundido')).status, 401)
  })
  it('ninguém desativa nem rebaixa a própria conta', async () => {
    const id = (await one("SELECT id FROM users WHERE email = 'admin@teste.local'")).id
    assert.equal((await A.call('PATCH', `/users/${id}`, { role: 'staff' })).body.error.code, 'SELF_CHANGE')
    assert.equal((await A.call('PATCH', `/users/${id}`, { active: false })).body.error.code, 'SELF_CHANGE')
  })
  it('trocar a própria senha exige a atual e encerra as sessões', async () => {
    const c = client()
    await c.login('staff@teste.local', PW.staff)
    assert.equal((await c.call('POST', '/password', { current: 'errada', next: 'nova frase bem comprida' })).body.error.code, 'WRONG_PASSWORD')
    assert.equal((await c.call('POST', '/password', { current: PW.staff, next: 'nova frase bem comprida' })).status, 204)
    assert.equal((await S.call('GET', '/me')).status, 401) // a outra sessão também caiu
    assert.equal((await client().login('staff@teste.local', 'nova frase bem comprida')).status, 200)
    PW.staff = 'nova frase bem comprida'
    await S.login('staff@teste.local', PW.staff)
  })
  it('registro: só administração lê; sem senha, sem IP aberto', async () => {
    assert.equal((await S.call('GET', '/audit')).status, 403)
    const r = await A.call('GET', '/audit?limit=300')
    assert.equal(r.status, 200)
    const actions = new Set(r.body.entries.map((e) => e.action))
    for (const a of ['login.ok', 'order.status', 'product.update', 'setting.update', 'zone.create', 'user.create', 'user.update', 'password.change']) assert.ok(actions.has(a), a)
    const text = JSON.stringify(r.body)
    assert.ok(!text.includes('127.0.0.1'))
    assert.ok(!/scrypt\$/.test(text))
    const raw = await one('SELECT ip_hash FROM audit_logs WHERE ip_hash IS NOT NULL LIMIT 1')
    assert.match(raw.ip_hash, /^[0-9a-f]{64}$/)
  })
})
