import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createApp } from '../../src/app.js'
import { createSequelize } from '../../src/config/database.js'
import { createLogger } from '../../src/utils/logger.js'
import { assertDatabaseReachable, testEnv } from '../helpers/db.js'

const logger = createLogger({ level: 'silent' })

describe('produção: site, painel e API no mesmo serviço (SITE_DIR)', () => {
  let sequelize, server, base, dir
  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cemita-site-'))
    fs.mkdirSync(path.join(dir, 'assets'))
    fs.mkdirSync(path.join(dir, 'admin'))
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>site</title>')
    fs.writeFileSync(path.join(dir, 'admin', 'index.html'), '<!doctype html><title>painel</title>')
    fs.writeFileSync(path.join(dir, 'assets', 'index-AbCdEf12.js'), 'console.log(1)')
    const env = testEnv()
    sequelize = createSequelize(env)
    await assertDatabaseReachable(sequelize, env)
    server = createApp({ env, sequelize, logger, siteDir: dir }).listen(0)
    await new Promise((r) => server.once('listening', r))
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(async () => {
    await new Promise((r) => server?.close(r))
    await sequelize?.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('entrega o site com política própria e sem cache do HTML', async () => {
    const res = await fetch(`${base}/`)
    assert.equal(res.status, 200)
    assert.match(await res.text(), /<title>site<\/title>/)
    assert.equal(res.headers.get('cache-control'), 'no-cache')
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/)
    assert.match(res.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/)
  })
  it('arquivos com hash ficam em cache longo', async () => {
    const res = await fetch(`${base}/assets/index-AbCdEf12.js`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  })
  it('/admin abre o painel', async () => {
    const res = await fetch(`${base}/admin/`)
    assert.equal(res.status, 200)
    assert.match(await res.text(), /<title>painel<\/title>/)
    const semBarra = await fetch(`${base}/admin`, { redirect: 'manual' })
    assert.ok([200, 301].includes(semBarra.status))
  })
  it('a API continua com a política dela e o 404 dela', async () => {
    const health = await fetch(`${base}/api/v1/health`)
    assert.equal(health.status, 200)
    assert.match(health.headers.get('content-security-policy') ?? '', /default-src 'none'/)
    const nf = await fetch(`${base}/api/v1/nao-existe`)
    assert.equal(nf.status, 404)
    assert.equal((await nf.json()).error.code, 'ROUTE_NOT_FOUND')
  })
  it('arquivo que não existe é 404, não a página', async () => {
    const res = await fetch(`${base}/nao-existe.png`)
    assert.equal(res.status, 404)
  })
})
