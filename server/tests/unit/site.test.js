import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cacheControlFor, fallbackFor, SITE_CSP } from '../../src/site/rules.js'

describe('site servido pela API', () => {
  it('arquivos com hash do Vite ficam em cache por 1 ano; HTML sempre confere', () => {
    assert.equal(cacheControlFor('/assets/index-BX3k9aQ1.js'), 'public, max-age=31536000, immutable')
    assert.equal(cacheControlFor('/assets/gsap-a1B2c3D4e5.css'), 'public, max-age=31536000, immutable')
    assert.equal(cacheControlFor('/index.html'), 'no-cache')
    assert.equal(cacheControlFor('/admin/index.html'), 'no-cache')
    assert.equal(cacheControlFor('/og-cemita.jpg'), 'public, max-age=86400')
    assert.equal(cacheControlFor('/assets/sem-hash.js'), 'public, max-age=86400')
  })
  it('endereço sem arquivo: painel, site ou 404', () => {
    assert.equal(fallbackFor('/'), 'index.html')
    assert.equal(fallbackFor('/cardapio'), 'index.html')
    assert.equal(fallbackFor('/admin'), 'admin/index.html')
    assert.equal(fallbackFor('/admin/qualquer'), 'admin/index.html')
    assert.equal(fallbackFor('/api/v1/nao-existe'), null)
    assert.equal(fallbackFor('/api'), null)
    assert.equal(fallbackFor('/foto-que-nao-existe.png'), null)
    assert.equal(fallbackFor('/administracao'), 'index.html')
  })
  it('política de segurança: nada de fora, nada em iframe', () => {
    assert.deepEqual(SITE_CSP.scriptSrc, ["'self'"])
    assert.deepEqual(SITE_CSP.connectSrc, ["'self'"])
    assert.deepEqual(SITE_CSP.frameAncestors, ["'none'"])
    assert.ok(!SITE_CSP.scriptSrc.includes("'unsafe-inline'"))
  })
})
