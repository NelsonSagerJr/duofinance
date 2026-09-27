<script setup>
import { ref, watch } from 'vue'
import { state, me, memberName, listGoals, upsertGoal, addContribution } from '../../lib/store.js'
import { formatBRL, parseBRL } from '../../lib/money.js'
import { todayISO } from '../../lib/month.js'

const goals = ref([])
const loading = ref(true)
const error = ref('')
const busy = ref(false)

// editing: null | { id?, name, target, deadline } ; contributing: null | { goal_id, member_id, amount, date }
const editing = ref(null)
const contributing = ref(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    goals.value = await listGoals()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
watch(() => state.version, load, { immediate: true })

const cents = (c) => (c / 100).toFixed(2).replace('.', ',')
const pct = (g) => (g.target_cents ? Math.min(100, Math.round((g.saved_cents / g.target_cents) * 100)) : 0)
const dateBR = (d) => d.split('-').reverse().join('/')

function editGoal(g = null) {
  contributing.value = null
  editing.value = g
    ? { id: g.id, name: g.name, target: cents(g.target_cents), deadline: g.deadline || '' }
    : { name: '', target: '', deadline: '' }
}
function contribute(g) {
  editing.value = null
  contributing.value = { goal_id: g.id, member_id: me.value?.user_id, amount: '', date: todayISO() }
}

async function run(fn) {
  error.value = ''
  busy.value = true
  try {
    await fn()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

function saveGoal() {
  const f = editing.value
  const target_cents = parseBRL(f.target)
  if (!target_cents || target_cents <= 0) return (error.value = 'Informe um valor alvo válido, ex: 5.000,00')
  run(async () => {
    await upsertGoal({ ...(f.id ? { id: f.id } : {}), name: f.name.trim(), target_cents, deadline: f.deadline || null })
    editing.value = null
  })
}

function saveContribution() {
  const f = contributing.value
  const amount_cents = parseBRL(f.amount)
  if (!amount_cents || amount_cents <= 0) return (error.value = 'Informe um valor válido, ex: 200,00')
  run(async () => {
    await addContribution({ goal_id: f.goal_id, member_id: f.member_id, amount_cents, contributed_on: f.date })
    contributing.value = null
  })
}

// Per-member totals for a goal.
const byMember = (g) =>
  state.members.map((m) => ({
    name: m.name,
    cents: g.goal_contributions.filter((c) => c.member_id === m.user_id).reduce((s, c) => s + c.amount_cents, 0),
  }))

const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
const label = 'font-label-md text-label-md text-on-surface-variant'
const primaryBtn = 'inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60'
const ghostBtn = 'px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg'
</script>

<template>
  <section data-tour="goals" class="flex flex-col gap-space-md">
    <div class="flex flex-wrap items-end justify-between gap-space-md">
      <div>
        <h2 class="font-headline-md text-headline-md text-on-surface">Metas compartilhadas</h2>
        <p class="text-body-sm text-on-surface-variant">Objetivos a dois e os aportes de cada um.</p>
      </div>
      <button data-tour="new-goal" class="inline-flex items-center gap-2 bg-secondary-fixed text-on-secondary-fixed-variant font-label-lg text-label-lg px-4 py-2.5 rounded-lg hover:shadow-sm transition-all active:scale-95"
        @click="editGoal()">
        <span class="material-symbols-outlined text-[18px]">add_circle</span>Criar nova meta
      </button>
    </div>

    <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-4 py-3 text-body-sm">{{ error }}</p>

    <form v-if="editing" class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-space-md" @submit.prevent="saveGoal">
      <label class="flex flex-col gap-1 sm:col-span-3">
        <span :class="label">Nome da meta</span>
        <input v-model="editing.name" required maxlength="80" placeholder="Ex: Viagem de férias" :class="input" />
      </label>
      <label class="flex flex-col gap-1">
        <span :class="label">Valor alvo (R$)</span>
        <input v-model="editing.target" required inputmode="decimal" placeholder="0,00" :class="input" />
      </label>
      <label class="flex flex-col gap-1">
        <span :class="label">Prazo (opcional)</span>
        <input v-model="editing.deadline" type="date" :class="input" />
      </label>
      <div class="flex gap-space-sm justify-end items-end">
        <button type="button" :class="ghostBtn" @click="editing = null">Cancelar</button>
        <button type="submit" :disabled="busy" :class="primaryBtn">{{ busy ? 'Salvando…' : 'Salvar' }}</button>
      </div>
    </form>

    <p v-if="loading" class="text-body-md text-on-surface-variant">Carregando…</p>
    <div v-else-if="!goals.length && !editing" class="bg-surface-container-lowest rounded-xl p-space-lg text-center text-body-md text-on-surface-variant">
      Nenhuma meta ainda. Criem a primeira!
    </div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
      <article v-for="g in goals" :key="g.id" class="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-md">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="font-headline-sm text-headline-sm text-on-surface break-words">{{ g.name }}</h3>
            <p v-if="g.deadline" class="text-body-sm text-on-surface-variant flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">schedule</span>Prazo: {{ dateBR(g.deadline) }}
            </p>
          </div>
          <span class="font-headline-md text-headline-md text-primary shrink-0">{{ pct(g) }}%</span>
        </div>

        <div>
          <div class="flex justify-between text-body-sm mb-2 gap-2">
            <span class="text-on-surface-variant">Acumulado</span>
            <span class="text-right"><strong>{{ formatBRL(g.saved_cents) }}</strong> / {{ formatBRL(g.target_cents) }}</span>
          </div>
          <div class="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div class="h-full bg-primary rounded-full" :style="{ width: pct(g) + '%' }"></div>
          </div>
        </div>

        <div class="bg-surface-container-low p-3 rounded-lg flex flex-col gap-1">
          <div v-for="m in byMember(g)" :key="m.name" class="flex justify-between text-body-sm">
            <span class="text-on-surface-variant truncate">{{ m.name }}</span><span>{{ formatBRL(m.cents) }}</span>
          </div>
        </div>

        <form v-if="contributing?.goal_id === g.id" class="flex flex-col gap-space-sm" @submit.prevent="saveContribution">
          <div class="grid grid-cols-2 gap-space-sm">
            <label class="flex flex-col gap-1">
              <span :class="label">Valor (R$)</span>
              <input v-model="contributing.amount" required inputmode="decimal" placeholder="0,00" :class="input" />
            </label>
            <label class="flex flex-col gap-1">
              <span :class="label">Data</span>
              <input v-model="contributing.date" type="date" required :class="input" />
            </label>
          </div>
          <label class="flex flex-col gap-1">
            <span :class="label">Quem aportou?</span>
            <select v-model="contributing.member_id" :class="input">
              <option v-for="m in state.members" :key="m.user_id" :value="m.user_id">{{ memberName(m.user_id) }}</option>
            </select>
          </label>
          <div class="flex gap-space-sm justify-end">
            <button type="button" :class="ghostBtn" @click="contributing = null">Cancelar</button>
            <button type="submit" :disabled="busy" :class="primaryBtn">{{ busy ? 'Salvando…' : 'Aportar' }}</button>
          </div>
        </form>
        <div v-else class="flex justify-between items-center mt-auto pt-space-sm">
          <button class="text-body-sm text-on-surface-variant hover:text-on-surface flex items-center gap-1" @click="editGoal(g)">
            <span class="material-symbols-outlined text-[16px]">edit</span>Editar
          </button>
          <button data-tour="goal-contribute" class="text-primary font-label-md text-label-md flex items-center gap-1 hover:underline" @click="contribute(g)">
            Aportar <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
