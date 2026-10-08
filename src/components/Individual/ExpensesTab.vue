<script setup>
import { computed } from 'vue'
import { state, openExpenseForm, deleteExpense, deleteInstallmentGroup, paidByLabel } from '../../lib/store.js'
import { installmentLabel } from '../../lib/cards.js'
import CardsSection from './CardsSection.vue'
import { formatBRL } from '../../lib/money.js'
import { categoryById, chipClass } from '../../lib/categories.js'
import { monthLabel, monthRange } from '../../lib/month.js'
import { myHouseShare } from '../../lib/personal.js'

const props = defineProps({ view: { type: Object, required: true } })

const inMonth = (d) => d >= monthRange(props.view.month).start && d < monthRange(props.view.month).end
const monthRows = computed(() => props.view.expenses.filter((e) => inMonth(e.spent_on)))
// Personal rows are private (RLS returns only mine).
const mine = computed(() => monthRows.value.filter((e) => e.scope === 'personal' && e.owner_id === props.view.meId))
const total = computed(() => mine.value.reduce((s, e) => s + e.amount_cents, 0))
const byCategory = computed(() => {
  const sums = {}
  for (const e of mine.value) sums[e.category_id] = (sums[e.category_id] || 0) + e.amount_cents
  return Object.entries(sums)
    .map(([id, cents]) => ({ ...categoryById(id), key: id, cents, pct: total.value ? Math.round((cents / total.value) * 100) : 0 }))
    .sort((a, b) => b.cents - a.cents)
})
const house = computed(() =>
  monthRows.value.filter((e) => e.scope === 'house').map((e) => ({ ...e, share: myHouseShare(e, props.view.members, props.view.meId) })),
)

const cardOf = computed(() => {
  const names = new Map(state.cards.map((c) => [c.id, c.name]))
  return new Map(props.view.expenseCards.map((t) => [t.expense_id, names.get(t.card_id)]))
})

const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
const shortDate = (d) => dayFmt.format(new Date(d + 'T00:00:00Z')).replace('.', '')

async function remove(e) {
  const group = e.installment_group
  const msg = group ? `Excluir "${e.description}" e todas as ${e.installment_count} parcelas?` : `Excluir "${e.description}" (${formatBRL(e.amount_cents)})?`
  if (!confirm(msg)) return
  try {
    await (group ? deleteInstallmentGroup(group) : deleteExpense(e.id))
  } catch (err) {
    alert('Não foi possível excluir: ' + (err.message || err))
  }
}
</script>

<template>
  <div data-tour="personal-totals" class="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-space-xs">
      <div>
        <h2 class="font-label-md text-label-md text-on-surface-variant">Gasto pessoal no mês</h2>
        <p class="font-numeric-stat text-numeric-stat text-on-surface">{{ formatBRL(total) }}</p>
      </div>
      <p class="font-body-sm text-body-sm text-on-surface-variant">{{ mine.length }} lançamento(s) · + {{ formatBRL(view.metrics.house) }} da sua parte da casa</p>
    </div>
    <div v-if="byCategory.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-md">
      <div v-for="c in byCategory" :key="c.key" class="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm">
        <div class="flex items-start justify-between">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="chipClass(c)">
            <span class="material-symbols-outlined text-[18px]">{{ c.icon }}</span>
          </div>
          <span class="font-label-sm text-label-sm text-primary bg-primary-fixed/60 px-2 py-0.5 rounded-full">{{ c.pct }}%</span>
        </div>
        <div class="flex items-baseline justify-between gap-2">
          <span class="font-label-lg text-label-lg text-on-surface truncate">{{ c.name }}</span>
          <span class="font-label-md text-label-md font-semibold text-on-surface whitespace-nowrap">{{ formatBRL(c.cents) }}</span>
        </div>
        <div class="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
          <div class="bg-primary h-full rounded-full" :style="{ width: c.pct + '%' }"></div>
        </div>
      </div>
    </div>
  </div>

  <CardsSection :view="view" />

  <div data-tour="personal-extrato" class="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
      <div>
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Meu extrato pessoal</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant">{{ monthLabel(view.month) }}</p>
      </div>
      <button type="button" data-tour="add-personal"
        class="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95"
        @click="openExpenseForm(null, { scope: 'personal' })">
        <span class="material-symbols-outlined text-[18px]">add_circle</span>Adicionar gasto pessoal
      </button>
    </div>
    <p v-if="!mine.length" class="py-space-xl text-center text-on-surface-variant font-body-md text-body-md">
      Nenhum gasto pessoal seu neste mês. Academia, roupa, presente… lance em <b class="text-on-surface">Adicionar gasto pessoal</b>.
    </p>
    <ul v-else data-tour="personal-list" class="flex flex-col">
      <li v-for="e in mine" :key="e.id" class="flex items-center justify-between gap-2 py-3.5 px-2 hover:bg-surface-container-low rounded-lg transition-colors">
        <div class="flex items-center gap-space-md min-w-0 flex-1">
          <div class="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center shrink-0" :class="chipClass(categoryById(e.category_id))">
            <span class="material-symbols-outlined text-[20px]">{{ categoryById(e.category_id).icon }}</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-body-md text-body-md text-on-surface font-semibold truncate">{{ e.description }}{{ installmentLabel(e) }}</span>
            <div class="flex flex-wrap items-center gap-x-2 font-label-sm text-label-sm text-on-surface-variant">
              <span class="whitespace-nowrap">{{ shortDate(e.spent_on) }}</span><span>•</span>
              <span class="px-1.5 bg-surface-container rounded whitespace-nowrap">{{ categoryById(e.category_id).name }}</span>
              <span v-if="cardOf.get(e.id)" class="inline-flex items-center gap-0.5 whitespace-nowrap"><span class="material-symbols-outlined text-[14px]">credit_card</span>{{ cardOf.get(e.id) }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <span class="font-label-lg text-label-lg sm:font-headline-sm sm:text-headline-sm text-on-surface whitespace-nowrap mr-1">{{ formatBRL(e.amount_cents) }}</span>
          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface" aria-label="Editar" title="Editar" @click="openExpenseForm(e)">
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container" aria-label="Excluir" title="Excluir" @click="remove(e)">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </li>
    </ul>
  </div>

  <section data-tour="house-share" class="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-space-xs">
      <div>
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Minha parte da casa</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Quanto das despesas da casa cabe a você pela divisão de cada uma. Entra nas suas saídas.</p>
      </div>
      <p class="font-headline-md text-headline-md text-on-surface whitespace-nowrap">{{ formatBRL(view.metrics.house) }}</p>
    </div>
    <p v-if="!house.length" class="text-body-md text-on-surface-variant">Nenhuma despesa da casa neste mês.</p>
    <ul v-else class="flex flex-col divide-y divide-surface-container">
      <li v-for="e in house" :key="e.id" class="flex items-center justify-between gap-2 py-3 px-2">
        <div class="flex flex-col min-w-0">
          <span class="font-body-md text-body-md text-on-surface truncate">{{ e.description }}</span>
          <span class="font-label-sm text-label-sm text-on-surface-variant">{{ shortDate(e.spent_on) }} · {{ categoryById(e.category_id).name }}{{ cardOf.get(e.id) ? ` · ${cardOf.get(e.id)}` : '' }} · {{ e.paid_by ? `pago por ${paidByLabel(e.paid_by)}` : paidByLabel(null) }}</span>
        </div>
        <div class="text-right shrink-0">
          <div class="font-label-lg text-label-lg text-on-surface whitespace-nowrap">{{ formatBRL(e.share) }}</div>
          <div class="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">de {{ formatBRL(e.amount_cents) }}</div>
        </div>
      </li>
    </ul>
  </section>
</template>
