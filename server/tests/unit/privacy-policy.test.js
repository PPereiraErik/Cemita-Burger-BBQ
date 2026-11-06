import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { policyPlan } from '../../src/domain/privacyPolicy.js'
import { parseEnv } from '../../src/config/env.js'

const base = { DATABASE_URL: 'mysql://user:s3cr3t@127.0.0.1:3306/cemita_dev', TRACKING_TOKEN_SECRET: 'x'.repeat(32) }

describe('política de privacidade na publicação', () => {
  it('versão nova publica; versão que já existe não muda nada; sem variáveis, nada', () => {
    assert.deepEqual(policyPlan(['2026-11'], { version: '2027-01', url: 'https://cemita.com.br/politica.html' }), { action: 'publish', version: '2027-01', url: 'https://cemita.com.br/politica.html' })
    assert.deepEqual(policyPlan(['2026-11'], { version: '2026-11', url: 'https://cemita.com.br/politica.html' }), { action: 'keep' })
    assert.deepEqual(policyPlan([], { version: undefined, url: undefined }), { action: 'none' })
  })
  it('versão e endereço vão juntos; em produção, só https', () => {
    assert.throws(() => parseEnv({ ...base, PRIVACY_POLICY_VERSION: '2026-11' }), /informe as duas juntas/)
    assert.throws(() => parseEnv({ ...base, PRIVACY_POLICY_VERSION: 'versão com espaço', PRIVACY_POLICY_URL: 'https://x.com.br/p' }), /PRIVACY_POLICY_VERSION/)
    const prod = { ...base, NODE_ENV: 'production', TRACKING_TOKEN_SECRET: 'prod-' + 'y'.repeat(40) }
    assert.throws(() => parseEnv({ ...prod, PRIVACY_POLICY_VERSION: '2026-11', PRIVACY_POLICY_URL: 'http://cemita.com.br/p' }), /PRIVACY_POLICY_URL: em produção, https/)
    assert.ok(parseEnv({ ...prod, PRIVACY_POLICY_VERSION: '2026-11', PRIVACY_POLICY_URL: 'https://cemita.com.br/politica-de-privacidade.html' }))
  })
})
