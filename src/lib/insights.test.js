import { describe, it, expect } from 'vitest'
import { dailyTotals, cumulative, routinePace, projectMonth, futureMonths } from './insights.js'

const e = (date, cents, routine = true) => ({ date, cents, desc: 'x', routine })

describe('insights', () => {
  it('sums per day, biggest item first, and accumulates', () => {
    const days = dailyTotals([e('2026-10-01', 100), e('2026-10-01', 300), e('2026-10-03', 50), e('2026-11-01', 9)], '2026-10-01')
    expect(days).toHaveLength(31)
    expect(days[0].cents).toBe(400)
    expect(days[0].items[0].cents).toBe(300)
    expect(cumulative(days).slice(0, 3)).toEqual([400, 400, 450])
  })

  it('pace uses this month so far, without installments or outliers', () => {
    const rows = [e('2026-10-01', 100), e('2026-10-02', 100), e('2026-10-03', 100), e('2026-10-04', 5000), e('2026-10-02', 800, false)]
    expect(routinePace(rows, '2026-10-01', 4)).toEqual({ pace: 75, basis: 'month' })
  })

  it('pace switches to the 3 previous months once all have data', () => {
    const rows = [e('2026-07-05', 9200), e('2026-08-05', 9200), e('2026-09-05', 9200), e('2026-10-01', 1)]
    expect(routinePace(rows, '2026-10-01', 1)).toEqual({ pace: 300, basis: '3m' }) // 27600 / 92 days
  })

  it('projects spent + scheduled + pace x days left, only for the current month', () => {
    const rows = [e('2026-10-01', 800), e('2026-10-08', 800), e('2026-10-20', 1000, false)]
    const p = projectMonth({ entries: rows, month: '2026-10-01', today: '2026-10-08', extra: 500 })
    expect(p).toMatchObject({ spent: 1600, scheduled: 1500, pace: 200, days: 23, total: 1600 + 1500 + 200 * 23 })
    expect(projectMonth({ entries: rows, month: '2026-09-01', today: '2026-10-08' })).toBeNull()
  })

  it('lists future months with committed spending', () => {
    expect(futureMonths([e('2026-10-02', 1), e('2026-12-02', 5), e('2026-11-09', 3), e('2026-11-02', 4)], '2026-10-01'))
      .toEqual([{ month: '2026-11-01', cents: 7 }, { month: '2026-12-01', cents: 5 }])
  })
})
