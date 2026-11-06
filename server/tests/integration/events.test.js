import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { seedDatabase } from '../../src/db/seeders/index.js'
import { initModels } from '../../src/models/index.js'
import { createAuditService } from '../../src/services/audit.service.js'
import { createAuthService } from '../../src/services/auth.service.js'
import { freshDatabase } from '../helpers/db.js'
import { startApi } from '../helpers/http.js'

/**
 * Agenda de eventos de ponta a ponta contra MySQL de teste, com uma IA FALSA (sem rede).
 * Relógio: 30/10/2026, 1h em São Paulo.
 */
const NOW = new Date('2026-10-30T04:00:00Z')
const PW = { admin: 'fumaca de lenha no domingo', staff: 'balcao com fila boa de sabado', kitchen: 'chapa quente e pao tostado' }
const PNG = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7]).toString('base64')

const fakeAi = {
  calls: [],
  async extract(args) {
    fakeAi.calls.push(args)
    return { isEvent: true, title: 'Halloween no Cemita', date: '2026-10-31', time: null, endTime: null, summary: 'Som ao vivo', description: null, highlights: ['Concurso de fantasias'], reservation: 'Reservas pelo direct ou WhatsApp', confidence: 'media', notes: null, warnings: ['Horário não aparece no post: preencha ou confirme com a casa.'] }
  },
}

let db, api, A, S, K
function client() {
  const c = { cookie: '', csrf: '' }
  c.call = async (method, path, body) => {
    const r = await api.request(method, '/admin' + path, { body, headers: { ...(c.cookie ? { cookie: c.cookie } : {}), ...(c.csrf ? { 'x-csrf-token': c.csrf } : {}) } })
    for (const s of r.headers.getSetCookie?.() ?? []) c.cookie = s.split(';')[0]
    if (r.body?.csrfToken) c.csrf = r.body.csrfToken
    return r
  }
  c.login = (email, password) => c.call('POST', '/login', { email, password })
  return c
}
const ev = (over = {}) => ({ title: 'Halloween no Cemita', date: '2026-10-31', time: '20:00', status: 'draft', highlights: ['Concurso de fantasias'], ...over })

before(async () => {
  db = await freshDatabase()
  await db.migrator.up()
  await seedDatabase(db.sequelize)
  const models = initModels(db.sequelize)
  const auth = createAuthService({ models, env: db.env, clock: () => new Date(), audit: createAuditService({ models, env: db.env }) })
  await auth.createUser({ name: 'Admin Teste', email: 'admin@teste.local', role: 'admin', password: PW.admin })
  await auth.createUser({ name: 'Atendimento Teste', email: 'staff@teste.local', role: 'staff', password: PW.staff })
  await auth.createUser({ name: 'Cozinha Teste', email: 'kitchen@teste.local', role: 'kitchen', password: PW.kitchen })
  api = await startApi({ env: { ...db.env, LOGIN_RATE_LIMIT: 1000 }, sequelize: db.sequelize, now: NOW, extractor: fakeAi })
  A = client()
  S = client()
  K = client()
  await A.login('admin@teste.local', PW.admin)
  await S.login('staff@teste.local', PW.staff)
  await K.login('kitchen@teste.local', PW.kitchen)
})
after(async () => {
  await api?.close()
  await db?.sequelize.close()
})

describe('eventos: quem pode', () => {
  it('sem login: 401; cozinha: 403; atendimento e administração: ok', async () => {
    assert.equal((await api.post('/admin/events', ev())).status, 401)
    assert.equal((await K.call('POST', '/events', ev())).status, 403)
    assert.equal((await S.call('GET', '/events')).status, 200)
    assert.equal((await A.call('GET', '/events')).status, 200)
  })
  it('sem o token anti-CSRF a escrita é recusada', async () => {
    const r = await api.request('POST', '/admin/events', { body: ev(), headers: { cookie: S.cookie } })
    assert.equal(r.status, 403)
  })
})

describe('eventos: cadastro e agenda pública', () => {
  it('rascunho não aparece no site; publicado aparece com data e hora de São Paulo', async () => {
    const c = await S.call('POST', '/events', ev({ image: PNG }))
    assert.equal(c.status, 201, JSON.stringify(c.body))
    assert.equal(c.body.event.startsAt, '2026-10-31T23:00:00.000Z')
    assert.deepEqual((await api.get('/events')).body.events, [])
    const p = await S.call('PUT', `/events/${c.body.event.id}`, ev({ status: 'published' }))
    assert.equal(p.status, 200)
    const pub = (await api.get('/events')).body.events
    assert.equal(pub.length, 1)
    assert.deepEqual([pub[0].date, pub[0].time, pub[0].title], ['2026-10-31', '20:00', 'Halloween no Cemita'])
    assert.match(pub[0].imageUrl, /^\/events\/\d+\/image\?v=1$/)
    assert.ok(!('status' in pub[0]))
  })

  it('a arte é servida com o tipo certo e liberada para o site; troca de arte muda a versão', async () => {
    const [e] = (await api.get('/events')).body.events
    const img = await api.request('GET', e.imageUrl)
    assert.equal(img.status, 200)
    assert.equal(img.headers.get('content-type'), 'image/png')
    assert.equal(img.headers.get('cross-origin-resource-policy'), 'cross-origin')
    const up = await A.call('PUT', `/events/${e.id}`, ev({ status: 'published', image: PNG }))
    assert.match(up.body.event.imageUrl, /\?v=2$/)
  })

  it('imagem falsa, link que não é do Instagram e campo a mais são recusados', async () => {
    assert.equal((await S.call('POST', '/events', ev({ image: 'data:image/jpeg;base64,' + Buffer.from('nao e imagem').toString('base64') }))).status, 422)
    assert.equal((await S.call('POST', '/events', ev({ instagramUrl: 'https://golpe.com/p/x' }))).status, 400)
    assert.equal((await S.call('POST', '/events', ev({ preco: 10 }))).status, 400)
  })

  it('evento que já passou some do site sozinho', async () => {
    await S.call('POST', '/events', ev({ title: 'Stand-up de ontem', date: '2026-10-29', time: '20:00', status: 'published' }))
    const titles = (await api.get('/events')).body.events.map((e) => e.title)
    assert.ok(!titles.includes('Stand-up de ontem'))
  })

  it('excluir tira da agenda e fica no registro', async () => {
    const c = await A.call('POST', '/events', ev({ title: 'Show cancelado', status: 'published' }))
    assert.equal((await A.call('DELETE', `/events/${c.body.event.id}`)).status, 204)
    assert.ok(!(await api.get('/events')).body.events.some((e) => e.title === 'Show cancelado'))
    const log = (await A.call('GET', '/audit')).body.entries.map((x) => x.action)
    assert.ok(log.includes('event.delete') && log.includes('event.create'))
  })
})

describe('eventos: leitura do post pela IA', () => {
  it('devolve um rascunho com avisos (não salva nada sozinho)', async () => {
    const before = (await A.call('GET', '/events')).body.events.length
    const r = await S.call('POST', '/events/extract', { caption: 'o dia mais esperado do ano tá chegando', image: PNG })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.draft.title, 'Halloween no Cemita')
    assert.ok(r.body.draft.warnings.length > 0)
    assert.equal(fakeAi.calls.at(-1).image.mime, 'image/png')
    assert.equal((await A.call('GET', '/events')).body.events.length, before)
  })
  it('a lista do painel avisa se a IA está ligada', async () => {
    assert.equal((await S.call('GET', '/events')).body.aiReady, true)
  })
})
