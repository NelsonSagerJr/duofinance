<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state, me, listExpenses, listIncomes, listRecurringIncomes, listInvestments, listMoves, listBudgets, listExpenseCards } from '../lib/store.js'
import { addMonths, nextMonth, monthLabel } from '../lib/month.js'
import { monthMetrics, monthlySeries, budgetUsage, portfolio } from '../lib/personal.js'
import SummaryTab from '../components/Individual/SummaryTab.vue'
import IncomesTab from '../components/Individual/IncomesTab.vue'
import ExpensesTab from '../components/Individual/ExpensesTab.vue'
import InvestmentsTab from '../components/Individual/InvestmentsTab.vue'
import BudgetTab from '../components/Individual/BudgetTab.vue'

// Everything here is private to the logged-in user: RLS returns only my incomes, investments, budgets and
// personal expenses (house expenses are shared, and only my share of them is used).
const TABS = [
  { id: 'resumo', label: 'Resumo', icon: 'insights' },
  { id: 'entradas', label: 'Entradas', icon: 'payments' },
  { id: 'gastos', label: 'Gastos', icon: 'shopping_bag' },
  { id: 'investimentos', label: 'Investimentos', icon: 'savings' },
  { id: 'orcamento', label: 'Orçamento', icon: 'donut_small' },
]
const route = useRoute()
const router = useRouter()
// Tab lives in the URL (?tab=...) so reload and the back button keep it.
const tab = computed({
  get: () => (TABS.some((t) => t.id === route.query.tab) ? route.query.tab : 'resumo'),
  set: (id) => router.replace({ query: { ...route.query, tab: id } }),
})

const data = ref(null) // last loaded snapshot; kept on screen (dimmed) while the next one loads
const loading = ref(true)
const error = ref('')

let req = 0
async function load() {
  const id = ++req
  const month = state.month
  loading.value = true
  error.value = ''
  try {
    // 12 months back from the chosen month feed the charts; moves need the whole history for balances.
    const range = { start: addMonths(month, -11), end: nextMonth(month) }
    // Expenses 12 months further: next month's card invoice holds purchases from it, and the Resumo lists installments already committed ahead.
    const [expenses, incomes, recurring, investments, moves, budgets, expenseCards] = await Promise.all([
      listExpenses({ ...range, end: addMonths(month, 13) }), listIncomes(range), listRecurringIncomes(), listInvestments(), listMoves(), listBudgets(), listExpenseCards(),
    ])
    if (id === req) data.value = { month, expenses, incomes, recurring, investments, moves, budgets, expenseCards }
  } catch (e) {
    if (id === req) error.value = e.message || 'Erro ao carregar.'
  } finally {
    if (id === req) loading.value = false
  }
}
watch(() => [state.month, state.version], load, { immediate: true })

const view = computed(() => {
  const d = data.value
  if (!d) return null
  const base = { ...d, members: state.members, meId: me.value?.user_id }
  const metrics = monthMetrics({ ...base, month: d.month })
  return {
    ...base,
    metrics,
    series: monthlySeries({ ...base, endMonth: d.month }),
    budgetRows: budgetUsage({ budgets: d.budgets, byCategory: metrics.byCategory }),
    portfolio: portfolio(d.investments, d.moves, d.month),
  }
})
const stale = computed(() => loading.value && data.value && data.value.month !== state.month)
</script>

<template>
  <!-- data-private: feedback "apontar na tela" records only the area name here, never values -->
  <div data-private class="flex flex-col w-full gap-space-lg min-w-0">
    <div data-tour="personal-header" class="flex flex-col gap-1 bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
      <h1 class="font-headline-sm text-headline-sm text-on-surface">Meu Espaço</h1>
      <p class="font-body-sm text-body-sm text-on-surface-variant flex items-start gap-1">
        <span class="material-symbols-outlined text-[16px]">lock</span>
        Suas finanças de {{ monthLabel(state.month) }}: entradas, gastos, investimentos e orçamento. Só você vê esta tela.
      </p>
    </div>

    <div role="tablist" aria-label="Seções do Meu Espaço" data-tour="personal-tabs"
      class="flex gap-1 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button v-for="t in TABS" :key="t.id" type="button" role="tab" :aria-selected="tab === t.id" :data-tour="`tab-${t.id}`"
        class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full font-label-lg text-label-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="tab === t.id ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface shadow-sm'"
        @click="tab = t.id">
        <span class="material-symbols-outlined text-[18px]">{{ t.icon }}</span>{{ t.label }}
      </button>
    </div>

    <div v-if="error" role="alert" class="bg-error-container text-on-error-container p-space-md rounded-xl font-body-md text-body-md flex items-center justify-between gap-space-md">
      <span>{{ error }}</span>
      <button type="button" class="font-label-lg text-label-lg underline shrink-0" @click="load">Tentar de novo</button>
    </div>

    <div v-if="!view" class="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm text-on-surface-variant font-body-md text-body-md">Carregando…</div>

    <div v-else role="tabpanel" class="flex flex-col gap-space-lg min-w-0 transition-opacity" :class="{ 'opacity-50 pointer-events-none': stale }" :aria-busy="stale">
      <SummaryTab v-if="tab === 'resumo'" :view="view" @go="tab = $event" />
      <IncomesTab v-else-if="tab === 'entradas'" :view="view" />
      <ExpensesTab v-else-if="tab === 'gastos'" :view="view" />
      <InvestmentsTab v-else-if="tab === 'investimentos'" :view="view" />
      <BudgetTab v-else :view="view" />
    </div>
  </div>
</template>
