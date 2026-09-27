<script setup>
import { ref, computed, watch } from 'vue'
import { state, me, openExpenseForm, listExpenses, deleteExpense } from '../lib/store.js'
import { monthRange, monthLabel } from '../lib/month.js'
import { formatBRL } from '../lib/money.js'
import { categoryById } from '../lib/categories.js'

// Personal expenses are private (RLS returns only mine), so this screen is always the logged-in member's.
const ownerId = computed(() => me.value?.user_id)
const expenses = ref([])
const loading = ref(true)
const error = ref('')


let req = 0
async function load() {
  const id = ++req
  loading.value = true
  error.value = ''
  try {
    // ponytail: loads the month and filters client-side; 2 people, a month of rows is small.
    const rows = await listExpenses(monthRange(state.month))
    if (id === req) expenses.value = rows.filter((e) => e.scope === 'personal')
  } catch (e) {
    if (id === req) error.value = e.message || 'Erro ao carregar gastos.'
  } finally {
    if (id === req) loading.value = false
  }
}
watch(() => [state.month, state.version], load, { immediate: true })

const mine = computed(() => expenses.value.filter((e) => e.owner_id === ownerId.value))
const total = computed(() => mine.value.reduce((s, e) => s + e.amount_cents, 0))
const byCategory = computed(() => {
  const sums = {}
  for (const e of mine.value) sums[e.category] = (sums[e.category] || 0) + e.amount_cents
  return Object.entries(sums)
    .map(([id, cents]) => ({ ...categoryById(id), cents, pct: total.value ? Math.round((cents / total.value) * 100) : 0 }))
    .sort((a, b) => b.cents - a.cents)
})

const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
const shortDate = (d) => dayFmt.format(new Date(d + 'T00:00:00Z')).replace('.', '')

function add() {
  openExpenseForm(null, { scope: 'personal' })
}

async function remove(e) {
  if (!confirm(`Excluir "${e.description}" (${formatBRL(e.amount_cents)})?`)) return
  try {
    await deleteExpense(e.id)
  } catch (err) {
    alert('Não foi possível excluir: ' + (err.message || err))
  }
}
</script>

<template>
  <div class="flex flex-col w-full gap-space-lg">
    <!-- Header -->
    <div data-tour="personal-header" class="flex flex-col gap-1 bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
      <h1 class="font-headline-sm text-headline-sm text-on-surface">Meu Espaço</h1>
      <p class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
        <span class="material-symbols-outlined text-[16px]">lock</span>
        Seus gastos pessoais de {{ monthLabel(state.month) }}. Só você vê esta tela.
      </p>
    </div>

    <div v-if="error" class="bg-error-container text-on-error-container p-space-md rounded-xl font-body-md text-body-md flex items-center justify-between gap-space-md">
      <span>{{ error }}</span>
      <button type="button" class="font-label-lg text-label-lg underline" @click="load">Tentar de novo</button>
    </div>

    <div v-else-if="loading" class="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm text-on-surface-variant font-body-md text-body-md">Carregando…</div>

    <template v-else>
      <!-- Total + by category -->
      <div data-tour="personal-totals" class="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-space-xs">
          <div>
            <h2 class="font-label-md text-label-md text-on-surface-variant">Gasto pessoal no mês</h2>
            <p class="font-numeric-stat text-numeric-stat text-on-surface">{{ formatBRL(total) }}</p>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant">{{ mine.length }} lançamento(s)</p>
        </div>
        <div v-if="byCategory.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-md">
          <div v-for="c in byCategory" :key="c.id" class="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm">
            <div class="flex items-start justify-between">
              <div class="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[18px]">{{ c.icon }}</span>
              </div>
              <span class="font-label-sm text-label-sm text-primary bg-primary-fixed/60 px-2 py-0.5 rounded-full">{{ c.pct }}%</span>
            </div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="font-label-lg text-label-lg text-on-surface truncate">{{ c.label }}</span>
              <span class="font-label-md text-label-md font-semibold text-on-surface whitespace-nowrap">{{ formatBRL(c.cents) }}</span>
            </div>
            <div class="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
              <div class="bg-primary h-full rounded-full" :style="{ width: c.pct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Extrato -->
      <div data-tour="personal-extrato" class="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Meu extrato pessoal</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant">{{ monthLabel(state.month) }}</p>
          </div>
          <button
            type="button"
            data-tour="add-personal"
            class="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95"
            @click="add"
          >
            <span class="material-symbols-outlined text-[18px]">add_circle</span>
            Adicionar gasto pessoal
          </button>
        </div>

        <p v-if="!mine.length" class="py-space-xl text-center text-on-surface-variant font-body-md text-body-md">
          Nenhum gasto pessoal seu neste mês.
        </p>

        <ul v-else data-tour="personal-list" class="flex flex-col">
          <li
            v-for="e in mine"
            :key="e.id"
            class="flex items-center justify-between gap-2 py-3.5 px-2 hover:bg-surface-container-low rounded-lg transition-colors"
          >
            <div class="flex items-center gap-space-md min-w-0 flex-1">
              <div class="hidden sm:flex w-10 h-10 rounded-xl bg-primary-fixed/80 items-center justify-center text-primary shrink-0">
                <span class="material-symbols-outlined text-[20px]">{{ categoryById(e.category).icon }}</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-body-md text-body-md text-on-surface font-semibold truncate">{{ e.description }}</span>
                <div class="flex flex-wrap items-center gap-x-2 font-label-sm text-label-sm text-on-surface-variant">
                  <span class="whitespace-nowrap">{{ shortDate(e.spent_on) }}</span>
                  <span>•</span>
                  <span class="px-1.5 bg-surface-container rounded whitespace-nowrap">{{ categoryById(e.category).label }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span class="font-label-lg text-label-lg sm:font-headline-sm sm:text-headline-sm text-on-surface whitespace-nowrap mr-1">{{ formatBRL(e.amount_cents) }}</span>
              <button
                type="button"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                aria-label="Editar"
                title="Editar"
                @click="openExpenseForm(e)"
              >
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button
                type="button"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
                aria-label="Excluir"
                title="Excluir"
                @click="remove(e)"
              >
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
