<script setup>
import { ref, reactive, computed } from 'vue'
import { state, me, addExpense, addExpenses, updateExpense, updateInstallmentGroup, getExpenseCards, setExpenseCards, SPLIT_AT_TILL } from '../lib/store.js'
import { splitInstallments, installmentDate } from '../lib/cards.js'
import { parseBRL } from '../lib/money.js'
import { pickable } from '../lib/categories.js'
import { todayISO, monthOf, daysInMonth, dueDate } from '../lib/month.js'

// expense: row to edit (null = create). defaults: prefill for create, e.g. { scope: 'personal', owner_id }.
const props = defineProps({
  expense: { type: Object, default: null },
  defaults: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['saved', 'cancel'])

const start = { ...props.defaults, ...(props.expense || {}) }
const myId = me.value?.user_id
const today = todayISO()

const description = ref(start.description || '')
const amount = ref(start.amount_cents ? (start.amount_cents / 100).toFixed(2).replace('.', ',') : '')
const categoryOptions = computed(() => pickable('expense', start.category_id))
const category = ref(start.category_id || categoryOptions.value[0]?.id || '')
const spentOn = ref(start.spent_on || (monthOf(today) === state.month ? today : state.month))
const scope = ref(start.scope || 'house')
// Personal = private to me (RLS enforces owner_id = paid_by = me), so only house expenses pick who paid.
// null = "Dividido na hora": each paid their own part at the till (house only).
const paidBy = ref(start.scope === 'personal' || !('paid_by' in start) ? myId : start.paid_by)
const [first, second] = state.members
// Each house expense keeps the split it was saved with (the DB fills in the default on insert),
// so editing one shows and keeps its own split instead of the current default.
const editingHouse = !!props.expense && props.expense.scope === 'house'
const useOverride = ref(editingHouse)
const firstPct = ref(start.share_pct?.[first?.user_id] ?? first?.default_share_pct ?? 50)
const secondPct = computed(() => 100 - Number(firstPct.value || 0))
// A fixed-bill payment must stay inside its bill_month, or the bill would look unpaid there.
const billMonth = start.fixed_bill_id ? start.bill_month : null
const dateMin = billMonth
const dateMax = billMonth && dueDate(billMonth, daysInMonth(billMonth))

// Card of whoever paid: personal = mine; house = the payer's; split at the till = one per member ('' = cash / none).
// New entries start on each member's default card; editing loads the saved tags.
const cardsOf = (uid) => state.cards.filter((c) => c.user_id === uid)
const cardBy = reactive(props.expense ? {} : Object.fromEntries(state.members.map((m) => [m.user_id, cardsOf(m.user_id).find((c) => c.is_default)?.id || ''])))
if (props.expense) getExpenseCards(props.expense.id).then((t) => Object.assign(cardBy, t)).catch(() => {})
const payers = computed(() => {
  const ids = scope.value === 'personal' ? [myId] : paidBy.value === null ? state.members.map((m) => m.user_id) : [paidBy.value]
  // House shows the payer's select even without cards (empty); personal only when I have cards.
  return state.members.filter((m) => ids.includes(m.user_id) && (scope.value === 'house' || cardsOf(m.user_id).length))
})
// Installments: personal purchases only, set on creation (one row per month).
const installments = ref(1)
const group = props.expense?.installment_group

const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  const amount_cents = parseBRL(amount.value)
  if (!amount_cents || amount_cents <= 0) return (error.value = 'Informe um valor válido, ex: 12,50')
  if (!category.value) return (error.value = 'Escolha uma categoria (crie em Acerto & Metas → Categorias).')
  const pct = Number(firstPct.value)
  if (useOverride.value && !(pct >= 0 && pct <= 100)) return (error.value = 'Percentual deve ficar entre 0 e 100')

  const house = scope.value === 'house'
  const row = {
    description: description.value.trim(),
    amount_cents,
    category_id: category.value,
    spent_on: spentOn.value,
    scope: scope.value,
    owner_id: house ? null : myId,
    paid_by: house ? paidBy.value : myId,
    share_pct: house && useOverride.value ? { [first.user_id]: pct, [second.user_id]: 100 - pct } : null, // null = DB uses the default
  }
  const n = house || props.expense ? 1 : Number(installments.value)
  if (!(Number.isInteger(n) && n >= 1 && n <= 48)) return (error.value = 'Parcelas entre 1 e 48.')
  busy.value = true
  try {
    let saved, ids
    if (props.expense) {
      saved = await updateExpense(props.expense.id, row)
      ids = group ? await updateInstallmentGroup(group, { description: row.description, category_id: row.category_id }) : [saved.id]
    } else if (n > 1) {
      const installment_group = crypto.randomUUID()
      const rows = splitInstallments(amount_cents, n).map((cents, k) => ({
        ...row, amount_cents: cents, spent_on: installmentDate(row.spent_on, k), installment_group, installment_no: k + 1, installment_count: n,
      }))
      ids = (saved = await addExpenses(rows)).map((r) => r.id)
    } else ids = [(saved = await addExpense(row)).id]
    const byUser = Object.fromEntries(payers.value.map((m) => [m.user_id, cardBy[m.user_id] || '']))
    if (props.expense || Object.values(byUser).some(Boolean)) await setExpenseCards(ids, byUser)
    emit('saved', saved)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
const label = 'font-label-md text-label-md text-on-surface-variant'
const chip = (on) =>
  `flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-body-md cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
    on ? 'bg-primary-container text-on-primary-container font-semibold' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
  }`
</script>

<template>
  <form class="flex flex-col gap-space-md" @submit.prevent="submit">
    <div v-if="!billMonth" data-tour="scope" class="flex bg-surface-container rounded-lg p-1 gap-1">
      <button type="button" :class="chip(scope === 'house')" @click="scope = 'house'">
        <span class="material-symbols-outlined text-[18px]">home</span>Casa
      </button>
      <button type="button" :class="chip(scope === 'personal')" @click="scope = 'personal'">
        <span class="material-symbols-outlined text-[18px]">person</span>Pessoal
      </button>
    </div>

    <label class="flex flex-col gap-1">
      <span :class="label">Descrição</span>
      <input v-model="description" required maxlength="120" placeholder="Ex: Mercado, Farmácia" :class="input" />
    </label>

    <div class="grid grid-cols-2 gap-space-sm">
      <label class="flex flex-col gap-1">
        <span :class="label">Valor (R$)</span>
        <input v-model="amount" required inputmode="decimal" placeholder="0,00" :class="input" />
      </label>
      <label class="flex flex-col gap-1">
        <span :class="label">Data</span>
        <input v-model="spentOn" type="date" required :min="dateMin" :max="dateMax" :class="input" />
      </label>
    </div>

    <label class="flex flex-col gap-1">
      <span :class="label">Categoria</span>
      <select v-model="category" :class="input">
        <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ c.name }}{{ c.archived ? ' (arquivada)' : '' }}</option>
      </select>
    </label>

    <div v-if="scope === 'personal' && (payers.length || !expense)" class="grid grid-cols-2 gap-space-sm">
      <label v-for="m in payers" :key="m.user_id" class="flex flex-col gap-1 min-w-0" :class="{ 'col-span-2': expense }">
        <span :class="label" class="truncate">Cartão</span>
        <select v-model="cardBy[m.user_id]" :class="input">
          <option value="">Nenhum / dinheiro</option>
          <option v-for="c in cardsOf(m.user_id)" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label v-if="!expense" class="flex flex-col gap-1" :class="{ 'col-span-2': !payers.length }">
        <span :class="label">Parcelas</span>
        <input v-model="installments" type="number" min="1" max="48" required :class="input" />
      </label>
    </div>
    <p v-if="group" class="text-body-sm text-on-surface-variant">Parcela {{ expense.installment_no }}/{{ expense.installment_count }}: descrição, categoria e cartão mudam em todas; valor e data só nesta.</p>

    <p v-if="scope === 'personal'" class="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
      <span class="material-symbols-outlined text-[18px] text-primary">lock</span>
      Gasto pessoal é privado: só você vê, e ele não entra no acerto da casa.
    </p>

    <fieldset v-else data-tour="paid-by" class="flex flex-col gap-1">
      <legend :class="label" class="mb-1">Quem pagou?</legend>
      <div class="grid grid-cols-2 gap-space-sm">
        <label v-for="m in state.members" :key="m.user_id" :class="chip(paidBy === m.user_id)">
          <input v-model="paidBy" type="radio" :value="m.user_id" class="sr-only" /><span class="truncate">{{ m.name }}</span>
        </label>
        <label data-tour="split-at-till" :class="chip(paidBy === null)" class="col-span-2">
          <input v-model="paidBy" type="radio" :value="null" class="sr-only" />
          <span class="material-symbols-outlined text-[18px]">call_split</span><span class="truncate">{{ SPLIT_AT_TILL }}</span>
        </label>
      </div>
      <p v-if="paidBy === null" class="text-body-sm text-on-surface-variant">Cada um pagou a própria parte no caixa. Conta no total da casa, mas não mexe no acerto.</p>
      <div class="grid gap-space-sm mt-space-sm" :class="payers.length > 1 ? 'grid-cols-2' : 'grid-cols-1'">
        <label v-for="m in payers" :key="m.user_id" class="flex flex-col gap-1 min-w-0">
          <span :class="label" class="truncate">Cartão de {{ m.name }}</span>
          <select v-model="cardBy[m.user_id]" :disabled="!cardsOf(m.user_id).length" :class="input" class="disabled:opacity-60">
            <option value="">{{ cardsOf(m.user_id).length ? 'Nenhum / dinheiro' : 'Nenhum cartão cadastrado' }}</option>
            <option v-for="c in cardsOf(m.user_id)" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
      </div>
    </fieldset>

    <div v-if="scope === 'house' && second" data-tour="split" class="flex flex-col gap-space-sm rounded-lg bg-surface-container-low p-3">
      <span v-if="editingHouse" class="text-body-sm text-on-surface">Divisão deste gasto</span>
      <label v-else class="flex items-center gap-2 text-body-sm text-on-surface cursor-pointer">
        <input v-model="useOverride" type="checkbox" class="w-4 h-4 accent-primary" />
        Dividir diferente do padrão
      </label>
      <div v-if="useOverride" class="flex items-center gap-2 text-body-sm">
        <span class="truncate">{{ first.name }}</span>
        <input v-model="firstPct" :aria-label="`Parte de ${first.name} (%)`" type="number" min="0" max="100" step="1" class="w-20 rounded-lg border-0 bg-surface-container-lowest px-2 py-1.5 focus:ring-2 focus:ring-primary" />
        <span>%</span>
        <span class="ml-auto truncate text-on-surface-variant">{{ second.name }}: {{ secondPct }}%</span>
      </div>
    </div>

    <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>

    <div class="flex gap-space-sm justify-end">
      <button type="button" class="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg" @click="emit('cancel')">
        Cancelar
      </button>
      <button type="submit" :disabled="busy"
        class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60">
        <span class="material-symbols-outlined text-[18px]">{{ expense ? 'save' : 'add' }}</span>
        {{ busy ? 'Salvando…' : expense ? 'Salvar' : 'Adicionar' }}
      </button>
    </div>
  </form>
</template>
