// Daily / pace numbers for the Visão geral and Meu Espaço charts. Pure: no Supabase, no Vue.
// entries: [{ date: 'YYYY-MM-DD', cents, desc, routine }] already in the view's money (house total or my part);
// routine = false for installments and fixed-bill payments (they don't say anything about the daily pace).
import { addMonths, nextMonth, daysInMonth, monthOf } from './month.js'

const inMonth = (date, month) => date >= month && date < nextMonth(month)
const dayOf = (date) => Number(date.slice(8, 10))
const total = (rows) => rows.reduce((s, r) => s + r.cents, 0)
const median = (xs) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const k = s.length >> 1
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2
}

// One row per day of the month: { day, cents, items (biggest first) }.
export function dailyTotals(entries, month) {
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => ({ day: i + 1, cents: 0, items: [] }))
  for (const e of entries) {
    if (!e.cents || !inMonth(e.date, month)) continue
    const d = days[dayOf(e.date) - 1]
    d.cents += e.cents
    d.items.push(e)
  }
  for (const d of days) d.items.sort((a, b) => b.cents - a.cents)
  return days
}

export const cumulative = (days) => {
  let s = 0
  return days.map((d) => (s += d.cents))
}

// Routine spend per day. Window = the 3 previous months when all of them have data, else this month up to today.
// Outliers (one entry > 3x the window's median entry) are left out, like installments and bills.
export function routinePace(entries, month, todayDay) {
  const prev = [1, 2, 3].map((k) => addMonths(month, -k))
  const history = prev.every((m) => entries.some((e) => e.cents && inMonth(e.date, m)))
  const win = entries.filter((e) => e.cents && (history ? prev.some((m) => inMonth(e.date, m)) : inMonth(e.date, month) && dayOf(e.date) <= todayDay))
  const cap = 3 * median(win.map((e) => e.cents))
  const days = history ? prev.reduce((s, m) => s + daysInMonth(m), 0) : todayDay
  return { pace: days ? Math.round(total(win.filter((e) => e.routine && e.cents <= cap)) / days) : 0, basis: history ? '3m' : 'month' }
}

// Month-end estimate, only for the month holding `today`:
// spent so far + already dated later this month (+ extra, e.g. unpaid bills) + routine pace x remaining days.
export function projectMonth({ entries, month, today, extra = 0 }) {
  if (monthOf(today) !== month) return null
  const t = dayOf(today)
  const mine = entries.filter((e) => inMonth(e.date, month))
  const spent = total(mine.filter((e) => dayOf(e.date) <= t))
  const scheduled = total(mine.filter((e) => dayOf(e.date) > t)) + extra
  const { pace, basis } = routinePace(entries, month, t)
  const days = daysInMonth(month) - t
  return { today: t, spent, scheduled, pace, basis, days, total: spent + scheduled + pace * days }
}

// Months after `month` that already have spending (installments dated ahead), oldest first.
export function futureMonths(entries, month) {
  const by = {}
  for (const e of entries) if (e.cents && e.date >= nextMonth(month)) by[monthOf(e.date)] = (by[monthOf(e.date)] || 0) + e.cents
  return Object.keys(by).sort().map((m) => ({ month: m, cents: by[m] }))
}
