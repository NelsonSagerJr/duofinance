import { reactive, computed } from 'vue'
import { supabase } from './supabase.js'
import { currentMonth, dueDate } from './month.js'

// Shared app state. Screens reload when `month` or `version` changes:
//   watch(() => [state.month, state.version], load, { immediate: true })
export const state = reactive({
  session: null,
  household: null,
  members: [], // [{ user_id, household_id, name, default_share_pct }]
  categories: [], // household list, see lib/categories.js
  cards: [], // credit cards of both members (0011: household reads, owner writes)
  month: currentMonth(), // 'YYYY-MM-01'
  version: 0, // bumped after every write
  form: { open: false, expense: null, defaults: {} }, // global ExpenseForm modal (rendered by AppLayout)
  feedbackOpen: false, // global FeedbackModal (rendered by AppLayout)
  error: '', // session/household load error, shown on Login
})

export const me = computed(() => state.members.find((m) => m.user_id === state.session?.user?.id) || null)
export const partner = computed(() => state.members.find((m) => m.user_id !== state.session?.user?.id) || null)
export const memberName = (id) => state.members.find((m) => m.user_id === id)?.name || '—'
// House expenses with paid_by null were split at the till (each paid their own part).
export const SPLIT_AT_TILL = 'Dividido na hora'
export const paidByLabel = (id) => (id ? memberName(id) : SPLIT_AT_TILL)

const must = ({ data, error }) => {
  if (error) throw error
  return data
}
const changed = (data) => {
  state.version++
  return data
}
const hh = () => state.household.id
// PostgREST caps a response at 1000 rows; the 12-month views can go past that, so page through.
async function all(query) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const page = must(await query().range(from, from + 999))
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

// Opens the modal in AppLayout. expense = row to edit (or null to create); defaults = prefilled fields.
export function openExpenseForm(expense = null, defaults = {}) {
  state.form = { open: true, expense, defaults }
}
export function closeExpenseForm() {
  state.form = { open: false, expense: null, defaults: {} }
}

// ---- auth ------------------------------------------------------------------
async function loadHousehold() {
  if (!state.session) {
    state.members = []
    state.household = null
    state.categories = []
    state.cards = []
    return
  }
  const mine = must(await supabase.from('members').select('*').eq('user_id', state.session.user.id).maybeSingle())
  if (!mine) throw new Error('Usuário sem casa cadastrada. Rode o supabase/seed.sql.')
  state.members = must(await supabase.from('members').select('*').order('name'))
  state.household = must(await supabase.from('households').select('*').eq('id', mine.household_id).single())
  await Promise.all([loadCategories(), loadCards()])
}

// ---- categories (shared by the household; lib/categories.js reads state.categories) ------------------------------
export async function loadCategories() {
  state.categories = must(await supabase.from('categories').select('*').order('sort').order('name'))
}

// c = { id?, kind, name, icon, color, archived? }. kind never changes after creation.
export async function saveCategory({ id, kind, name, icon, color, archived = false }) {
  if (id) must(await supabase.from('categories').update({ name, icon, color, archived }).eq('id', id))
  else {
    const sort = Math.max(-1, ...state.categories.filter((c) => c.kind === kind).map((c) => c.sort)) + 1
    must(await supabase.from('categories').insert({ kind, name, icon, color, sort }))
  }
  await loadCategories()
  changed()
}

// Swaps the sort of two categories of the same kind (the ↑/↓ buttons). Renumbers first: old rows may share a sort.
export async function swapCategories(a, b) {
  const list = state.categories.filter((c) => c.kind === a.kind)
  const ids = list.map((c) => c.id)
  const i = ids.indexOf(a.id)
  const j = ids.indexOf(b.id)
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  for (const c of list) {
    const sort = ids.indexOf(c.id)
    if (c.sort !== sort) must(await supabase.from('categories').update({ sort }).eq('id', c.id))
  }
  await loadCategories()
  changed()
}

// Moves the house rows and my own private rows to `toId`, then archives `fromId` (never deletes: see 0007).
export async function moveCategory(fromId, toId) {
  must(await supabase.rpc('move_category', { from_id: fromId, to_id: toId }))
  await loadCategories()
  changed()
}

let ready
// Resolves once; never rejects (errors go to state.error). Logged in = state.session && state.household.
export function loadSession() {
  ready ||= (async () => {
    try {
      state.session = must(await supabase.auth.getSession()).session
      await loadHousehold()
    } catch (e) {
      state.error = e.message
    }
    supabase.auth.onAuthStateChange((_event, session) => {
      const same = session?.user?.id === state.session?.user?.id
      state.session = session
      // setTimeout: supabase-js deadlocks if you await its calls inside this callback.
      if (!same) setTimeout(() => loadHousehold().catch((e) => (state.error = e.message)))
    })
  })()
  return ready
}

export async function signIn(email, password) {
  state.error = ''
  state.session = must(await supabase.auth.signInWithPassword({ email, password })).session
  await loadHousehold()
}

export async function signOut() {
  must(await supabase.auth.signOut())
  state.session = null
  await loadHousehold()
}

export async function updateMember(patch) {
  // patch: { name?, default_share_pct? } for the logged-in member. The % also sets the partner to 100 - pct.
  const { default_share_pct, ...rest } = patch
  if (Object.keys(rest).length) must(await supabase.from('members').update(rest).eq('user_id', me.value.user_id))
  if (default_share_pct != null) must(await supabase.rpc('set_default_share', { my_pct: default_share_pct }))
  state.members = must(await supabase.from('members').select('*').order('name'))
  changed()
}

// ---- expenses --------------------------------------------------------------
// range = monthRange(month) -> { start, end } (end exclusive)
export async function listExpenses({ start, end }) {
  return all(() =>
    supabase
      .from('expenses')
      .select('*')
      .gte('spent_on', start)
      .lt('spent_on', end)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id'),
  )
}

export async function addExpense(expense) {
  return changed(must(await supabase.from('expenses').insert({ ...expense, household_id: hh() }).select().single()))
}

export async function updateExpense(id, patch) {
  return changed(must(await supabase.from('expenses').update(patch).eq('id', id).select().single()))
}

export async function deleteExpense(id) {
  changed(must(await supabase.from('expenses').delete().eq('id', id)))
}

// ---- parcelas + cartões (0010; cards and tags are private to me) ------------------------------------------------
export async function addExpenses(rows) {
  return changed(must(await supabase.from('expenses').insert(rows.map((r) => ({ ...r, household_id: hh() }))).select()))
}

// Description/category apply to every installment of the purchase.
// Returns the group's expense ids.
export async function updateInstallmentGroup(group, patch) {
  return changed(must(await supabase.from('expenses').update(patch).eq('installment_group', group).select('id'))).map((r) => r.id)
}

export async function deleteInstallmentGroup(group) {
  changed(must(await supabase.from('expenses').delete().eq('installment_group', group)))
}

export async function loadCards() {
  state.cards = state.session ? must(await supabase.from('cards').select('*').order('archived').order('name')) : []
}

// card = { id?, name, closing_day, is_default? }. One default per user: clear the old one first (unique index).
export async function upsertCard(card) {
  if (card.is_default) must(await supabase.from('cards').update({ is_default: false }).eq('user_id', state.session.user.id).eq('is_default', true))
  must(await supabase.from('cards').upsert(card))
  await loadCards()
  changed()
}

// Removes the card and its tags; the expenses stay.
export async function deleteCard(id) {
  must(await supabase.from('cards').delete().eq('id', id))
  await loadCards()
  changed()
}

// Tags I can see: [{ expense_id, user_id, card_id }] (user_id = card owner). Mine anywhere + both on house expenses.
export async function listExpenseCards() {
  return all(() => supabase.from('expense_cards').select('expense_id, user_id, card_id').order('expense_id').order('user_id'))
}

// { [user_id]: card_id } for one expense.
export async function getExpenseCards(expenseId) {
  const rows = must(await supabase.from('expense_cards').select('user_id, card_id').eq('expense_id', expenseId))
  return Object.fromEntries(rows.map((r) => [r.user_id, r.card_id]))
}

// Replaces the tags of expenseIds with byUser = { [user_id]: card_id } (empty card_id = no card, e.g. cash).
export async function setExpenseCards(expenseIds, byUser) {
  must(await supabase.from('expense_cards').delete().in('expense_id', expenseIds))
  const rows = Object.entries(byUser).filter(([, card]) => card)
    .flatMap(([user_id, card_id]) => expenseIds.map((expense_id) => ({ expense_id, user_id, card_id })))
  if (rows.length) must(await supabase.from('expense_cards').insert(rows))
  changed()
}

// ---- fixed bills -----------------------------------------------------------
export async function listFixedBills() {
  return must(await supabase.from('fixed_bills').select('*').order('due_day').order('name'))
}

export async function upsertFixedBill(bill) {
  return changed(must(await supabase.from('fixed_bills').upsert({ ...bill, household_id: hh() }).select().single()))
}

export async function deleteFixedBill(id) {
  changed(must(await supabase.from('fixed_bills').delete().eq('id', id)))
}

// Paying a bill = a house expense tied to (fixed_bill_id, bill_month). spent_on = due date inside that month,
// so it always lands in that month's totals/settlement even when paid late.
export async function markBillPaid(bill, month, paidBy) {
  return addExpense({
    description: bill.name,
    amount_cents: bill.amount_cents,
    category_id: bill.category_id,
    scope: 'house',
    paid_by: paidBy,
    spent_on: dueDate(month, bill.due_day),
    fixed_bill_id: bill.id,
    bill_month: month,
  })
}

// ---- settlements -----------------------------------------------------------
export async function listSettlements(month) {
  return must(await supabase.from('settlements').select('*').eq('month', month).order('settled_at'))
}

// s = { month, from_id, to_id, amount_cents }
export async function addSettlement(s) {
  return changed(must(await supabase.from('settlements').insert({ ...s, household_id: hh() }).select().single()))
}

// ---- goals -----------------------------------------------------------------
// Each goal comes with goal_contributions: [...] and saved_cents (sum).
export async function listGoals() {
  const goals = must(await supabase.from('goals').select('*, goal_contributions(*)').order('created_at'))
  return goals.map((g) => ({ ...g, saved_cents: g.goal_contributions.reduce((s, c) => s + c.amount_cents, 0) }))
}

// goal = { id?, name, target_cents, deadline }
export async function upsertGoal(goal) {
  const { goal_contributions, saved_cents, ...row } = goal
  return changed(must(await supabase.from('goals').upsert({ ...row, household_id: hh() }).select().single()))
}

// c = { goal_id, member_id, amount_cents, contributed_on? }
export async function addContribution(c) {
  return changed(must(await supabase.from('goal_contributions').insert(c).select().single()))
}

// ---- Meu Espaço (private per user: RLS user_id = auth.uid(); user_id defaults to the caller) ----------------
// range = { start, end } (end exclusive), e.g. { start: addMonths(month, -11), end: nextMonth(month) }
export async function listIncomes({ start, end }) {
  return all(() =>
    supabase.from('incomes').select('*').gte('received_on', start).lt('received_on', end)
      .order('received_on', { ascending: false }).order('created_at', { ascending: false }).order('id'),
  )
}

// income = { id?, description, amount_cents, received_on, category_id }
export async function upsertIncome(income) {
  return changed(must(await supabase.from('incomes').upsert(income).select().single()))
}

export async function deleteIncome(id) {
  changed(must(await supabase.from('incomes').delete().eq('id', id)))
}

export async function listRecurringIncomes() {
  return must(await supabase.from('recurring_incomes').select('*').order('day').order('name'))
}

// r = { id?, name, amount_cents, day, category_id, active }
export async function upsertRecurringIncome(r) {
  return changed(must(await supabase.from('recurring_incomes').upsert(r).select().single()))
}

export async function deleteRecurringIncome(id) {
  changed(must(await supabase.from('recurring_incomes').delete().eq('id', id)))
}

// Receiving a fixed income = an income tied to (recurring_income_id, income_month), dated on its day in that month.
export async function markIncomeReceived(r, month) {
  return upsertIncome({
    description: r.name,
    amount_cents: r.amount_cents,
    category_id: r.category_id,
    received_on: dueDate(month, r.day),
    recurring_income_id: r.id,
    income_month: month,
  })
}

export async function listInvestments() {
  return must(await supabase.from('investments').select('*').order('archived').order('name'))
}

// inv = { id?, name, kind, archived? }
export async function upsertInvestment(inv) {
  return changed(must(await supabase.from('investments').upsert(inv).select().single()))
}

export async function deleteInvestment(id) {
  changed(must(await supabase.from('investments').delete().eq('id', id)))
}

// Every move (a balance needs the whole history); personal portfolios are small.
export async function listMoves() {
  return all(() => supabase.from('investment_moves').select('*').order('moved_on').order('created_at').order('id'))
}

// m = { investment_id, type: 'deposit'|'withdraw'|'balance', amount_cents, moved_on }
export async function addMove(m) {
  return changed(must(await supabase.from('investment_moves').insert(m).select().single()))
}

export async function deleteMove(id) {
  changed(must(await supabase.from('investment_moves').delete().eq('id', id)))
}

export async function listBudgets() {
  return must(await supabase.from('budgets').select('*'))
}

export async function upsertBudget(category_id, limit_cents) {
  return changed(must(await supabase.from('budgets')
    .upsert({ user_id: state.session.user.id, category_id, limit_cents }, { onConflict: 'user_id,category_id' }).select().single()))
}

export async function deleteBudget(category_id) {
  changed(must(await supabase.from('budgets').delete().eq('category_id', category_id)))
}

// ---- feedback (shared by the household; 0006_feedback.sql) ------------------------------------------------------
export async function listFeedback() {
  return must(await supabase.from('feedback').select('*').order('created_at', { ascending: false }))
}

// f = { route, element?, kind: 'bug'|'improvement'|'missing', message }. household/user come from DB defaults.
export async function addFeedback(f) {
  return changed(must(await supabase.from('feedback').insert(f).select().single()))
}

export async function setFeedbackStatus(id, status) {
  const resolved_at = status === 'resolved' ? new Date().toISOString() : null
  return changed(must(await supabase.from('feedback').update({ status, resolved_at }).eq('id', id).select().single()))
}

export async function deleteFeedback(id) {
  changed(must(await supabase.from('feedback').delete().eq('id', id)))
}
