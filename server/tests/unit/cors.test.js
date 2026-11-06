import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cors } from '../../src/middlewares/cors.js'

/** Requisição/resposta mínimas, só com o que o middleware usa. */
function run(mw, { method = 'GET', origin, path = '/api/v1/catalog' } = {}) {
  const headers = {}
  const res = {
    statusCode: 200,
    body: undefined,
    ended: false,
    vary(v) {
      headers.vary = v
      return this
    },
    set(obj) {
      Object.assign(headers, obj)
      return this
    },
    status(c) {
      this.statusCode = c
      return this
    },
    json(b) {
      this.body = b
      this.ended = true
      return this
    },
    end() {
      this.ended = true
      return this
    },
  }
  const req = { method, path, id: 'req-1', get: (h) => (h.toLowerCase() === 'origin' ? origin : undefined) }
  let nextCalled = false
  mw(req, res, () => (nextCalled = true))
  return { res, headers, nextCalled }
}

describe('CORS', () => {
  const mw = cors(['http://localhost:5173'])

  it('sem Origin (curl, servidor) passa sem cabeçalho', () => {
    const r = run(mw)
    assert.equal(r.nextCalled, true)
    assert.deepEqual(r.headers, {})
  })

  it('origem do site recebe liberação e segue para a rota', () => {
    const r = run(mw, { origin: 'http://localhost:5173' })
    assert.equal(r.nextCalled, true)
    assert.equal(r.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')
    assert.equal(r.headers.vary, 'Origin')
    assert.equal(r.headers['Access-Control-Allow-Credentials'], undefined)
  })

  it('outra origem segue sem liberação (o navegador bloqueia a leitura)', () => {
    const r = run(mw, { origin: 'https://outro.example' })
    assert.equal(r.nextCalled, true)
    assert.equal(r.headers['Access-Control-Allow-Origin'], undefined)
  })

  it('pré-verificação: 204 para o site, 403 para outra origem', () => {
    const ok = run(mw, { method: 'OPTIONS', origin: 'http://localhost:5173' })
    assert.equal(ok.res.statusCode, 204)
    assert.equal(ok.nextCalled, false)
    assert.match(ok.headers['Access-Control-Allow-Headers'], /Idempotency-Key/)
    const no = run(mw, { method: 'OPTIONS', origin: 'https://outro.example' })
    assert.equal(no.res.statusCode, 403)
    assert.equal(no.res.body.error.code, 'CORS_ORIGIN_DENIED')
  })

  it('lista vazia não libera ninguém', () => {
    const r = run(cors([]), { origin: 'http://localhost:5173' })
    assert.equal(r.headers['Access-Control-Allow-Origin'], undefined)
  })

  it('painel: credenciais, métodos de escrita e X-CSRF-Token', () => {
    const pre = run(mw, { method: 'OPTIONS', origin: 'http://localhost:5173', path: '/api/v1/admin/products/3' })
    assert.equal(pre.res.statusCode, 204)
    assert.equal(pre.headers['Access-Control-Allow-Credentials'], 'true')
    assert.match(pre.headers['Access-Control-Allow-Methods'], /PATCH/)
    assert.match(pre.headers['Access-Control-Allow-Headers'], /X-CSRF-Token/)
    const get = run(mw, { origin: 'http://localhost:5173', path: '/api/v1/admin/me' })
    assert.equal(get.headers['Access-Control-Allow-Credentials'], 'true')
  })

  it('API pública continua sem credenciais e sem PATCH', () => {
    const pre = run(mw, { method: 'OPTIONS', origin: 'http://localhost:5173', path: '/api/v1/orders' })
    assert.equal(pre.headers['Access-Control-Allow-Credentials'], undefined)
    assert.doesNotMatch(pre.headers['Access-Control-Allow-Methods'], /PATCH/)
  })

  it('caminho parecido com o do painel não ganha credenciais', () => {
    const r = run(mw, { origin: 'http://localhost:5173', path: '/api/v1/administrador' })
    assert.equal(r.headers['Access-Control-Allow-Credentials'], undefined)
  })
})
