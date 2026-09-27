import { describe, it, expect } from 'vitest'
import { myHouseShare, monthSpending, investmentBalance, monthMetrics, budgetUsage, monthlySeries } from './personal.js'

const A = 'a', B = 'b'
const members = [{ user_id: A }, { user_id: B }]
const house = (amount_cents, paid_by, spent_on = '2026-09-10', share_pct = { [A]: 50, [B]: 50 }, category = 'alimentacao') =>
  ({ scope: 'house', amount_cents, paid_by, spent_on, share_pct, category_id: category })
const personal = (amount_cents, owner_id, spent_on = '2026-09-10', category = 'lazer') =>
  ({ scope: 'personal', amount_cents, owner_id, paid_by: owner_id, spent_on, category_id: category })
const mv = (type, amount_cents, moved_on, investment_id = 'i1') => ({ type, amount_cents, moved_on, investment_id })

describe('myHouseShare', () => {
  it('rounds like the acerto: the rounding difference lands on whoever paid', () => {
    // 10,01 at 50/50 = 5,005 each -> both round to 5,01; the payer absorbs the extra cent.
    expect(myHouseShare(house(1001, A), members, A)).toBe(500)
    expect(myHouseShare(house(1001, A), members, B)).toBe(501)
    expect(myHouseShare(house(1001, B), members, A)).toBe(501)
  })

  it('uses the split saved on the expense, whoever paid', () => {
    expect(myHouseShare(house(10000, B, '2026-09-01', { [A]: 70, [B]: 30 }), members, A)).toBe(7000)
  })

  it('dividido na hora: my part is my share, and both parts add up to the amount', () => {
    const e = house(1001, null)
    expect(myHouseShare(e, members, A) + myHouseShare(e, members, B)).toBe(1001)
    expect(myHouseShare(house(9000, null, '2026-09-01', { [A]: 60, [B]: 40 }), members, B)).toBe(3600)
  })
})

describe('monthSpending', () => {
  it('adds my personal spending and my house share, by category, only inside the month', () => {
    const expenses = [
      personal(5000, A),
      personal(9999, B), // RLS never returns it, but it must not count anyway
      house(20000, B, '2026-09-30', { [A]: 50, [B]: 50 }, 'moradia'),
      house(3000, null, '2026-09-05', { [A]: 50, [B]: 50 }, 'lazer'),
      house(80000, A, '2026-10-01'), // next month
      personal(700, A, '2026-08-31'), // previous month
    ]
    const r = monthSpending({ month: '2026-09-01', expenses, members, meId: A })
    expect(r.personal).toBe(5000)
    expect(r.house).toBe(10000 + 1500)
    expect(r.total).toBe(16500)
    expect(r.byCategory).toEqual({ lazer: 6500, moradia: 10000 })
  })
})

describe('investmentBalance', () => {
  it('without a snapshot the balance is what went in, and there is no return', () => {
    expect(investmentBalance([mv('deposit', 10000, '2026-01-10'), mv('withdraw', 2500, '2026-02-10')])).toEqual({
      balance: 7500, contributed: 7500, gain: 0, gainPct: 0, hasSnapshot: false,
    })
  })

  it('snapshot, then later deposits and withdrawals move the balance from it', () => {
    const moves = [
      mv('deposit', 100000, '2026-01-05'),
      mv('balance', 103000, '2026-03-31'), // +3.000 of return
      mv('deposit', 50000, '2026-04-05'),
      mv('withdraw', 20000, '2026-05-05'),
    ]
    const r = investmentBalance(moves)
    expect(r.balance).toBe(103000 + 50000 - 20000)
    expect(r.contributed).toBe(130000)
    expect(r.gain).toBe(3000)
    expect(r.gainPct).toBeCloseTo(3000 / 130000)
  })

  it('only the latest snapshot counts, and moves before it are already inside it', () => {
    const moves = [mv('balance', 1, '2026-02-01'), mv('deposit', 10000, '2026-01-01'), mv('balance', 12000, '2026-03-01'), mv('deposit', 999, '2026-02-15')]
    expect(investmentBalance(moves).balance).toBe(12000)
  })

  it('as of a date ignores later moves (end of a past month)', () => {
    const moves = [mv('deposit', 10000, '2026-01-10'), mv('balance', 11000, '2026-02-28'), mv('deposit', 5000, '2026-03-02')]
    expect(investmentBalance(moves, '2026-03-01')).toMatchObject({ balance: 11000, contributed: 10000, gain: 1000 })
    expect(investmentBalance(moves, '2026-01-01')).toMatchObject({ balance: 0, contributed: 0, gainPct: null })
  })

  it('a loss shows as negative return; a full withdrawal leaves zero', () => {
    expect(investmentBalance([mv('deposit', 10000, '2026-01-01'), mv('balance', 9000, '2026-02-01')])).toMatchObject({ gain: -1000, gainPct: -0.1 })
    expect(investmentBalance([mv('deposit', 10000, '2026-01-01'), mv('balance', 10500, '2026-02-01'), mv('withdraw', 10500, '2026-02-02')]))
      .toMatchObject({ balance: 0, contributed: -500, gain: 500, gainPct: null })
  })
})

describe('monthMetrics', () => {
  const data = {
    members,
    meId: A,
    incomes: [
      { amount_cents: 500000, received_on: '2026-09-05' },
      { amount_cents: 80000, received_on: '2026-09-20' },
      { amount_cents: 1, received_on: '2026-10-01' },
    ],
    expenses: [personal(60000, A), house(200000, B, '2026-09-05'), house(9001, null, '2026-09-12')],
    investments: [{ id: 'i1' }, { id: 'i2' }],
    moves: [
      mv('deposit', 100000, '2026-08-10', 'i1'),
      mv('balance', 101000, '2026-08-31', 'i1'),
      mv('deposit', 50000, '2026-09-10', 'i1'),
      mv('deposit', 30000, '2026-09-15', 'i2'),
      mv('withdraw', 10000, '2026-09-20', 'i2'),
      mv('deposit', 7777, '2026-10-02', 'i2'), // after the month
    ],
  }

  it('entradas, saídas (pessoal + parte da casa), sobra, taxa, investido e patrimônio', () => {
    const r = monthMetrics({ month: '2026-09-01', ...data })
    expect(r.entradas).toBe(580000)
    expect(r.personal).toBe(60000)
    expect(r.house).toBe(100000 + 4500) // split-at-till: the rounding cent lands on the first member (A)
    expect(r.saidas).toBe(164500)
    expect(r.sobra).toBe(580000 - 164500)
    expect(r.savingsRate).toBeCloseTo((580000 - 164500) / 580000)
    expect(r.invested).toBe(50000 + 30000 - 10000)
    expect(r.patrimonio).toBe(101000 + 50000 + 20000)
  })

  it('no income: savings rate is null, not a division by zero', () => {
    const r = monthMetrics({ month: '2026-07-01', ...data })
    expect(r).toMatchObject({ entradas: 0, saidas: 0, sobra: 0, savingsRate: null, patrimonio: 0 })
  })

  it('12-month series ends at the chosen month, oldest first', () => {
    const s = monthlySeries({ endMonth: '2026-09-01', ...data })
    expect(s).toHaveLength(12)
    expect(s[0].month).toBe('2025-10-01')
    expect(s[11]).toMatchObject({ month: '2026-09-01', entradas: 580000, patrimonio: 171000 })
    expect(s[10]).toMatchObject({ month: '2026-08-01', patrimonio: 101000, entradas: 0 })
    // callers pass their whole view object, which may carry its own `month`; each point must still use its own
    expect(monthlySeries({ endMonth: '2026-09-01', ...data, month: '2026-09-01' })[10].entradas).toBe(0)
  })
})

describe('budgetUsage', () => {
  it('compares spending with each limit, flags overs, keeps unbudgeted spending', () => {
    const r = budgetUsage({
      budgets: [{ category_id: 'lazer', limit_cents: 30000 }, { category_id: 'pets', limit_cents: 10000 }],
      byCategory: { lazer: 45000, alimentacao: 20000 },
    })
    expect(r).toEqual([
      { category: 'lazer', spent: 45000, limit: 30000, pct: 1.5, over: true },
      { category: 'alimentacao', spent: 20000, limit: null, pct: null, over: false },
      { category: 'pets', spent: 0, limit: 10000, pct: 0, over: false },
    ])
  })
})
