// Finanças pessoais do Meu Espaço (docs/spec.md, Fase 2). Pure: no Supabase, no Vue.
// Dates are 'YYYY-MM-DD' strings and months 'YYYY-MM-01', so plain string comparison orders them.
import { dueByMember } from './settlement.js'
import { addMonths, nextMonth } from './month.js'

const inMonth = (date, month) => date >= month && date < nextMonth(month)
const sum = (rows) => rows.reduce((s, r) => s + r.amount_cents, 0)

// My part of one house expense: same cents and rounding rule as the acerto.
export function myHouseShare(expense, members, meId) {
  return dueByMember(expense, members)[meId] ?? 0
}

// What I spent in the month: my personal expenses + my share of every house expense, also per category.
export function monthSpending({ month, expenses = [], members = [], meId }) {
  let personal = 0
  let house = 0
  const byCategory = {}
  for (const e of expenses) {
    if (!inMonth(e.spent_on, month)) continue
    let cents = 0
    if (e.scope === 'personal' && e.owner_id === meId) personal += cents = e.amount_cents
    else if (e.scope === 'house') house += cents = myHouseShare(e, members, meId)
    if (cents) byCategory[e.category_id] = (byCategory[e.category_id] || 0) + cents
  }
  return { personal, house, total: personal + house, byCategory }
}

// One investment's position from its moves, counting only moves before `before` (exclusive date; omit = all).
// Saldo = last 'balance' snapshot + deposits − withdrawals after it (no snapshot: deposits − withdrawals).
// Rendimento = saldo − aportado líquido; % over aportado líquido (null when nothing net was put in).
export function investmentBalance(moves = [], before) {
  const list = moves
    .filter((m) => !before || m.moved_on < before)
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.moved_on.localeCompare(b.m.moved_on) || (a.m.created_at || '').localeCompare(b.m.created_at || '') || a.i - b.i)
    .map(({ m }) => m)
  let contributed = 0
  let snapshot = null
  let sinceSnapshot = 0
  for (const m of list) {
    const delta = m.type === 'deposit' ? m.amount_cents : m.type === 'withdraw' ? -m.amount_cents : 0
    contributed += delta
    if (m.type === 'balance') {
      snapshot = m.amount_cents
      sinceSnapshot = 0
    } else sinceSnapshot += delta
  }
  const balance = snapshot == null ? contributed : snapshot + sinceSnapshot
  const gain = balance - contributed
  return { balance, contributed, gain, gainPct: contributed > 0 ? gain / contributed : null, hasSnapshot: snapshot != null }
}

// Every investment with its position at the end of `month` (omit = today, all moves).
export function portfolio(investments = [], moves = [], month) {
  const before = month && nextMonth(month)
  return investments.map((inv) => ({ ...inv, ...investmentBalance(moves.filter((m) => m.investment_id === inv.id), before) }))
}

export function monthMetrics({ month, incomes = [], expenses = [], moves = [], investments = [], members = [], meId }) {
  const entradas = sum(incomes.filter((i) => inMonth(i.received_on, month)))
  const spending = monthSpending({ month, expenses, members, meId })
  const sobra = entradas - spending.total
  const monthMoves = moves.filter((m) => inMonth(m.moved_on, month))
  const invested = sum(monthMoves.filter((m) => m.type === 'deposit')) - sum(monthMoves.filter((m) => m.type === 'withdraw'))
  const patrimonio = portfolio(investments, moves, month).reduce((s, p) => s + p.balance, 0)
  return {
    entradas,
    saidas: spending.total,
    personal: spending.personal,
    house: spending.house,
    byCategory: spending.byCategory,
    sobra,
    savingsRate: entradas > 0 ? sobra / entradas : null,
    invested,
    patrimonio,
  }
}

// Spending vs limit per category, for every category with a limit or with spending. Sorted by spent.
export function budgetUsage({ budgets = [], byCategory = {} }) {
  const limits = Object.fromEntries(budgets.map((b) => [b.category_id, b.limit_cents]))
  return [...new Set([...Object.keys(limits), ...Object.keys(byCategory)])]
    .map((category) => {
      const spent = byCategory[category] || 0
      const limit = limits[category] ?? null
      return { category, spent, limit, pct: limit ? spent / limit : null, over: limit != null && spent > limit }
    })
    .sort((a, b) => b.spent - a.spent || (b.limit || 0) - (a.limit || 0))
}

// The n months ending at endMonth (oldest first), for the Resumo charts.
export function monthlySeries({ endMonth, n = 12, ...data }) {
  return Array.from({ length: n }, (_, k) => {
    const month = addMonths(endMonth, k - n + 1)
    const m = monthMetrics({ ...data, month })
    return { month, entradas: m.entradas, saidas: m.saidas, sobra: m.sobra, patrimonio: m.patrimonio }
  })
}
