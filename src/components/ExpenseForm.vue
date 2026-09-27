<script setup>
import { ref, computed } from 'vue'
import { state, me, addExpense, updateExpense } from '../lib/store.js'
import { parseBRL } from '../lib/money.js'
import { CATEGORIES } from '../lib/categories.js'
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
const category = ref(start.category || CATEGORIES[0].id)
const spentOn = ref(start.spent_on || (monthOf(today) === state.month ? today : state.month))
const scope = ref(start.scope || 'house')
// Personal = private to me (RLS enforces owner_id = paid_by = me), so only house expenses pick who paid.
const paidBy = ref(start.scope === 'personal' ? myId : start.paid_by || myId)
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

const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  const amount_cents = parseBRL(amount.value)
  if (!amount_cents || amount_cents <= 0) return (error.value = 'Informe um valor válido, ex: 12,50')
  const pct = Number(firstPct.value)
  if (useOverride.value && !(pct >= 0 && pct <= 100)) return (error.value = 'Percentual deve ficar entre 0 e 100')

  const house = scope.value === 'house'
  const row = {
    description: description.value.trim(),
    amount_cents,
    category: category.value,
    spent_on: spentOn.value,
    scope: scope.value,
    owner_id: house ? null : myId,
    paid_by: house ? paidBy.value : myId,
    share_pct: house && useOverride.value ? { [first.user_id]: pct, [second.user_id]: 100 - pct } : null, // null = DB uses the default
  }
  busy.value = true
  try {
    const saved = props.expense ? await updateExpense(props.expense.id, row) : await addExpense(row)
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
        <option v-for="c in CATEGORIES" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
    </label>

    <p v-if="scope === 'personal'" class="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
      <span class="material-symbols-outlined text-[18px] text-primary">lock</span>
      Gasto pessoal é privado: só você vê, e ele não entra no acerto da casa.
    </p>

    <fieldset v-else data-tour="paid-by" class="flex flex-col gap-1">
      <legend :class="label" class="mb-1">Quem pagou?</legend>
      <div class="flex gap-space-sm">
        <label v-for="m in state.members" :key="m.user_id" :class="chip(paidBy === m.user_id)">
          <input v-model="paidBy" type="radio" :value="m.user_id" class="sr-only" />{{ m.name }}
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
