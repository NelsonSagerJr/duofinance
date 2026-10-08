<script setup>
import { ref, computed, watch } from 'vue'
import { state, me, memberName, paidByLabel, openExpenseForm, listExpenses, listFixedBills, listSettlements, listGoals, deleteExpense } from '../lib/store.js'
import { monthLabel, dueDate, todayISO, addMonths, nextMonth, monthOf, daysInMonth } from '../lib/month.js'
import { formatBRL, formatBRLCompact, plural } from '../lib/money.js'
import { categoryById, chipClass } from '../lib/categories.js'
import { computeSettlement } from '../lib/settlement.js'
import { dailyTotals, cumulative, projectMonth } from '../lib/insights.js'
import ExpenseForm from '../components/ExpenseForm.vue'
import PaceChart from '../components/charts/PaceChart.vue'
import DonutChart from '../components/charts/DonutChart.vue'
import SpendCalendar from '../components/charts/SpendCalendar.vue'
import Ring from '../components/charts/Ring.vue'

const history = ref([]) // 3 months before the chosen one + it: feeds the pace / projection
const expenses = computed(() => history.value.filter((e) => e.spent_on >= loadedMonth.value))
const goals = ref([])
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
    const [e, b, s, g] = await Promise.all([listExpenses({ start: addMonths(month, -3), end: nextMonth(month) }), listFixedBills(), listSettlements(month), listGoals()])
    if (id !== req) return
    history.value = e
    goals.value = g
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

// ---- insights (house money only; partner's personal rows never reach here, and we skip personal anyway)
const today = todayISO()
const houseEntries = computed(() =>
  history.value.filter((e) => e.scope === 'house').map((e) => ({ date: e.spent_on, cents: e.amount_cents, desc: e.description, routine: !e.installment_group && !e.fixed_bill_id })),
)
const days = computed(() => dailyTotals(houseEntries.value, loadedMonth.value))
const isCurrent = computed(() => monthOf(today) === loadedMonth.value)
const upTo = computed(() => (isCurrent.value ? Number(today.slice(8, 10)) : loadedMonth.value < today ? daysInMonth(loadedMonth.value) : 0))
const cur = computed(() => cumulative(days.value).slice(0, upTo.value))
const prevMonth = computed(() => addMonths(loadedMonth.value, -1))
const prev = computed(() => {
  const c = cumulative(dailyTotals(houseEntries.value, prevMonth.value))
  return c[c.length - 1] ? c : null
})
const proj = computed(() => projectMonth({ entries: houseEntries.value, month: loadedMonth.value, today, extra: sum(pendingBills.value) }))
const vsPrev = computed(() => {
  const d = upTo.value
  const p = prev.value?.[Math.min(d, prev.value.length) - 1]
  return d && p ? (cur.value[d - 1] - p) / p : null
})
const short = (m) => new Date(m + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long' })
const byCategory = computed(() => {
  const by = {}
  for (const e of expenses.value) if (e.scope === 'house') by[e.category_id] = (by[e.category_id] || 0) + e.amount_cents
  return Object.entries(by).map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents)
})
// Who put the money down: paid_by gets the whole amount, "dividido na hora" counts each member's part.
const paidSplit = computed(() => {
  const t = settlement.value.total
  return t ? state.members.map((m) => ({ ...m, cents: settlement.value.perMember[m.user_id]?.paid || 0 })).map((m) => ({ ...m, pct: Math.round((m.cents / t) * 100) })) : []
})
// Shared goal: the nearest deadline still ahead, else the first one.
const goal = computed(() => {
  const g = goals.value.filter((x) => x.saved_cents < x.target_cents).sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'))[0] || goals.value[0]
  if (!g) return null
  const left = g.deadline ? Math.ceil((new Date(g.deadline + 'T12:00:00') - new Date(today + 'T12:00:00')) / 864e5) : null
  const months = left > 0 ? Math.max(1, Math.ceil(left / 30.44)) : null
  return { ...g, left, pct: g.target_cents ? g.saved_cents / g.target_cents : 0, perMonth: months && Math.max(0, Math.ceil((g.target_cents - g.saved_cents) / months)) }
})
const initial = (id) => memberName(id).slice(0, 1).toUpperCase()

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

const card = 'glass'
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
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-md md:gap-space-lg items-start">
      <!-- Hero: house total + pace of the month -->
      <section data-tour="stat-house" :class="card" class="lg:col-span-12 lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-space-xl lg:items-end">
        <div class="flex flex-col gap-2 min-w-0">
          <span class="eyebrow">Total da casa · {{ short(loadedMonth) }}</span>
          <span class="big-num">{{ formatBRL(settlement.total) }}</span>
          <div class="flex flex-wrap items-center gap-2">
            <span v-if="vsPrev != null" class="px-2.5 py-1 rounded-full font-label-md text-label-md font-semibold tabular-nums"
              :class="vsPrev > 0 ? 'bg-tertiary/10 text-tertiary' : 'bg-chart-in/10 text-chart-in'">
              {{ vsPrev > 0 ? '▲' : '▼' }} {{ Math.abs(Math.round(vsPrev * 100)) }}% vs. {{ short(prevMonth) }} no dia {{ upTo }}
            </span>
            <span class="text-body-sm text-on-surface-variant">{{ plural(expenses.filter((e) => e.scope === 'house').length, 'despesa', 'despesas') }}</span>
          </div>
          <p v-if="proj" class="text-body-sm text-on-surface-variant leading-relaxed">
            No ritmo atual, a casa fecha o mês em <strong class="text-on-surface tabular-nums">~{{ formatBRL(proj.total) }}</strong>:
            {{ formatBRL(proj.spent) }} gastos + {{ formatBRL(proj.scheduled) }} agendado + ~{{ formatBRL(proj.pace) }}/dia × {{ proj.days }} dias
            ({{ proj.basis === '3m' ? 'média do dia a dia dos últimos 3 meses' : 'média do dia a dia deste mês' }}, sem parcelas, contas fixas e gastos fora da curva).
            <template v-if="prev"> {{ short(prevMonth) }} fechou em {{ formatBRL(prev[prev.length - 1]) }}.</template>
          </p>
        </div>
        <div class="min-w-0 mt-space-md lg:mt-0">
          <div class="flex items-baseline justify-between gap-2 mb-1">
            <h2 class="font-headline-sm text-headline-sm text-on-surface">Ritmo do mês</h2>
            <span class="text-body-sm text-on-surface-variant">acumulado por dia</span>
          </div>
          <PaceChart v-if="cur.length && settlement.total" :cur="cur" :prev="prev" :proj="proj" :days="days.length" :cur-label="short(loadedMonth)" :prev-label="short(prevMonth)" />
          <p v-else class="text-body-md text-on-surface-variant py-space-md">Sem despesas da casa neste mês ainda. O ritmo aparece com o primeiro lançamento.</p>
        </div>
      </section>

      <!-- Settlement -->
      <section data-tour="overview-acerto" :class="card" class="glass-accent lg:col-span-4">
        <div class="flex items-center justify-between gap-2">
          <span class="eyebrow">Acerto do mês</span>
          <RouterLink to="/acerto" class="text-label-md text-primary hover:underline font-semibold flex items-center gap-1 shrink-0">
            Detalhes <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </RouterLink>
        </div>
        <template v-if="settlement.transfer">
          <div class="flex items-center gap-3" aria-hidden="true">
            <span class="w-11 h-11 rounded-full grid place-items-center font-bold bg-tertiary/15 text-tertiary">{{ initial(settlement.transfer.from_id) }}</span>
            <span class="flex-1 h-0.5 rounded bg-gradient-to-r from-tertiary to-chart-worth relative after:absolute after:-right-0.5 after:-top-[4px] after:border-l-8 after:border-l-chart-worth after:border-y-[5px] after:border-y-transparent"></span>
            <span class="w-11 h-11 rounded-full grid place-items-center font-bold bg-chart-worth/15 text-chart-worth">{{ initial(settlement.transfer.to_id) }}</span>
          </div>
          <span class="big-num !text-[32px]">{{ formatBRL(settlement.transfer.amount_cents) }}</span>
          <p class="text-body-md text-on-surface-variant">{{ memberName(settlement.transfer.from_id) }} transfere para {{ memberName(settlement.transfer.to_id) }}</p>
        </template>
        <p v-else-if="settlement.total" class="text-body-md text-on-surface">Contas do mês equilibradas. Ninguém deve nada.</p>
        <p v-else class="text-body-md text-on-surface-variant">Sem despesas da casa neste mês.</p>
        <div v-if="paidSplit.length">
          <div class="flex justify-between gap-2 text-body-sm text-on-surface-variant mb-1.5">
            <span>Quem pagou</span>
            <span class="tabular-nums">{{ paidSplit.map((m) => `${m.name} ${m.pct}%`).join(' · ') }}</span>
          </div>
          <div class="h-2 rounded-full bg-surface-container-highest overflow-hidden flex gap-0.5" role="img" :aria-label="paidSplit.map((m) => `${m.name} pagou ${formatBRL(m.cents)}`).join('; ')">
            <div v-for="(m, k) in paidSplit" :key="m.user_id" :style="{ width: m.pct + '%' }" :class="k ? 'bg-tertiary' : 'bg-chart-worth'" :title="`${m.name} pagou ${formatBRL(m.cents)}`"></div>
          </div>
        </div>
        <p v-if="settlement.settled" class="text-body-sm text-on-surface-variant">Já quitado neste mês: {{ formatBRL(settlement.settled) }}</p>
      </section>

      <!-- By category -->
      <section :class="card" class="lg:col-span-4">
        <span class="eyebrow">Por categoria</span>
        <DonutChart v-if="byCategory.length" :rows="byCategory" :sub="`casa · ${short(loadedMonth).slice(0, 3)}`" />
        <p v-else class="text-body-md text-on-surface-variant">Sem despesas da casa neste mês.</p>
      </section>

      <!-- Bills + my personal total -->
      <section data-tour="overview-upcoming" :class="card" class="lg:col-span-4">
        <div data-tour="stat-bills" class="flex flex-col gap-1">
          <div class="flex items-center justify-between gap-2">
            <span class="eyebrow">Contas fixas</span>
            <RouterLink to="/fixos" class="text-label-md text-primary hover:underline font-semibold shrink-0">Ver todas ({{ billRows.length }})</RouterLink>
          </div>
          <span class="font-numeric-stat text-numeric-stat text-on-surface tabular-nums">{{ formatBRL(sum(paidBills)) }}</span>
          <p v-if="!billRows.length" class="text-body-sm text-on-surface-variant">
            Nenhuma conta fixa cadastrada. <RouterLink to="/fixos" class="text-primary font-semibold hover:underline">Cadastrar</RouterLink>
          </p>
          <template v-else>
            <span class="text-body-sm text-on-surface-variant">{{ paidBills.length }} de {{ billRows.length }} pagas</span>
            <p v-if="!pendingBills.length" class="text-body-sm text-primary font-semibold">Todas as contas do mês estão pagas.</p>
            <ul v-else class="flex flex-col mt-1">
              <li v-for="b in pendingBills.slice(0, 5)" :key="b.id" class="flex items-center justify-between gap-3 py-1.5">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" :class="chipClass(categoryById(b.category_id))">
                    <span class="material-symbols-outlined text-[18px]">{{ categoryById(b.category_id).icon }}</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="font-label-lg text-label-lg text-on-surface truncate">{{ b.name }}</span>
                    <span class="font-body-sm text-body-sm" :class="b.overdue ? 'text-tertiary font-semibold' : 'text-on-surface-variant'">{{ b.overdue ? 'Venceu' : 'Vence' }} {{ ddmm(b.due) }}</span>
                  </div>
                </div>
                <span class="font-label-lg text-label-lg text-on-surface whitespace-nowrap tabular-nums">{{ formatBRL(b.amount_cents) }}</span>
              </li>
            </ul>
          </template>
        </div>
        <div data-tour="stat-personal" data-private class="flex flex-col gap-1 pt-space-md border-t border-outline-variant/30">
          <div class="flex items-center justify-between gap-2">
            <span class="eyebrow">Meus gastos pessoais</span>
            <span class="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-chart-worth/10 text-chart-worth flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">lock</span>privado</span>
          </div>
          <span class="font-numeric-stat text-numeric-stat text-on-surface tabular-nums">{{ formatBRL(myPersonal) }}</span>
          <span class="text-body-sm text-on-surface-variant">Fora do acerto. Só você vê.</span>
        </div>
      </section>

      <!-- Recent activity -->
      <section data-tour="overview-recent" :class="card" class="lg:col-span-7">
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="font-headline-sm text-headline-sm text-on-surface">Atividades recentes</h2>
          <span class="text-body-sm text-on-surface-variant">{{ short(loadedMonth) }}</span>
        </div>
        <p v-if="!recent.length" class="text-body-md text-on-surface-variant">Nenhum lançamento neste mês.</p>
        <ul v-else class="flex flex-col divide-y divide-outline-variant/30">
          <li v-for="e in recent" :key="e.id" :data-private="e.scope === 'personal' || null" class="flex items-center justify-between gap-2 py-2.5">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center shrink-0" :class="chipClass(categoryById(e.category_id))">
                <span class="material-symbols-outlined text-[18px]">{{ categoryById(e.category_id).icon }}</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-body-md text-body-md text-on-surface font-semibold truncate">{{ e.description }}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant break-words">{{ ddmm(e.spent_on) }} · {{ categoryById(e.category_id).name }} · {{ e.paid_by ? `Pago por ${memberName(e.paid_by)}` : paidByLabel(null) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <div class="text-right">
                <div class="font-label-lg text-label-lg text-on-surface whitespace-nowrap tabular-nums">{{ formatBRL(e.amount_cents) }}</div>
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

      <div class="lg:col-span-5 flex flex-col gap-space-md md:gap-space-lg min-w-0">
        <!-- Shared goal -->
        <section v-if="goal" :class="card">
          <span class="eyebrow">Meta compartilhada</span>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h2 class="font-headline-sm text-headline-sm text-on-surface truncate">{{ goal.name }}</h2>
              <p v-if="goal.deadline" class="text-body-sm text-on-surface-variant">prazo {{ ddmm(goal.deadline) }}/{{ goal.deadline.slice(0, 4) }}<template v-if="goal.left > 0"> · faltam {{ goal.left }} dias</template></p>
              <p class="mt-2 text-headline-sm font-bold tabular-nums text-on-surface">{{ formatBRL(goal.saved_cents) }} <span class="text-body-sm font-normal text-on-surface-variant">de {{ formatBRL(goal.target_cents) }}</span></p>
              <p v-if="goal.perMonth" class="text-body-sm text-on-surface-variant mt-1">Guardem <strong class="text-on-surface tabular-nums">{{ formatBRL(goal.perMonth) }}/mês</strong> para chegar lá.</p>
            </div>
            <Ring :value="goal.pct" color="chart-out" :size="104" :thick="10" :text="`${Math.round(goal.pct * 100)}%`" sub="guardado" />
          </div>
          <RouterLink to="/acerto" class="text-label-md text-primary hover:underline font-semibold">Ver metas</RouterLink>
        </section>

        <!-- Quick add -->
        <section data-tour="quick-add" :class="card">
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">add_circle</span> Lançamento rápido
          </h2>
          <ExpenseForm :key="`${state.month}-${formKey}`" @saved="formKey++" @cancel="formKey++" />
        </section>
      </div>

      <!-- Spend calendar -->
      <section :class="card" class="lg:col-span-12">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-headline-sm text-headline-sm text-on-surface">Calendário da casa · {{ short(loadedMonth) }}</h2>
          <span class="text-body-sm text-on-surface-variant">quanto a casa gastou em cada dia</span>
        </div>
        <SpendCalendar :month="loadedMonth" :days="days" :today="today" />
      </section>
    </div>
  </template>
</template>
