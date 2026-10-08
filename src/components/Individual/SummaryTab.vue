<script setup>
import { computed } from 'vue'
import { state } from '../../lib/store.js'
import { formatBRL, formatBRLCompact, formatPct } from '../../lib/money.js'
import { monthLabel, addMonths, dueDate, todayISO, monthOf, daysInMonth } from '../../lib/month.js'
import { categoryById } from '../../lib/categories.js'
import { myHouseShare } from '../../lib/personal.js'
import { invoiceMonth, cardAmount } from '../../lib/cards.js'
import { dailyTotals, cumulative, projectMonth, futureMonths } from '../../lib/insights.js'
import CashflowChart from '../charts/CashflowChart.vue'
import WorthChart from '../charts/WorthChart.vue'
import PaceChart from '../charts/PaceChart.vue'
import SpendCalendar from '../charts/SpendCalendar.vue'
import Ring from '../charts/Ring.vue'
import { shortMonth } from '../charts/chart.js'

const props = defineProps({ view: { type: Object, required: true } })
const emit = defineEmits(['go'])
const m = computed(() => props.view.metrics)
const hasHistory = computed(() => props.view.series.some((r) => r.entradas || r.saidas))
const hasWorth = computed(() => props.view.series.some((r) => r.patrimonio))
const empty = computed(() => !props.view.incomes.length && !props.view.investments.length && !hasHistory.value)
// 12-month flow starts at the first month with any data, so sparse history doesn't draw 11 empty months.
const flowRows = computed(() => props.view.series.slice(Math.max(0, props.view.series.findIndex((r) => r.entradas || r.saidas))))

const today = todayISO()
const month = computed(() => props.view.month)
const long = (mo) => new Date(mo + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long' })
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

// My money per expense: my personal rows + my share of house rows.
const myCents = (e) => {
  const { members, meId } = props.view
  return e.scope === 'personal' ? (e.owner_id === meId ? e.amount_cents : 0) : myHouseShare(e, members, meId)
}
const entries = computed(() =>
  props.view.expenses.map((e) => ({ date: e.spent_on, cents: myCents(e), desc: e.description, routine: !e.installment_group && !e.fixed_bill_id })).filter((e) => e.cents),
)
const days = computed(() => dailyTotals(entries.value, month.value))
const upTo = computed(() => (monthOf(today) === month.value ? Number(today.slice(8, 10)) : month.value < today ? daysInMonth(month.value) : 0))
const cur = computed(() => cumulative(days.value).slice(0, upTo.value))
const prev = computed(() => {
  const c = cumulative(dailyTotals(entries.value, addMonths(month.value, -1)))
  return c[c.length - 1] ? c : null
})
const proj = computed(() => projectMonth({ entries: entries.value, month: month.value, today }))
const future = computed(() => futureMonths(entries.value, month.value).slice(0, 6))
const futureMax = computed(() => Math.max(1, ...future.value.map((f) => f.cents)))

// Saídas split for the stacked bar.
const outTotal = computed(() => Math.max(1, m.value.entradas, m.value.saidas))

// Category rings: budget usage where a limit exists, else share of the month's spending.
const rings = computed(() => props.view.budgetRows.filter((r) => r.spent || r.limit))

// My cards: the invoice open today (or the one closing in the chosen month, for other months), paced by day.
const cards = computed(() => {
  const { expenses, expenseCards, members, meId } = props.view
  const tag = new Map(expenseCards.filter((t) => t.user_id === meId).map((t) => [t.expense_id, t.card_id]))
  return state.cards.filter((c) => c.user_id === meId && !c.archived).map((c) => {
    const open = monthOf(today) === month.value ? invoiceMonth(today, c.closing_day) : month.value
    const by = {}
    const items = []
    for (const e of expenses) {
      if (tag.get(e.id) !== c.id) continue
      const inv = invoiceMonth(e.spent_on, c.closing_day)
      const cents = cardAmount(e, myHouseShare(e, members, meId))
      by[inv] = (by[inv] || 0) + cents
      if (inv === open) items.push({ date: e.spent_on, cents, desc: e.description })
    }
    const start = dueDate(addMonths(open, -1), c.closing_day)
    const closes = dueDate(open, c.closing_day)
    const len = Math.round((new Date(closes) - new Date(start)) / 864e5)
    // Previous closed invoices with data (up to 6) give the average line; none = no line.
    const past = [1, 2, 3, 4, 5, 6].map((k) => by[addMonths(open, -k)]).filter(Boolean)
    items.sort((a, b) => a.date.localeCompare(b.date))
    let s = 0
    const pts = [[0, 0], ...items.map((i) => [Math.max(0, Math.round((new Date(i.date) - new Date(start)) / 864e5)), (s += i.cents)])]
    const now = Math.min(len, Math.max(0, Math.round((new Date(today) - new Date(start)) / 864e5)))
    return { ...c, open, closes, len, now, total: by[open] || 0, prevTotal: by[addMonths(open, -1)] || 0, prevCloses: start, avg: past.length ? Math.round(past.reduce((a, b) => a + b, 0) / past.length) : null, pastN: past.length, pts, items }
  })
})
const W = 300
const HH = 90
const cx = (c, d) => 4 + (d / c.len) * (W - 8)
const cy = (c, v) => HH - 6 - (v / Math.max(1, c.total, c.avg || 0)) * (HH - 18)
const cardLine = (c) => c.pts.map(([d, v], i) => `${i ? `L${cx(c, d)},${cy(c, c.pts[i - 1][1])} ` : 'M'}${cx(c, d)},${cy(c, v)}`).join(' ') + ` L${cx(c, c.now)},${cy(c, c.total)}`

const card = 'glass'
</script>

<template>
  <div v-if="empty" :class="card">
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

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-md md:gap-space-lg">
    <!-- Hero: sobra, savings ring, in/out/invested -->
    <section data-tour="my-kpis" :class="card" class="lg:col-span-12">
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-space-lg">
        <div class="flex flex-col gap-space-md min-w-0">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <span class="eyebrow">Meu Espaço · Resumo · privado</span>
              <div class="big-num" :class="m.sobra < 0 ? '!text-tertiary' : '!text-chart-in'">{{ m.sobra > 0 ? '+' : '' }}{{ formatBRL(m.sobra) }}</div>
              <p class="text-body-sm text-on-surface-variant">{{ m.sobra < 0 ? 'faltou' : 'sobrou' }} em {{ long(month) }}{{ upTo && monthOf(today) === month ? ' até agora' : '' }}</p>
            </div>
            <Ring v-if="m.savingsRate != null" :value="Math.max(0, m.savingsRate)" color="chart-in" :size="104" :thick="11" :text="formatPct(m.savingsRate)" sub="poupança" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-body-sm text-on-surface-variant">Entradas</span>
              <span class="font-headline-sm text-headline-sm font-bold tabular-nums text-on-surface whitespace-nowrap">{{ formatBRL(m.entradas) }}</span>
              <div class="h-2 rounded-full bg-surface-container-highest overflow-hidden"><div class="h-full bg-chart-in rounded-full" :style="{ width: (m.entradas / outTotal) * 100 + '%' }"></div></div>
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-body-sm text-on-surface-variant">Saídas</span>
              <span class="font-headline-sm text-headline-sm font-bold tabular-nums text-on-surface whitespace-nowrap">{{ formatBRL(m.saidas) }}</span>
              <div class="h-2 rounded-full bg-surface-container-highest overflow-hidden flex gap-0.5" role="img" :aria-label="`${formatBRL(m.personal)} pessoal, ${formatBRL(m.house)} parte da casa`">
                <div class="h-full bg-chart-out" :style="{ width: (m.personal / outTotal) * 100 + '%' }"></div>
                <div class="h-full bg-chart-net" :style="{ width: (m.house / outTotal) * 100 + '%' }"></div>
              </div>
              <span class="text-label-md text-on-surface-variant flex flex-wrap gap-x-2"><span><i class="inline-block w-2 h-2 rounded-full bg-chart-out mr-1"></i>pessoal {{ formatBRL(m.personal) }}</span><span><i class="inline-block w-2 h-2 rounded-full bg-chart-net mr-1"></i>casa {{ formatBRL(m.house) }}</span></span>
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <span class="text-body-sm text-on-surface-variant">Investido · Patrimônio</span>
              <span class="font-headline-sm text-headline-sm font-bold tabular-nums text-on-surface">{{ formatBRLCompact(m.invested) }} · {{ formatBRLCompact(m.patrimonio) }}</span>
              <button v-if="!view.investments.length" type="button" class="self-start text-label-md text-primary font-semibold hover:underline" @click="emit('go', 'investimentos')">Criar a carteira</button>
            </div>
          </div>
        </div>
        <div class="min-w-0">
          <div class="flex items-baseline justify-between gap-2 mb-1">
            <h2 class="font-headline-sm text-headline-sm text-on-surface">Ritmo do mês</h2>
            <span class="text-body-sm text-on-surface-variant">pessoal + minha parte da casa</span>
          </div>
          <PaceChart v-if="cur.length && cur[cur.length - 1]" :cur="cur" :prev="prev" :proj="proj" :days="days.length" :cur-label="long(month)" :prev-label="long(addMonths(month, -1))" />
          <p v-else class="text-body-md text-on-surface-variant py-space-md">Sem gastos neste mês ainda.</p>
          <p v-if="proj && cur.length" class="text-body-sm text-on-surface-variant mt-1">
            Projeção ~<strong class="text-on-surface tabular-nums">{{ formatBRL(proj.total) }}</strong> = {{ formatBRL(proj.spent) }} gastos + {{ formatBRL(proj.scheduled) }} agendado + ~{{ formatBRL(proj.pace) }}/dia × {{ proj.days }} dias
            ({{ proj.basis === '3m' ? 'média do dia a dia dos últimos 3 meses' : 'média do dia a dia deste mês' }}, sem parcelas, contas fixas e gastos fora da curva).
          </p>
        </div>
      </div>
    </section>

    <!-- 12-month flow -->
    <section data-tour="chart-cashflow" :class="card" class="lg:col-span-8">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-headline-sm text-headline-sm text-on-surface">Fluxo de {{ flowRows.length === 1 ? '1 mês' : `${flowRows.length} meses` }}</h2>
        <span class="text-body-sm text-on-surface-variant">{{ shortMonth(flowRows[0].month) }} a {{ shortMonth(view.month) }}</span>
      </div>
      <template v-if="hasHistory">
        <CashflowChart :rows="flowRows" />
        <p v-if="flowRows.length < 3" class="text-body-sm text-on-surface-variant">O histórico começa em {{ monthLabel(flowRows[0].month) }}; os meses seguintes entram aqui conforme você lança.</p>
      </template>
      <p v-else class="text-body-md text-on-surface-variant py-space-md">Sem entradas nem gastos nos últimos 12 meses. O gráfico aparece quando houver lançamentos.</p>
    </section>

    <!-- Cards + installments ahead -->
    <section :class="card" class="lg:col-span-4">
      <template v-for="c in cards" :key="c.id">
        <div class="flex flex-col gap-1">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="font-headline-sm text-headline-sm text-on-surface truncate">Cartão {{ c.name }}</h2>
            <span class="text-body-sm text-on-surface-variant shrink-0">fecha dia {{ c.closing_day }}</span>
          </div>
          <span class="text-body-sm text-on-surface-variant">Fatura {{ c.closes > today ? 'aberta' : 'fechada' }} · fecha {{ dm(c.closes) }}</span>
          <span class="font-headline-md text-headline-md font-bold tabular-nums text-on-surface">{{ formatBRL(c.total) }}</span>
          <svg :viewBox="`0 0 ${W} ${HH}`" class="w-full h-auto block overflow-visible" role="img" :aria-label="`Fatura de ${dm(c.closes)}: ${formatBRL(c.total)} acumulado${c.avg ? `, média das anteriores ${formatBRL(c.avg)}` : ''}`">
            <line :x1="4" :x2="W - 4" :y1="cy(c, 0)" :y2="cy(c, 0)" class="stroke-outline-variant" />
            <template v-if="c.avg">
              <line :x1="cx(c, 0)" :y1="cy(c, 0)" :x2="cx(c, c.len)" :y2="cy(c, c.avg)" class="stroke-on-surface-variant" stroke-dasharray="3 4" />
              <text :x="W - 4" :y="cy(c, c.avg) - 6" text-anchor="end" class="fill-on-surface-variant" font-size="10">média {{ formatBRLCompact(c.avg) }}</text>
            </template>
            <path :d="`${cardLine(c)} L${cx(c, c.now)},${cy(c, 0)} L${cx(c, 0)},${cy(c, 0)} Z`" class="fill-chart-out/15" />
            <path :d="cardLine(c)" fill="none" class="stroke-chart-out" stroke-width="2.5" stroke-linejoin="round" />
            <circle :cx="cx(c, c.now)" :cy="cy(c, c.total)" r="4" class="fill-chart-out"><title>Dia {{ c.now }} do ciclo: {{ formatBRL(c.total) }}</title></circle>
          </svg>
          <p class="text-label-md text-on-surface-variant">{{ c.avg ? `Tracejado: ritmo para fechar na média das ${c.pastN} faturas anteriores.` : 'A linha de média aparece quando houver faturas anteriores.' }}</p>
          <div v-if="c.prevTotal" class="flex justify-between gap-2 text-body-sm pt-2 border-t border-outline-variant/30">
            <span class="text-on-surface-variant">Fatura fechada {{ dm(c.prevCloses) }}</span><strong class="tabular-nums text-on-surface">{{ formatBRL(c.prevTotal) }}</strong>
          </div>
          <details v-if="c.items.length" class="text-body-sm">
            <summary class="cursor-pointer text-primary font-label-md text-label-md w-fit">Ver em tabela</summary>
            <table class="w-full mt-2 text-left tabular-nums">
              <tbody class="divide-y divide-outline-variant/30">
                <tr v-for="(i, k) in c.items" :key="k"><td class="py-1 pr-2">{{ dm(i.date) }}</td><td class="py-1 pr-2 break-words">{{ i.desc }}</td><td class="py-1 text-right whitespace-nowrap">{{ formatBRL(i.cents) }}</td></tr>
              </tbody>
            </table>
          </details>
        </div>
      </template>
      <p v-if="!cards.length" class="text-body-md text-on-surface-variant">Nenhum cartão cadastrado. <button type="button" class="text-primary font-semibold hover:underline" @click="emit('go', 'gastos')">Cadastrar em Gastos</button></p>

      <div class="pt-space-md border-t border-outline-variant/30">
        <span class="eyebrow block mb-2">Parcelas já comprometidas</span>
        <p v-if="!future.length" class="text-body-sm text-on-surface-variant">Nada lançado para os próximos meses.</p>
        <ul v-else class="flex flex-col gap-2" :aria-label="'Já comprometido nos próximos meses'">
          <li v-for="f in future" :key="f.month" class="flex items-center gap-2.5">
            <span class="w-8 text-body-sm text-on-surface-variant">{{ shortMonth(f.month) }}</span>
            <span class="flex-1 h-2.5 rounded-full bg-surface-container-highest overflow-hidden"><span class="block h-full rounded-full bg-gradient-to-r from-chart-net to-chart-worth" :style="{ width: (f.cents / futureMax) * 100 + '%' }"></span></span>
            <span class="w-24 text-right text-body-sm font-semibold tabular-nums text-on-surface">{{ formatBRL(f.cents) }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- Spend calendar -->
    <section :class="card" class="lg:col-span-12">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-headline-sm text-headline-sm text-on-surface">Meus gastos por dia · {{ long(month) }}</h2>
        <span class="text-body-sm text-on-surface-variant">pessoal + minha parte da casa</span>
      </div>
      <SpendCalendar :month="month" :days="days" :today="today" />
    </section>

    <!-- Category rings -->
    <section data-tour="chart-budget" :class="card" class="lg:col-span-12">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-headline-sm text-headline-sm text-on-surface">Gastos por categoria</h2>
        <button type="button" class="text-label-md text-primary hover:underline font-semibold" @click="emit('go', 'orcamento')">Limites</button>
      </div>
      <p class="text-body-sm text-on-surface-variant -mt-2">Pessoal + casa. Anel = parte do limite usada; sem limite, parte do total do mês.</p>
      <ul v-if="rings.length" class="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        <li v-for="r in rings" :key="r.category" tabindex="0" class="rounded-2xl border border-outline-variant/40 bg-surface-container-low/60 p-3 flex flex-col items-center gap-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :aria-label="`${categoryById(r.category).name}: ${formatBRL(r.spent)}${r.limit ? ` de ${formatBRL(r.limit)}` : ', sem limite'}`"
          :title="r.limit ? (r.over ? `${formatBRL(r.spent - r.limit)} acima do limite` : `restam ${formatBRL(r.limit - r.spent)}`) : 'sem limite'">
          <Ring :value="r.limit ? r.pct : m.saidas ? r.spent / m.saidas : 0" :color="categoryById(r.category).color || 'outline'"
            :text="r.limit ? `${Math.round(r.pct * 100)}%` : `${Math.round((m.saidas ? r.spent / m.saidas : 0) * 100)}%`" :sub="r.limit ? 'do limite' : 'do mês'" />
          <strong class="text-body-sm text-on-surface truncate max-w-full">{{ categoryById(r.category).name }}</strong>
          <span class="text-label-md tabular-nums text-on-surface-variant">{{ formatBRL(r.spent) }}{{ r.limit ? ` / ${formatBRLCompact(r.limit)}` : '' }}</span>
        </li>
      </ul>
      <p v-else class="text-body-md text-on-surface-variant">Nenhum gasto nem limite neste mês. Defina limites na aba Orçamento.</p>
      <details v-if="rings.length" class="text-body-sm">
        <summary class="cursor-pointer text-primary font-label-md text-label-md w-fit">Ver em tabela</summary>
        <table class="w-full mt-2 text-left tabular-nums">
          <thead class="text-on-surface-variant font-label-sm text-label-sm uppercase"><tr><th class="py-1.5">Categoria</th><th class="py-1.5 text-right">Gasto</th><th class="py-1.5 text-right">Limite</th></tr></thead>
          <tbody class="divide-y divide-outline-variant/30">
            <tr v-for="r in rings" :key="r.category"><td class="py-1.5">{{ categoryById(r.category).name }}<span v-if="r.over" class="text-tertiary font-semibold"> · acima</span></td><td class="py-1.5 text-right">{{ formatBRL(r.spent) }}</td><td class="py-1.5 text-right">{{ r.limit ? formatBRL(r.limit) : '—' }}</td></tr>
          </tbody>
        </table>
      </details>
    </section>

    <section v-if="hasWorth" data-tour="chart-worth" :class="card" class="lg:col-span-12">
      <h2 class="font-headline-sm text-headline-sm text-on-surface">Evolução do patrimônio</h2>
      <WorthChart :rows="view.series" />
    </section>
  </div>
</template>
