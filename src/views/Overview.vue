<script setup>
import { ref, computed, watch } from 'vue'
import { state, me, memberName, openExpenseForm, listExpenses, listFixedBills, listSettlements, deleteExpense } from '../lib/store.js'
import { monthRange, monthLabel, dueDate, todayISO } from '../lib/month.js'
import { formatBRL, plural } from '../lib/money.js'
import { categoryById } from '../lib/categories.js'
import { computeSettlement } from '../lib/settlement.js'
import ExpenseForm from '../components/ExpenseForm.vue'
import StatCard from '../components/Overview/StatCard.vue'

const expenses = ref([])
const bills = ref([])
const settlements = ref([])
const loadedMonth = ref(null)
const loading = ref(false)
const error = ref('')
const formKey = ref(0)

let req = 0
async function load() {
  const id = ++req
  const month = state.month
  loading.value = true
  error.value = ''
  try {
    const [e, b, s] = await Promise.all([listExpenses(monthRange(month)), listFixedBills(), listSettlements(month)])
    if (id !== req) return
    expenses.value = e
    bills.value = b
    settlements.value = s
    loadedMonth.value = month
  } catch (e) {
    if (id === req) error.value = e.message
  } finally {
    if (id === req) loading.value = false
  }
}
watch(() => [state.month, state.version], load, { immediate: true })

const settlement = computed(() => computeSettlement({ expenses: expenses.value, members: state.members, settlements: settlements.value }))

// Personal rows are private (RLS returns only mine), so this is just my own total.
const myPersonal = computed(() =>
  expenses.value.filter((e) => e.scope === 'personal' && e.owner_id === me.value?.user_id).reduce((s, e) => s + e.amount_cents, 0),
)

// Active bills with this month's status. Paid = a house expense for (bill, month) exists.
const billRows = computed(() => {
  const today = todayISO()
  return bills.value
    .filter((b) => b.active)
    .map((b) => {
      const due = dueDate(loadedMonth.value, b.due_day)
      const paid = expenses.value.some((e) => e.fixed_bill_id === b.id && e.bill_month === loadedMonth.value)
      return { ...b, due, paid, overdue: !paid && due < today }
    })
})
const paidBills = computed(() => billRows.value.filter((b) => b.paid))
const pendingBills = computed(() => billRows.value.filter((b) => !b.paid))
const sum = (rows) => rows.reduce((s, r) => s + r.amount_cents, 0)

const recent = computed(() => expenses.value.slice(0, 8))
const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

async function remove(e) {
  if (!confirm(`Excluir "${e.description}" (${formatBRL(e.amount_cents)})?`)) return
  try {
    await deleteExpense(e.id)
  } catch (err) {
    alert(`Não foi possível excluir: ${err.message}`)
  }
}

const card = 'bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-md min-w-0'
</script>

<template>
  <div class="flex flex-col gap-1">
    <h1 class="font-headline-lg text-headline-lg md:font-headline-xl md:text-headline-xl text-on-surface">Visão Geral</h1>
    <p class="font-body-md text-body-md text-on-surface-variant">{{ state.household?.name }} em {{ monthLabel(state.month) }}</p>
  </div>

  <div v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-4 py-3 flex items-center justify-between gap-2">
    <span class="text-body-md">Erro ao carregar: {{ error }}</span>
    <button type="button" class="font-label-lg text-label-lg underline shrink-0" @click="load">Tentar de novo</button>
  </div>

  <div v-if="loadedMonth !== state.month" class="flex items-center gap-2 text-on-surface-variant text-body-md py-space-xl justify-center">
    <template v-if="loading">
      <span class="material-symbols-outlined animate-spin">progress_activity</span> Carregando…
    </template>
  </div>

  <template v-else>
    <!-- KPI cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard data-tour="stat-house" label="Total da Casa" icon="receipt_long" :value="formatBRL(settlement.total)">
        {{ plural(expenses.filter((e) => e.scope === 'house').length, 'despesa da casa', 'despesas da casa') }} no mês
      </StatCard>
      <StatCard data-tour="stat-bills" label="Contas Fixas" icon="home_work" :value="formatBRL(sum(paidBills))">
        <template v-if="billRows.length">
          {{ paidBills.length }} de {{ billRows.length }} pagas ·
          <span :class="pendingBills.length ? 'text-tertiary' : 'text-primary'">{{ plural(pendingBills.length, 'pendente', 'pendentes') }} ({{ formatBRL(sum(pendingBills)) }})</span>
        </template>
        <template v-else>Nenhuma conta fixa cadastrada</template>
      </StatCard>
      <StatCard data-tour="stat-personal" label="Meus gastos pessoais" icon="lock" :value="formatBRL(myPersonal)">
        Só você vê · fora do acerto
      </StatCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-start">
      <div class="lg:col-span-2 flex flex-col gap-space-lg min-w-0">
        <!-- Settlement summary -->
        <section data-tour="overview-acerto" :class="card">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-headline-md text-headline-md text-on-surface">Acerto do Mês</h2>
            <RouterLink to="/acerto" class="text-label-md text-primary hover:underline font-semibold flex items-center gap-1 shrink-0">
              Detalhes <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </RouterLink>
          </div>
          <div class="flex items-start gap-2 px-3 py-3 rounded-lg bg-surface-container text-body-md text-on-surface">
            <span class="material-symbols-outlined text-[18px] text-primary">info</span>
            <span v-if="settlement.transfer" class="font-semibold">
              {{ memberName(settlement.transfer.from_id) }} transfere
              <span class="text-primary font-bold whitespace-nowrap">{{ formatBRL(settlement.transfer.amount_cents) }}</span>
              para {{ memberName(settlement.transfer.to_id) }}
            </span>
            <span v-else-if="settlement.total">Contas do mês equilibradas. Ninguém deve nada.</span>
            <span v-else>Sem despesas da casa neste mês.</span>
          </div>
          <p v-if="settlement.settled" class="text-body-sm text-on-surface-variant">Já quitado neste mês: {{ formatBRL(settlement.settled) }}</p>
        </section>

        <!-- Upcoming bills -->
        <section data-tour="overview-upcoming" :class="card">
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-col min-w-0">
              <h2 class="font-headline-md text-headline-md text-on-surface">Próximos Vencimentos</h2>
              <span class="font-body-sm text-body-sm text-on-surface-variant">Contas fixas ainda não pagas neste mês</span>
            </div>
            <RouterLink to="/fixos" class="text-label-md text-primary hover:underline font-semibold flex items-center gap-1 shrink-0">
              Ver todos ({{ billRows.length }}) <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </RouterLink>
          </div>
          <p v-if="!billRows.length" class="text-body-md text-on-surface-variant">
            Nenhuma conta fixa cadastrada. <RouterLink to="/fixos" class="text-primary font-semibold hover:underline">Cadastrar</RouterLink>
          </p>
          <p v-else-if="!pendingBills.length" class="text-body-md text-primary font-semibold">Todas as contas do mês estão pagas.</p>
          <ul v-else class="flex flex-col gap-space-xs">
            <li v-for="b in pendingBills.slice(0, 5)" :key="b.id" class="flex items-center justify-between gap-3 p-space-sm md:p-space-md rounded-xl hover:bg-surface-container-low transition-colors">
              <div class="flex items-center gap-space-md min-w-0">
                <div class="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0" :class="b.overdue ? 'text-tertiary' : 'text-primary'">
                  <span class="material-symbols-outlined text-[22px]">{{ categoryById(b.category).icon }}</span>
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="font-label-lg text-label-lg text-on-surface truncate">{{ b.name }}</span>
                  <span class="font-body-sm text-body-sm flex items-center gap-0.5" :class="b.overdue ? 'text-tertiary font-semibold' : 'text-on-surface-variant'">
                    <span class="material-symbols-outlined text-[14px]">event</span> Vence {{ ddmm(b.due) }}
                  </span>
                </div>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <span class="font-label-lg text-label-lg text-on-surface whitespace-nowrap">{{ formatBRL(b.amount_cents) }}</span>
                <span class="px-2 py-0.5 rounded-full font-label-sm text-label-sm" :class="b.overdue ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-secondary-fixed text-on-secondary-fixed-variant'">
                  {{ b.overdue ? 'Vencida' : 'Pendente' }}
                </span>
              </div>
            </li>
          </ul>
        </section>

        <!-- Recent activity -->
        <section data-tour="overview-recent" :class="card">
          <h2 class="font-headline-sm text-headline-sm text-on-surface">Atividades Recentes</h2>
          <p v-if="!recent.length" class="text-body-md text-on-surface-variant">Nenhum lançamento neste mês.</p>
          <ul v-else class="flex flex-col gap-space-sm">
            <li v-for="e in recent" :key="e.id" class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="hidden sm:flex w-8 h-8 rounded-full bg-surface-container items-center justify-center text-primary shrink-0">
                  <span class="material-symbols-outlined text-[18px]">{{ categoryById(e.category).icon }}</span>
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="font-body-md text-body-md text-on-surface font-semibold truncate">{{ e.description }}</span>
                  <span class="font-body-sm text-body-sm text-on-surface-variant break-words">{{ ddmm(e.spent_on) }} · Pago por {{ memberName(e.paid_by) }}</span>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <div class="text-right">
                  <div class="font-label-lg text-label-lg text-on-surface whitespace-nowrap">{{ formatBRL(e.amount_cents) }}</div>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">{{ e.scope === 'house' ? 'Casa' : 'Pessoal' }}</span>
                </div>
                <button type="button" :aria-label="`Editar ${e.description}`" class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" @click="openExpenseForm(e)">
                  <span class="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button type="button" :aria-label="`Excluir ${e.description}`" class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container" @click="remove(e)">
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <div class="flex flex-col gap-space-lg min-w-0">
        <!-- Quick add -->
        <section data-tour="quick-add" :class="card">
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">add_circle</span> Lançamento Rápido
          </h2>
          <ExpenseForm :key="`${state.month}-${formKey}`" @saved="formKey++" @cancel="formKey++" />
        </section>

      </div>
    </div>
  </template>
</template>
