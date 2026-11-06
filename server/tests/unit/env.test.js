import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EnvError, parseEnv } from '../../src/config/env.js'

const base = { DATABASE_URL: 'mysql://user:s3cr3t@127.0.0.1:3306/cemita_dev', TRACKING_TOKEN_SECRET: 'x'.repeat(32) }

describe('configuração (env)', () => {
  it('aceita o mínimo e aplica padrões seguros', () => {
    const env = parseEnv(base)
    assert.equal(env.NODE_ENV, 'development')
    assert.equal(env.PORT, 3333)
    assert.equal(env.DB_SSL, false)
    assert.deepEqual(env.CORS_ORIGINS, [])
    assert.ok(Object.isFrozen(env))
  })

  it('recusa subir sem DATABASE_URL, dizendo qual variável falta', () => {
    assert.throws(() => parseEnv({ TRACKING_TOKEN_SECRET: 'x'.repeat(32) }), (err) => err instanceof EnvError && /DATABASE_URL/.test(err.message))
  })

  it('exige segredo do token de acompanhamento com pelo menos 32 caracteres', () => {
    assert.throws(() => parseEnv({ DATABASE_URL: base.DATABASE_URL }), /TRACKING_TOKEN_SECRET/)
    assert.throws(() => parseEnv({ ...base, TRACKING_TOKEN_SECRET: 'curto' }), /TRACKING_TOKEN_SECRET/)
  })

  it('pagamento online: desligado por padrão; Mercado Pago exige token, segredo do webhook e endereço do site', () => {
    assert.equal(parseEnv(base).PAYMENT_PROVIDER, 'none')
    assert.throws(() => parseEnv({ ...base, PAYMENT_PROVIDER: 'mercadopago' }), (e) => /MP_ACCESS_TOKEN/.test(e.message) && /MP_WEBHOOK_SECRET/.test(e.message) && /PUBLIC_SITE_URL/.test(e.message))
    const mp = { ...base, PAYMENT_PROVIDER: 'mercadopago', MP_ACCESS_TOKEN: 'TEST-1234567890-abcdefghij', MP_WEBHOOK_SECRET: 'segredo-com-16-ou-mais', PUBLIC_SITE_URL: 'http://localhost:5173' }
    assert.equal(parseEnv(mp).PAYMENT_PROVIDER, 'mercadopago')
    assert.throws(() => parseEnv({ ...mp, PAYMENT_PROVIDER: 'stripe' }), EnvError)
    const prod = { ...mp, NODE_ENV: 'production', TRACKING_TOKEN_SECRET: 'p'.repeat(40), CORS_ORIGINS: 'https://cemita.com.br' }
    assert.throws(() => parseEnv(prod), /PUBLIC_SITE_URL/)
    assert.throws(() => parseEnv({ ...prod, PUBLIC_SITE_URL: 'https://cemita.com.br', MP_SANDBOX: 'true' }), /MP_SANDBOX/)
    assert.equal(parseEnv({ ...prod, PUBLIC_SITE_URL: 'https://cemita.com.br' }).PAYMENT_PROVIDER, 'mercadopago')
  })

  it('recusa URL de banco que não seja mysql://…/banco', () => {
    assert.throws(() => parseEnv({ ...base, DATABASE_URL: 'postgres://x@y/z' }), EnvError)
    assert.throws(() => parseEnv({ ...base, DATABASE_URL: 'mysql://user:pw@host:3306/' }), EnvError)
  })

  it('a mensagem de erro nunca mostra a senha do banco', () => {
    try {
      parseEnv({ ...base, PORT: 'abc' })
      assert.fail('deveria falhar')
    } catch (err) {
      assert.ok(err instanceof EnvError)
      assert.ok(!err.message.includes('s3cr3t'))
    }
  })

  it('em produção só aceita origens https', () => {
    assert.throws(() => parseEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: 'http://cemita.com.br' }), /https/)
    const env = parseEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://cemita.com.br, https://www.cemita.com.br' })
    assert.deepEqual(env.CORS_ORIGINS, ['https://cemita.com.br', 'https://www.cemita.com.br'])
  })

  it('DB_SSL entende true/false/1/0 e recusa outros valores', () => {
    assert.equal(parseEnv({ ...base, DB_SSL: 'true' }).DB_SSL, true)
    assert.equal(parseEnv({ ...base, DB_SSL: '0' }).DB_SSL, false)
    assert.throws(() => parseEnv({ ...base, DB_SSL: 'sim' }), EnvError)
  })

  it('publicação: SITE_DIR e conta inicial opcionais, validadas sem mostrar a senha', () => {
    const env = parseEnv({ ...base, SITE_DIR: '/app/dist', BOOTSTRAP_ADMIN_NAME: 'Dono', BOOTSTRAP_ADMIN_EMAIL: 'dono@exemplo.com', BOOTSTRAP_ADMIN_PASSWORD: 'uma frase longa de teste' })
    assert.equal(env.SITE_DIR, '/app/dist')
    assert.equal(env.BOOTSTRAP_ADMIN_EMAIL, 'dono@exemplo.com')
    assert.equal(parseEnv(base).SITE_DIR, undefined)
    assert.throws(() => parseEnv({ ...base, BOOTSTRAP_ADMIN_EMAIL: 'sem-arroba' }), /BOOTSTRAP_ADMIN_EMAIL/)
    assert.throws(
      () => parseEnv({ ...base, BOOTSTRAP_ADMIN_PASSWORD: 'curta123' }),
      (err) => /BOOTSTRAP_ADMIN_PASSWORD/.test(err.message) && !/curta123/.test(err.message),
    )
  })

  it('aceita o endereço do MySQL do Railway', () => {
    assert.ok(parseEnv({ ...base, DATABASE_URL: 'mysql://root:Abc123xyz@mysql.railway.internal:3306/railway' }))
  })
})
