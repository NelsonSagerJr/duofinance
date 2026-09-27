import { describe, it, expect } from 'vitest'
import { formatBRL, parseBRL } from './money.js'

const clean = (s) => s.replace(/\s/g, ' ')

describe('money', () => {
  it('formats cents as BRL', () => {
    expect(clean(formatBRL(123456))).toBe('R$ 1.234,56')
    expect(clean(formatBRL(5))).toBe('R$ 0,05')
  })

  it('parses pt-BR input to cents', () => {
    expect(parseBRL('1.234,56')).toBe(123456)
    expect(parseBRL('12,5')).toBe(1250)
    expect(parseBRL('R$ 10')).toBe(1000)
    expect(parseBRL('1.234')).toBe(123400)
    expect(parseBRL('12.50')).toBe(1250)
    expect(parseBRL('0,1')).toBe(10)
  })

  it('rejects garbage', () => {
    expect(parseBRL('')).toBe(null)
    expect(parseBRL('abc')).toBe(null)
    expect(parseBRL('1,2,3')).toBe(null)
    expect(parseBRL('1,234.56')).toBe(null)
    expect(parseBRL('12,345')).toBe(null)
    expect(parseBRL('12.345')).toBe(1234500)
    expect(parseBRL('1.5555')).toBe(null)
  })
})
