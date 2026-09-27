import { describe, it, expect } from 'vitest'
import { computeSettlement } from './settlement.js'

const A = 'a', B = 'b'
const members = [{ user_id: A }, { user_id: B }]
const house = (amount_cents, paid_by, share_pct = { [A]: 50, [B]: 50 }) => ({ scope: 'house', amount_cents, paid_by, share_pct })

describe('computeSettlement', () => {
  it('50/50: whoever paid less transfers half the difference', () => {
    const r = computeSettlement({ members, expenses: [house(10000, A), house(4000, B)] })
    expect(r.total).toBe(14000)
    expect(r.perMember[A]).toEqual({ due: 7000, paid: 10000, balance: 3000 })
    expect(r.transfer).toEqual({ from_id: B, to_id: A, amount_cents: 3000 })
  })

  it('ignores personal expenses', () => {
    const r = computeSettlement({ members, expenses: [house(1000, A), { scope: 'personal', amount_cents: 9999, paid_by: B, owner_id: B }] })
    expect(r.total).toBe(1000)
    expect(r.transfer).toEqual({ from_id: B, to_id: A, amount_cents: 500 })
  })

  it("uses each expense's own split", () => {
    const r = computeSettlement({ members, expenses: [house(10000, A, { [A]: 60, [B]: 40 }), house(10000, A, { [A]: 0, [B]: 100 })] })
    expect(r.perMember[B].due).toBe(4000 + 10000)
    expect(r.transfer).toEqual({ from_id: B, to_id: A, amount_cents: 14000 })
  })

  it('rounding leftover stays with the payer', () => {
    const r = computeSettlement({ members, expenses: [house(1001, A)] }) // 500.5 each
    expect(r.perMember[A].due + r.perMember[B].due).toBe(1001)
    expect(r.perMember[B].due).toBe(501)
    expect(r.perMember[A].due).toBe(500)
    expect(r.transfer.amount_cents).toBe(501)
  })

  it('subtracts prior settlements of the month', () => {
    const expenses = [house(10000, A)]
    const partial = computeSettlement({ members, expenses, settlements: [{ from_id: B, to_id: A, amount_cents: 2000 }] })
    expect(partial.transfer).toEqual({ from_id: B, to_id: A, amount_cents: 3000 })
    expect(partial.settled).toBe(2000)
    const done = computeSettlement({ members, expenses, settlements: [{ from_id: B, to_id: A, amount_cents: 5000 }] })
    expect(done.transfer).toBe(null)
  })

  it('no expenses, no transfer', () => {
    expect(computeSettlement({ members }).transfer).toBe(null)
  })
})
