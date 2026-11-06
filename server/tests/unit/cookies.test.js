import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clearSessionCookie, parseCookies, sessionCookie } from '../../src/utils/cookies.js'

describe('cookies do painel', () => {
  it('cookie de sessão: HttpOnly, SameSite=Strict, só no caminho do painel', () => {
    const c = sessionCookie('tok', { maxAgeSeconds: 60, secure: false })
    assert.match(c, /^cemita_sess=tok; /)
    for (const part of ['Path=/api/v1/admin', 'Max-Age=60', 'HttpOnly', 'SameSite=Strict']) assert.ok(c.includes(part), part)
    assert.ok(!c.includes('Secure'))
    assert.ok(sessionCookie('tok', { maxAgeSeconds: 60, secure: true }).endsWith('; Secure'))
  })
  it('apagar = mesmo cookie vazio com Max-Age=0', () => {
    assert.match(clearSessionCookie({ secure: false }), /^cemita_sess=; Path=\/api\/v1\/admin; Max-Age=0/)
  })
  it('lê o cabeçalho Cookie, fica com o primeiro valor e ignora lixo', () => {
    assert.deepEqual(parseCookies('a=1; cemita_sess=abc%2Fd; a=2; ruim; x=%E0%A4%A'), { a: '1', cemita_sess: 'abc/d' })
    assert.deepEqual(parseCookies(undefined), {})
  })
})
