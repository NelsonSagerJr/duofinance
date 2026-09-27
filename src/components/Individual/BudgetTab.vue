<script setup>
import { ref, computed } from 'vue'
import { state, upsertBudget, deleteBudget } from '../../lib/store.js'
import { formatBRL, parseBRL } from '../../lib/money.js'
import { chipClass } from '../../lib/categories.js'
import { monthLabel } from '../../lib/month.js'

const props = defineProps({ view: { type: Object, required: true } })

// Every active expense category (archived ones only while they still have a limit or spending this month),
// with spending (pessoal + parte da casa) and its limit, if any.
const rows = computed(() => {
  const usage = Object.fromEntries(props.view.budgetRows.map((u) => [u.category, u]))
  return state.categories
    .filter((c) => c.kind === 'expense' && (!c.archived || usage[c.id]))
    .map((c) => ({ ...c, spent: usage[c.id]?.spent || 0, limit: usage[c.id]?.limit ?? null, over: !!usage[c.id]?.over }))
})
const withLimit = computed(() => rows.value.filter((r) => r.limit))
const totals = computed(() => ({
  limit: withLimit.value.reduce((s, r) => s + r.limit, 0),
  spent: withLimit.value.reduce((s, r) => s + r.spent, 0),
  over: withLimit.value.filter((r) => r.over),
}))
const pct = (r) => Math.min(100, Math.round((r.spent / r.limit) * 100))

const editing = ref(false)
const draft = ref({})
const error = ref('')
const busy = ref(false)
const cents = (c) => (c ? (c / 100).toFixed(2).replace('.', ',') : '')
function edit() {
  draft.value = Object.fromEntries(rows.value.map((r) => [r.id, cents(r.limit)]))
  error.value = ''
  editing.value = true
}
async function save() {
  error.value = ''
  const changes = []
  for (const r of rows.value) {
    const text = String(draft.value[r.id] ?? '').trim()
    const value = text ? parseBRL(text) : null
    if (text && !(value > 0)) return (error.value = `Limite inválido em ${r.name}. Use, por exemplo, 500,00 (ou deixe vazio para sem limite).`)
    if (value !== r.limit) changes.push(value ? () => upsertBudget(r.id, value) : () => deleteBudget(r.id))
  }
  busy.value = true
  try {
    for (const change of changes) await change()
    editing.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-1">
      <span class="font-body-sm text-body-sm text-on-surface-variant">Gasto nas categorias com limite</span>
      <span class="font-numeric-stat text-numeric-stat text-on-surface whitespace-nowrap truncate">{{ formatBRL(totals.spent) }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant">de {{ formatBRL(totals.limit) }} planejados em {{ monthLabel(view.month) }}</span>
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-1">
      <span class="font-body-sm text-body-sm text-on-surface-variant">Categorias acima do limite</span>
      <span class="font-numeric-stat text-numeric-stat whitespace-nowrap" :class="totals.over.length ? 'text-tertiary' : 'text-on-surface'">{{ totals.over.length }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant truncate">{{ totals.over.length ? totals.over.map((r) => r.name).join(', ') : 'tudo dentro do planejado' }}</span>
    </div>
  </div>

  <section data-tour="budget-list" class="bg-surface-container-lowest rounded-xl shadow-sm p-space-md md:p-space-lg flex flex-col gap-space-md">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <h2 class="font-headline-sm text-headline-sm text-on-surface">Limites por categoria</h2>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Limite mensal. O gasto soma seus gastos pessoais e sua parte da casa.</p>
      </div>
      <button v-if="!editing" type="button" data-tour="budget-edit" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg active:scale-95" @click="edit">
        <span class="material-symbols-outlined text-[18px]">tune</span>{{ withLimit.length ? 'Editar limites' : 'Definir limites' }}
      </button>
    </div>

    <p v-if="!withLimit.length && !editing" class="rounded-lg bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
      Nenhum limite ainda. Toque em <b class="text-on-surface">Definir limites</b> e escreva quanto quer gastar por mês em cada categoria (ex.: Lazer 300,00). Deixe vazio o que não quiser controlar.
    </p>

    <form v-if="editing" class="flex flex-col gap-space-md" @submit.prevent="save">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-sm">
        <label v-for="r in rows" :key="r.id" class="flex items-center gap-2 rounded-lg bg-surface-container-low/60 p-2">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" :class="chipClass(r)"><span class="material-symbols-outlined text-[18px]">{{ r.icon }}</span></span>
          <span class="flex-1 min-w-0 truncate text-body-md text-on-surface">{{ r.name }}</span>
          <input v-model="draft[r.id]" inputmode="decimal" placeholder="sem limite" :aria-label="`Limite de ${r.name} (R$)`" :class="input" class="!w-32 text-right" />
        </label>
      </div>
      <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>
      <div class="flex gap-space-sm justify-end">
        <button type="button" class="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg" @click="editing = false">Cancelar</button>
        <button type="submit" :disabled="busy" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg active:scale-95 disabled:opacity-60">
          <span class="material-symbols-outlined text-[18px]">save</span>{{ busy ? 'Salvando…' : 'Salvar limites' }}
        </button>
      </div>
    </form>

    <ul v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
      <li v-for="r in rows" :key="r.id" class="rounded-xl p-space-md flex flex-col gap-space-sm" :class="r.over ? 'bg-tertiary-fixed/40 ring-1 ring-tertiary/40' : 'bg-surface-container-low'">
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-2 min-w-0">
            <span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" :class="chipClass(r)"><span class="material-symbols-outlined text-[18px]">{{ r.icon }}</span></span>
            <span class="font-label-lg text-label-lg text-on-surface truncate">{{ r.name }}</span>
          </span>
          <span v-if="r.over" class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm">
            <span class="material-symbols-outlined text-[14px]">warning</span>Acima
          </span>
          <span v-else-if="r.limit" class="shrink-0 font-label-sm text-label-sm text-on-surface-variant">{{ pct(r) }}%</span>
        </div>
        <div class="flex items-baseline justify-between gap-2 text-body-sm">
          <span class="font-semibold text-on-surface whitespace-nowrap">{{ formatBRL(r.spent) }}</span>
          <span class="text-on-surface-variant whitespace-nowrap">{{ r.limit ? `de ${formatBRL(r.limit)}` : 'sem limite' }}</span>
        </div>
        <div v-if="r.limit" class="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden" role="progressbar" :aria-valuenow="pct(r)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${r.name}: ${pct(r)}% do limite`">
          <div class="h-full rounded-full" :class="r.over ? 'bg-tertiary' : 'bg-primary'" :style="{ width: pct(r) + '%' }"></div>
        </div>
        <p v-if="r.over" class="text-body-sm text-on-tertiary-fixed-variant">Passou {{ formatBRL(r.spent - r.limit) }} do limite.</p>
        <p v-else-if="r.limit" class="text-body-sm text-on-surface-variant">Restam {{ formatBRL(r.limit - r.spent) }}.</p>
      </li>
    </ul>
  </section>
</template>
