import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import { describe, it } from 'node:test'
import { createLogger, maskPhone } from '../../src/utils/logger.js'

describe('logs sem dados pessoais', () => {
  it('remove telefone, nome, endereço, senha e cookies', () => {
    const lines = []
    const sink = new Writable({ write: (c, _e, cb) => (lines.push(String(c)), cb()) })
    const logger = createLogger({ level: 'info', destination: sink })
    logger.info({ order: { customerPhone: '47999990000', customerName: 'Fulano', address: 'Rua X', total: 100 }, user: { password: 'x' } }, 'teste')
    const out = lines.join('')
    assert.ok(!out.includes('47999990000'))
    assert.ok(!out.includes('Fulano'))
    assert.ok(!out.includes('Rua X'))
    assert.ok(out.includes('[removido]'))
    assert.ok(out.includes('"total":100'))
  })
  it('mascara telefone para exibição em log', () => {
    assert.equal(maskPhone('(47) 99683-8894'), '479****94')
    assert.equal(maskPhone(''), '***')
  })
})
