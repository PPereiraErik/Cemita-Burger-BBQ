import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultLogN, hashPassword, needsRehash, passwordProblem, verifyPassword } from '../../src/utils/password.js'

describe('senhas (scrypt)', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const h = await hashPassword('uma frase bem comprida', { logN: 14 })
    assert.match(h, /^scrypt\$14\$8\$1\$[\w-]+\$[\w-]+$/)
    assert.equal(await verifyPassword('uma frase bem comprida', h), true)
    assert.equal(await verifyPassword('uma frase bem comprid', h), false)
  })
  it('sal aleatório: a mesma senha gera hashes diferentes', async () => {
    const [a, b] = await Promise.all([hashPassword('outra frase comprida', { logN: 14 }), hashPassword('outra frase comprida', { logN: 14 })])
    assert.notEqual(a, b)
  })
  it('hash malformado ou de outro formato nunca confere', async () => {
    for (const bad of ['', 'abc', 'bcrypt$1$2$3$4$5', 'scrypt$99$8$1$aa$bb', null]) assert.equal(await verifyPassword('x', bad), false)
  })
  it('custo: 17 em produção, 14 em teste, ou o da variável', () => {
    assert.equal(defaultLogN({ NODE_ENV: 'production' }), 17)
    assert.equal(defaultLogN({ NODE_ENV: 'test' }), 14)
    assert.equal(defaultLogN({ NODE_ENV: 'production', AUTH_SCRYPT_LOG_N: '18' }), 18)
    assert.equal(defaultLogN({ NODE_ENV: 'production', AUTH_SCRYPT_LOG_N: '3' }), 17)
  })
  it('pede regravação quando o custo guardado é menor', async () => {
    const h = await hashPassword('frase longa de teste', { logN: 14 })
    assert.equal(needsRehash(h, 17), true)
    assert.equal(needsRehash(h, 14), false)
  })
  it('regra de senha: tamanho, repetição, e-mail e nome', () => {
    assert.match(passwordProblem('curta'), /12/)
    assert.match(passwordProblem('a'.repeat(129)), /128/)
    assert.match(passwordProblem('aaaaaaaaaaaaaa'), /repetido/)
    assert.match(passwordProblem('joaozinho-da-silva-2026', { email: 'joaozinho@x.com' }), /e-mail/)
    assert.match(passwordProblem('mariana gosta de brisket', { name: 'Mariana Souza' }), /nome/)
    assert.match(passwordProblem('cemita123456'), /adivinhar/)
    assert.equal(passwordProblem('fumaca de lenha no domingo', { email: 'ana@x.com', name: 'Ana' }), null)
  })
})
