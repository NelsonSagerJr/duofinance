<script setup>
import { ref, computed, watch } from 'vue'
import { state, memberName, paidByLabel, listExpenses, listSettlements, addSettlement, deleteExpense, openExpenseForm } from '../lib/store.js'
import { computeSettlement } from '../lib/settlement.js'
import { formatBRL } from '../lib/money.js'
import { categoryById, chipClass } from '../lib/categories.js'
import { monthRange, monthLabel } from '../lib/month.js'
import GoalsSection from '../components/Settlement/GoalsSection.vue'
import SettingsSection from '../components/Settlement/SettingsSection.vue'
import CategoriesSection from '../components/Settlement/CategoriesSection.vue'

const expenses = ref([])
const settlements = ref([])
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const loadedMonth = ref(null)

// Request counter: a slow reply for an older month must not overwrite the current one.
let req = 0
async function load() {
  const id = ++req
  const month = state.month
  loading.value = true
  error.value = ''
  try {
    const [all, s] = await Promise.all([listExpenses(monthRange(month)), listSettlements(month)])
    if (id !== req) return
    expenses.value = all.filter((e) => e.scope === 'house')
    settlements.value = s
    loadedMonth.value = month
  } catch (e) {
    if (id === req) error.value = e.message
  } finally {
    if (id === req) loading.value = false
  }
}
watch(() => [state.month, state.version], load, { immediate: true })

const result = computed(() =>
  computeSettlement({ expenses: expenses.value, members: state.members, settlements: settlements.value }),
)

const split = (e) =>
  state.members.map((m) => Number(e.share_pct?.[m.user_id] ?? 0)).join(' / ')

async function markSettled() {
  const t = result.value.transfer
  if (!t) return
  if (!confirm(`Registrar que ${memberName(t.from_id)} transferiu ${formatBRL(t.amount_cents)} para ${memberName(t.to_id)}?`)) return
  busy.value = true
  try {
    await addSettlement({ month: loadedMonth.value, ...t })
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function remove(e) {
  if (!confirm(`Excluir "${e.description}" (${formatBRL(e.amount_cents)})?`)) return
  try {
    await deleteExpense(e.id)
  } catch (err) {
    error.value = err.message
  }
}

const dateBR = (d) => d.split('-').reverse().join('/')
</script>

<template>
  <div class="flex flex-col gap-space-xl">
    <header>
      <p class="font-label-sm text-label-sm text-primary uppercase tracking-widest">{{ monthLabel(state.month) }}</p>
      <h1 class="font-headline-xl text-headline-xl text-on-surface">Acerto &amp; Metas</h1>
      <p class="text-body-md text-on-surface-variant mt-1">Quem pagou o quê nas despesas da casa e os objetivos a dois.</p>
    </header>

    <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-4 py-3 text-body-sm">{{ error }}</p>

    <!-- Acerto do mês -->
    <section class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-lg">
      <div>
        <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Acerto do mês</span>
        <h2 class="font-headline-md text-headline-md text-on-surface">Resumo do acerto</h2>
      </div>

      <p v-if="loading" class="text-body-md text-on-surface-variant">Carregando…</p>
      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        <div data-tour="acerto-transfer" class="lg:col-span-6 rounded-xl bg-surface-container-low p-space-lg flex flex-col gap-space-md">
          <template v-if="result.transfer">
            <p class="text-body-md text-on-surface-variant">{{ memberName(result.transfer.from_id) }} transfere para {{ memberName(result.transfer.to_id) }}:</p>
            <p class="font-numeric-stat text-numeric-stat text-primary break-words">{{ formatBRL(result.transfer.amount_cents) }}</p>
            <p v-if="result.settled" class="text-body-sm text-on-surface-variant">Já quitado neste mês: {{ formatBRL(result.settled) }}</p>
            <button data-tour="acerto-settle" :disabled="busy" @click="markSettled"
              class="self-start inline-flex items-center gap-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
              {{ busy ? 'Salvando…' : 'Marcar como quitado' }}
            </button>
          </template>
          <template v-else>
            <span class="material-symbols-outlined text-primary text-[32px]">handshake</span>
            <p class="font-headline-sm text-headline-sm text-on-surface">Tudo certo, ninguém deve nada.</p>
            <p v-if="result.settled" class="text-body-sm text-on-surface-variant">Quitado neste mês: {{ formatBRL(result.settled) }}</p>
          </template>
          <p class="text-body-sm text-on-surface-variant">Total da casa no mês: <strong class="text-on-surface">{{ formatBRL(result.total) }}</strong></p>
        </div>

        <div data-tour="acerto-members" class="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <div v-for="m in state.members" :key="m.user_id" class="rounded-xl border border-outline-variant/40 p-space-md flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <span class="font-headline-sm text-headline-sm text-on-surface truncate">{{ m.name }}</span>
              <span class="shrink-0 font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant">Padrão: {{ Number(m.default_share_pct) }}%</span>
            </div>
            <div class="flex justify-between text-body-sm"><span class="text-on-surface-variant">Devido</span><span>{{ formatBRL(result.perMember[m.user_id]?.due || 0) }}</span></div>
            <div class="flex justify-between text-body-sm"><span class="text-on-surface-variant">Pago</span><span>{{ formatBRL(result.perMember[m.user_id]?.paid || 0) }}</span></div>
            <div class="flex justify-between text-body-sm font-semibold"
              :class="(result.perMember[m.user_id]?.balance || 0) < 0 ? 'text-tertiary' : 'text-primary'">
              <span>Saldo</span><span>{{ formatBRL(result.perMember[m.user_id]?.balance || 0) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <GoalsSection />

    <!-- Despesas da casa -->
    <section data-tour="house-expenses" class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
      <div>
        <h2 class="font-headline-md text-headline-md text-on-surface">Despesas da casa</h2>
        <p class="text-body-sm text-on-surface-variant">Lançamentos que compõem o acerto de {{ monthLabel(state.month) }}.</p>
      </div>
      <p v-if="loading" class="text-body-md text-on-surface-variant">Carregando…</p>
      <p v-else-if="!expenses.length" class="text-body-md text-on-surface-variant py-space-md">Nenhuma despesa da casa neste mês.</p>
      <div v-else class="relative overflow-auto max-h-[32rem] overscroll-contain -mx-space-lg px-space-lg">
        <table class="w-full min-w-[640px] text-left">
          <thead class="bg-surface-container-low sticky top-0 z-10">
            <tr class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              <th class="px-3 py-3">Data</th>
              <th class="px-3 py-3">Descrição</th>
              <th class="px-3 py-3">Categoria</th>
              <th class="px-3 py-3">Quem pagou</th>
              <th class="px-3 py-3">Divisão</th>
              <th class="px-3 py-3 text-right">Valor</th>
              <th class="px-3 py-3"><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/30 text-body-md">
            <tr v-for="e in expenses" :key="e.id" class="hover:bg-surface-container-low/50">
              <td class="px-3 py-3 whitespace-nowrap text-on-surface-variant">{{ dateBR(e.spent_on) }}</td>
              <td class="px-3 py-3 text-on-surface">{{ e.description }}</td>
              <td class="px-3 py-3">
                <span class="inline-flex items-center gap-1 bg-surface-container px-2 py-0.5 rounded-full font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
                  <span class="material-symbols-outlined text-[14px] rounded-full" :class="chipClass(categoryById(e.category_id))">{{ categoryById(e.category_id).icon }}</span>{{ categoryById(e.category_id).name }}
                </span>
              </td>
              <td class="px-3 py-3 font-label-md text-label-md whitespace-nowrap" :class="{ 'text-on-surface-variant': !e.paid_by }">{{ paidByLabel(e.paid_by) }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-on-surface-variant">{{ split(e) }}%</td>
              <td class="px-3 py-3 text-right whitespace-nowrap font-semibold">{{ formatBRL(e.amount_cents) }}</td>
              <td class="px-3 py-3 whitespace-nowrap text-right">
                <button type="button" aria-label="Editar" class="p-1 rounded hover:bg-surface-container-high text-on-surface-variant" title="Editar" @click="openExpenseForm(e)">
                  <span class="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button type="button" aria-label="Excluir" class="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-on-error-container" title="Excluir" @click="remove(e)">
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <SettingsSection />
    <CategoriesSection />
  </div>
</template>
