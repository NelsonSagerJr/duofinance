<script setup>
import { computed } from 'vue'
import { formatBRL, formatPct } from '../../lib/money.js'
import { monthLabel } from '../../lib/month.js'
import CashflowChart from '../charts/CashflowChart.vue'
import BudgetChart from '../charts/BudgetChart.vue'
import WorthChart from '../charts/WorthChart.vue'

const props = defineProps({ view: { type: Object, required: true } })
const emit = defineEmits(['go'])
const m = computed(() => props.view.metrics)
const hasHistory = computed(() => props.view.series.some((r) => r.entradas || r.saidas))
const hasWorth = computed(() => props.view.series.some((r) => r.patrimonio))
const empty = computed(() => !props.view.incomes.length && !props.view.investments.length && !hasHistory.value)

const card = 'bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-md min-w-0'
const kpi = 'bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-1 min-w-0'
const kpiValue = 'font-headline-md text-headline-md sm:font-numeric-stat sm:text-numeric-stat text-on-surface whitespace-nowrap truncate'
</script>

<template>
  <div v-if="empty" class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
    <span class="material-symbols-outlined text-[36px] text-primary">rocket_launch</span>
    <h2 class="font-headline-sm text-headline-sm text-on-surface">Comece pelo que entra</h2>
    <ol class="list-decimal pl-5 flex flex-col gap-1.5 text-body-md text-on-surface-variant marker:text-primary marker:font-semibold">
      <li>Em <b class="text-on-surface">Entradas</b>, cadastre seu salário como renda fixa e marque como recebida quando cair.</li>
      <li>Seus gastos pessoais e a sua parte das despesas da casa já contam como saídas.</li>
      <li>Em <b class="text-on-surface">Investimentos</b>, crie a carteira e registre aportes; em <b class="text-on-surface">Orçamento</b>, defina limites por categoria.</li>
    </ol>
    <button type="button" class="self-start inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg active:scale-95" @click="emit('go', 'entradas')">
      <span class="material-symbols-outlined text-[18px]">payments</span>Cadastrar entradas
    </button>
  </div>

  <div data-tour="my-kpis" class="grid grid-cols-2 lg:grid-cols-3 gap-3">
    <div :class="kpi">
      <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-chart-in">south_west</span>Entradas</span>
      <span :class="kpiValue">{{ formatBRL(m.entradas) }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant">recebido no mês</span>
    </div>
    <div :class="kpi">
      <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-chart-out">north_east</span>Saídas</span>
      <span :class="kpiValue">{{ formatBRL(m.saidas) }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant">{{ formatBRL(m.personal) }} pessoal · {{ formatBRL(m.house) }} parte da casa</span>
    </div>
    <div :class="kpi">
      <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-chart-net">savings</span>Sobra</span>
      <span :class="[kpiValue, m.sobra < 0 && 'text-tertiary']">{{ formatBRL(m.sobra) }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant">entradas − saídas</span>
    </div>
    <div :class="kpi">
      <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-primary">percent</span>Taxa de poupança</span>
      <span :class="kpiValue">{{ formatPct(m.savingsRate) }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant">{{ m.savingsRate == null ? 'sem entradas no mês' : 'da renda que sobrou' }}</span>
    </div>
    <div :class="kpi">
      <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-primary">add_card</span>Investido no mês</span>
      <span :class="kpiValue">{{ formatBRL(m.invested) }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant">aportes − resgates</span>
    </div>
    <div :class="kpi">
      <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-chart-worth">account_balance</span>Patrimônio</span>
      <span :class="kpiValue">{{ formatBRL(m.patrimonio) }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant">saldo dos investimentos</span>
    </div>
  </div>

  <section data-tour="chart-cashflow" :class="card">
    <div>
      <h2 class="font-headline-sm text-headline-sm text-on-surface">Entradas × saídas</h2>
      <p class="font-body-sm text-body-sm text-on-surface-variant">Últimos 12 meses até {{ monthLabel(view.month) }}, com a sobra de cada mês.</p>
    </div>
    <CashflowChart v-if="hasHistory" :rows="view.series" />
    <p v-else class="text-body-md text-on-surface-variant py-space-md">Sem entradas nem gastos nos últimos 12 meses. O gráfico aparece quando houver lançamentos.</p>
  </section>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-space-lg items-start">
    <section data-tour="chart-budget" :class="card">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h2 class="font-headline-sm text-headline-sm text-on-surface">Gastos por categoria</h2>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Pessoal + sua parte da casa, contra o limite do orçamento.</p>
        </div>
        <button type="button" class="shrink-0 text-label-md text-primary hover:underline font-semibold" @click="emit('go', 'orcamento')">Limites</button>
      </div>
      <BudgetChart v-if="view.budgetRows.length" :rows="view.budgetRows" />
      <p v-else class="text-body-md text-on-surface-variant py-space-md">Nenhum gasto nem limite neste mês. Defina limites na aba Orçamento.</p>
    </section>

    <section data-tour="chart-worth" :class="card">
      <div>
        <h2 class="font-headline-sm text-headline-sm text-on-surface">Evolução do patrimônio</h2>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Soma dos saldos dos investimentos no fim de cada mês.</p>
      </div>
      <WorthChart v-if="hasWorth" :rows="view.series" />
      <p v-else-if="view.investments.length" class="text-body-md text-on-surface-variant py-space-md">Sem saldo investido nos 12 meses até {{ monthLabel(view.month) }}.</p>
      <p v-else class="text-body-md text-on-surface-variant py-space-md">
        Nenhum investimento ainda.
        <button type="button" class="text-primary font-semibold hover:underline" @click="emit('go', 'investimentos')">Criar a carteira</button>
      </p>
    </section>
  </div>
</template>
