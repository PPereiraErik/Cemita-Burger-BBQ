import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertCents, formatCents, multiplyCents, reaisToCents, sumCents } from '../../src/utils/money.js'

describe('dinheiro em centavos', () => {
  it('converte reais sem erro de ponto flutuante', () => {
    assert.equal(reaisToCents(15.99), 1599)
    assert.equal(reaisToCents(0.1 + 0.2), 30)
    assert.equal(reaisToCents(180), 18000)
  })
  it('recusa valores que não são centavos inteiros e positivos', () => {
    assert.throws(() => assertCents(10.5))
    assert.throws(() => assertCents(-1))
    assert.throws(() => assertCents(Number.NaN))
    assert.throws(() => reaisToCents(-3))
  })
  it('soma e multiplica só inteiros', () => {
    assert.equal(sumCents([1599, 3900, 0]), 5499)
    assert.equal(multiplyCents(3500, 2), 7000)
    assert.throws(() => multiplyCents(3500, 1.5))
  })
  it('formata em reais', () => {
    assert.equal(formatCents(12798).replace(/\s/g, ' '), 'R$ 127,98')
  })
})
