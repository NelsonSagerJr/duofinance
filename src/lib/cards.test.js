import { describe, it, expect } from 'vitest'
import { invoiceMonth, splitInstallments, installmentDate } from './cards.js'

describe('cards', () => {
  it('purchases from the closing day on go to next invoice', () => {
    expect(invoiceMonth('2026-10-05', 6)).toBe('2026-10-01')
    expect(invoiceMonth('2026-10-06', 6)).toBe('2026-11-01')
    expect(invoiceMonth('2026-12-20', 6)).toBe('2027-01-01')
    expect(invoiceMonth('2026-02-28', 31)).toBe('2026-03-01')
    expect(invoiceMonth('2026-02-27', 31)).toBe('2026-02-01')
  })
  it('splits installments without losing cents', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333])
  })
  it('installment dates clamp to month end', () => {
    expect(installmentDate('2026-01-31', 1)).toBe('2026-02-28')
    expect(installmentDate('2026-10-08', 2)).toBe('2026-12-08')
  })
})
