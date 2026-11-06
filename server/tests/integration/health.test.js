import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { createApp } from '../../src/app.js'
import { createSequelize } from '../../src/config/database.js'
import { parseEnv } from '../../src/config/env.js'
import { createLogger } from '../../src/utils/logger.js'
import { assertDatabaseReachable, testEnv } from '../helpers/db.js'

const logger = createLogger({ level: 'silent' })

async function serve(sequelize, env) {
  const server = createApp({ env, sequelize, logger }).listen(0)
  await new Promise((r) => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  return { base, close: () => new Promise((r) => server.close(r)) }
}

describe('GET /api/v1/health com banco no ar', () => {
  let sequelize, srv
  before(async () => {
    const env = testEnv()
    sequelize = createSequelize(env)
    await assertDatabaseReachable(sequelize, env)
    srv = await serve(sequelize, env)
  })
  after(async () => {
    await srv?.close()
    await sequelize?.close()
  })

  it('responde 200 e só o essencial', async () => {
    const res = await fetch(`${srv.base}/api/v1/health`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { status: 'ok', checks: { database: 'ok' } })
    assert.equal(res.headers.get('cache-control'), 'no-store')
  })

  it('manda cabeçalhos de segurança e esconde a tecnologia', async () => {
    const res = await fetch(`${srv.base}/api/v1/health`)
    assert.equal(res.headers.get('x-powered-by'), null)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'none'/)
    assert.match(res.headers.get('x-request-id') ?? '', /^[A-Za-z0-9-]{8,64}$/)
  })

  it('rota inexistente devolve 404 no formato de erro da API', async () => {
    const res = await fetch(`${srv.base}/api/v1/nao-existe`)
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND')
  })

  it('JSON quebrado vira 400 sem pilha de erro', async () => {
    const res = await fetch(`${srv.base}/api/v1/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":' })
    assert.equal(res.status, 400)
    const text = await res.text()
    assert.match(text, /INVALID_JSON/)
    assert.doesNotMatch(text, /at .*\.js|stack|SyntaxError/)
  })

  it('corpo acima de 20 KB é recusado', async () => {
    const res = await fetch(`${srv.base}/api/v1/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(25_000) }) })
    assert.equal(res.status, 413)
  })
})

describe('GET /api/v1/health com banco fora do ar', () => {
  it('responde 503 sem expor detalhes do erro', async () => {
    const env = parseEnv({ DATABASE_URL: 'mysql://ninguem:senha@127.0.0.1:1/cemita_test', LOG_LEVEL: 'silent', TRACKING_TOKEN_SECRET: 'x'.repeat(32) })
    const sequelize = createSequelize(env)
    const srv = await serve(sequelize, env)
    try {
      const res = await fetch(`${srv.base}/api/v1/health`)
      assert.equal(res.status, 503)
      const text = await res.text()
      assert.deepEqual(JSON.parse(text), { status: 'unavailable', checks: { database: 'unavailable' } })
      assert.doesNotMatch(text, /ECONNREFUSED|senha|ninguem/)
    } finally {
      await srv.close()
      await sequelize.close()
    }
  })
})
