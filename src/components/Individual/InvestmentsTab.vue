<script setup>
import { ref, computed } from 'vue'
import { upsertInvestment, deleteMove } from '../../lib/store.js'
import { formatBRL, formatPct } from '../../lib/money.js'
import { investmentKindById } from '../../lib/categories.js'
import { monthLabel, nextMonth } from '../../lib/month.js'
import Modal from '../FixedBills/Modal.vue'
import InvestmentForm from './InvestmentForm.vue'
import MoveForm from './MoveForm.vue'

const props = defineProps({ view: { type: Object, required: true } })

// Positions are as of the end of the chosen month (later moves don't count yet).
const active = computed(() => props.view.portfolio.filter((p) => !p.archived))
const archived = computed(() => props.view.portfolio.filter((p) => p.archived))
const totals = computed(() => {
  const s = (f) => props.view.portfolio.reduce((acc, p) => acc + f(p), 0)
  const contributed = s((p) => p.contributed)
  const gain = s((p) => p.gain)
  return { balance: s((p) => p.balance), contributed, gain, gainPct: contributed > 0 ? gain / contributed : null }
})
const end = computed(() => nextMonth(props.view.month))
const movesOf = (id) => props.view.moves.filter((m) => m.investment_id === id && m.moved_on < end.value).slice().reverse()

const open = ref(new Set())
const toggle = (id) => {
  const s = new Set(open.value)
  s.has(id) ? s.delete(id) : s.add(id)
  open.value = s
}
const editing = ref(null) // null closed, {} new, row edit
const moving = ref(null) // { investment, type }
const error = ref('')

async function run(fn) {
  error.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = e.message
  }
}
const archive = (p) => run(() => upsertInvestment({ id: p.id, name: p.name, kind: p.kind, archived: !p.archived }))
function removeMove(m) {
  if (confirm(`Excluir ${MOVE[m.type].label.toLowerCase()} de ${formatBRL(m.amount_cents)} em ${ddmmyy(m.moved_on)}?`)) run(() => deleteMove(m.id))
}

const MOVE = {
  deposit: { label: 'Aporte', icon: 'add_circle', sign: '+' },
  withdraw: { label: 'Resgate', icon: 'remove_circle', sign: '−' },
  balance: { label: 'Saldo informado', icon: 'sync', sign: '' },
}
const ddmmyy = (d) => d.split('-').reverse().join('/')
const gainCls = (g) => (g > 0 ? 'text-primary' : g < 0 ? 'text-tertiary' : 'text-on-surface')
const signed = (c) => (c > 0 ? '+' : c < 0 ? '−' : '') + formatBRL(Math.abs(c))
const actionBtn = 'inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md active:scale-95'
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div v-for="k in [
      { label: 'Patrimônio', value: formatBRL(totals.balance), cls: '' },
      { label: 'Aportado líquido', value: formatBRL(totals.contributed), cls: '' },
      { label: 'Rendimento', value: signed(totals.gain), cls: gainCls(totals.gain) },
      { label: 'Investido no mês', value: formatBRL(view.metrics.invested), cls: '' },
    ]" :key="k.label" class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-1 min-w-0">
      <span class="font-body-sm text-body-sm text-on-surface-variant truncate">{{ k.label }}</span>
      <span class="font-headline-sm text-headline-sm sm:font-headline-md sm:text-headline-md text-on-surface whitespace-nowrap truncate" :class="k.cls">{{ k.value }}</span>
    </div>
  </div>

  <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>

  <section data-tour="portfolio" class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
    <div class="flex flex-wrap items-center gap-3 p-space-md md:px-6">
      <div class="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0"><span class="material-symbols-outlined">savings</span></div>
      <div class="flex-1 min-w-[10rem]">
        <h2 class="font-headline-sm text-headline-sm text-on-surface">Carteira</h2>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Posição no fim de {{ monthLabel(view.month) }}. Rendimento = saldo − aportado líquido.</p>
      </div>
      <button type="button" data-tour="add-investment" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg active:scale-95" @click="editing = {}">
        <span class="material-symbols-outlined text-[18px]">add_circle</span>Novo investimento
      </button>
    </div>

    <div v-if="!active.length" class="px-6 pb-8 pt-2 flex flex-col items-center gap-space-sm text-center">
      <span class="material-symbols-outlined text-[40px] text-outline">savings</span>
      <p class="text-body-md text-on-surface-variant max-w-md">
        Crie cada aplicação (CDB, ações, previdência…), registre os <b class="text-on-surface">aportes</b> e, de vez em quando, <b class="text-on-surface">atualize o saldo</b> com o valor do banco. O app calcula o rendimento e o patrimônio.
      </p>
    </div>

    <!-- Header row (md+): the rows below line up under it like a table -->
    <div v-else class="hidden md:grid grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-3 px-6 py-2 bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider" aria-hidden="true">
      <span>Investimento</span><span class="text-right">Aportado</span><span class="text-right">Saldo</span><span class="text-right">Rendimento</span><span class="text-right">%</span>
    </div>
    <ul class="divide-y divide-surface-container">
      <li v-for="p in active" :key="p.id" class="px-space-md md:px-6 py-4 flex flex-col gap-3">
        <div class="grid grid-cols-2 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-x-3 gap-y-2 items-center">
          <div class="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0"><span class="material-symbols-outlined text-[20px]">{{ investmentKindById(p.kind).icon }}</span></div>
            <div class="flex flex-col min-w-0">
              <span class="font-semibold text-body-md text-on-surface truncate">{{ p.name }}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">{{ investmentKindById(p.kind).label }}<template v-if="!p.hasSnapshot && p.balance"> · saldo = aportes</template></span>
            </div>
          </div>
          <div class="flex flex-col md:text-right"><span class="md:hidden font-label-sm text-label-sm text-on-surface-variant">Aportado</span><span class="text-body-md tabular-nums">{{ formatBRL(p.contributed) }}</span></div>
          <div class="flex flex-col text-right"><span class="md:hidden font-label-sm text-label-sm text-on-surface-variant">Saldo</span><span class="text-body-md font-semibold tabular-nums">{{ formatBRL(p.balance) }}</span></div>
          <div class="flex flex-col md:text-right"><span class="md:hidden font-label-sm text-label-sm text-on-surface-variant">Rendimento</span><span class="text-body-md tabular-nums" :class="gainCls(p.gain)">{{ signed(p.gain) }}</span></div>
          <div class="flex flex-col text-right"><span class="md:hidden font-label-sm text-label-sm text-on-surface-variant">%</span><span class="text-body-md tabular-nums" :class="gainCls(p.gain)">{{ formatPct(p.gainPct) }}</span></div>
        </div>
        <div data-tour="move-actions" class="flex flex-wrap items-center gap-2">
          <button type="button" :class="actionBtn" @click="moving = { investment: p, type: 'deposit' }"><span class="material-symbols-outlined text-[18px] text-primary">add</span>Aporte</button>
          <button type="button" :class="actionBtn" @click="moving = { investment: p, type: 'withdraw' }"><span class="material-symbols-outlined text-[18px] text-tertiary">remove</span>Resgate</button>
          <button type="button" :class="actionBtn" @click="moving = { investment: p, type: 'balance' }"><span class="material-symbols-outlined text-[18px]">sync</span>Atualizar saldo</button>
          <span class="flex items-center gap-1 ml-auto">
            <button type="button" class="inline-flex items-center gap-0.5 px-2 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" :aria-expanded="open.has(p.id)" @click="toggle(p.id)">
              Histórico<span class="material-symbols-outlined text-[18px] transition-transform" :class="{ 'rotate-180': open.has(p.id) }">expand_more</span>
            </button>
            <button type="button" class="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" title="Editar" :aria-label="`Editar ${p.name}`" @click="editing = p"><span class="material-symbols-outlined text-[20px]">edit</span></button>
            <button type="button" class="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" title="Arquivar" :aria-label="`Arquivar ${p.name}`" @click="archive(p)"><span class="material-symbols-outlined text-[20px]">archive</span></button>
          </span>
        </div>
        <div v-if="open.has(p.id)" class="rounded-lg bg-surface-container-low p-3">
          <p v-if="!movesOf(p.id).length" class="text-body-sm text-on-surface-variant">Nenhuma movimentação até o fim de {{ monthLabel(view.month) }}.</p>
          <ul v-else class="flex flex-col divide-y divide-outline-variant/30 max-h-80 overflow-y-auto overscroll-contain">
            <li v-for="m in movesOf(p.id)" :key="m.id" class="flex items-center justify-between gap-2 py-2">
              <span class="flex items-center gap-2 min-w-0 text-body-sm">
                <span class="material-symbols-outlined text-[18px] text-on-surface-variant">{{ MOVE[m.type].icon }}</span>
                <span class="flex flex-col sm:flex-row sm:gap-2 min-w-0">
                  <span class="text-on-surface truncate">{{ MOVE[m.type].label }}</span>
                  <span class="text-on-surface-variant whitespace-nowrap">{{ ddmmyy(m.moved_on) }}</span>
                </span>
              </span>
              <span class="flex items-center gap-1 shrink-0">
                <span class="text-body-sm font-semibold tabular-nums whitespace-nowrap">{{ MOVE[m.type].sign }}{{ formatBRL(m.amount_cents) }}</span>
                <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container" title="Excluir" aria-label="Excluir movimentação" @click="removeMove(m)"><span class="material-symbols-outlined text-[18px]">delete</span></button>
              </span>
            </li>
          </ul>
        </div>
      </li>
    </ul>
    <div v-if="active.length" class="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 px-space-md md:px-6 py-3 bg-surface-container-low text-body-sm text-on-surface-variant">
      <span>Aportado: <strong class="text-on-surface">{{ formatBRL(totals.contributed) }}</strong></span>
      <span>Saldo: <strong class="text-on-surface">{{ formatBRL(totals.balance) }}</strong></span>
      <span>Rendimento: <strong :class="gainCls(totals.gain)">{{ signed(totals.gain) }} ({{ formatPct(totals.gainPct) }})</strong></span>
    </div>
  </section>

  <details v-if="archived.length" class="bg-surface-container-lowest rounded-xl shadow-sm">
    <summary class="cursor-pointer px-space-md md:px-6 py-4 font-label-lg text-label-lg text-on-surface-variant">Arquivados ({{ archived.length }})</summary>
    <ul class="divide-y divide-surface-container pb-2">
      <li v-for="p in archived" :key="p.id" class="flex items-center justify-between gap-2 px-space-md md:px-6 py-3">
        <span class="min-w-0 truncate text-body-md text-on-surface">{{ p.name }} <span class="text-on-surface-variant text-body-sm">· saldo {{ formatBRL(p.balance) }}</span></span>
        <button type="button" class="shrink-0 inline-flex items-center gap-1 px-3 h-9 rounded-lg text-primary hover:bg-surface-container-high font-label-md text-label-md" @click="archive(p)">
          <span class="material-symbols-outlined text-[18px]">unarchive</span>Reativar
        </button>
      </li>
    </ul>
  </details>

  <Modal v-if="editing" :title="editing.id ? 'Editar investimento' : 'Novo investimento'" @close="editing = null">
    <InvestmentForm :row="editing.id ? editing : null" @saved="editing = null" @cancel="editing = null" />
  </Modal>
  <Modal v-if="moving" title="Movimentar investimento" @close="moving = null">
    <MoveForm :investment="moving.investment" :type="moving.type" @saved="moving = null" @cancel="moving = null" />
  </Modal>
</template>
