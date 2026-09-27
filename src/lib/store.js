import { reactive, computed } from 'vue'
import { supabase } from './supabase.js'
import { currentMonth, dueDate } from './month.js'

// Shared app state. Screens reload when `month` or `version` changes:
//   watch(() => [state.month, state.version], load, { immediate: true })
export const state = reactive({
  session: null,
  household: null,
  members: [], // [{ user_id, household_id, name, default_share_pct }]
  month: currentMonth(), // 'YYYY-MM-01'
  version: 0, // bumped after every write
  form: { open: false, expense: null, defaults: {} }, // global ExpenseForm modal (rendered by AppLayout)
  error: '', // session/household load error, shown on Login
})

export const me = computed(() => state.members.find((m) => m.user_id === state.session?.user?.id) || null)
export const partner = computed(() => state.members.find((m) => m.user_id !== state.session?.user?.id) || null)
export const memberName = (id) => state.members.find((m) => m.user_id === id)?.name || '—'

const must = ({ data, error }) => {
  if (error) throw error
  return data
}
const changed = (data) => {
  state.version++
  return data
}
const hh = () => state.household.id

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
    return
  }
  const mine = must(await supabase.from('members').select('*').eq('user_id', state.session.user.id).maybeSingle())
  if (!mine) throw new Error('Usuário sem casa cadastrada. Rode o supabase/seed.sql.')
  state.members = must(await supabase.from('members').select('*').order('name'))
  state.household = must(await supabase.from('households').select('*').eq('id', mine.household_id).single())
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
  return must(
    await supabase
      .from('expenses')
      .select('*')
      .gte('spent_on', start)
      .lt('spent_on', end)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false }),
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
    category: bill.category,
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
