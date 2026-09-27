<script setup>
import { ref } from 'vue'
import { state, addMove } from '../../lib/store.js'
import { formatBRL, parseBRL } from '../../lib/money.js'
import { defaultDate } from '../../lib/month.js'

// investment: portfolio row (with balance). type: which move to start on.
const props = defineProps({ investment: { type: Object, required: true }, type: { type: String, default: 'deposit' } })
const emit = defineEmits(['saved', 'cancel'])

const TYPES = [
  { id: 'deposit', label: 'Aporte', icon: 'add' },
  { id: 'withdraw', label: 'Resgate', icon: 'remove' },
  { id: 'balance', label: 'Atualizar saldo', icon: 'sync' },
]
const type = ref(props.type)
const amount = ref('')
const movedOn = ref(defaultDate(state.month))
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  const amount_cents = parseBRL(amount.value)
  if (amount_cents == null || amount_cents < 0 || (amount_cents === 0 && type.value !== 'balance')) return (error.value = 'Informe um valor válido, ex: 1.000,00')
  busy.value = true
  try {
    emit('saved', await addMove({ investment_id: props.investment.id, type: type.value, amount_cents, moved_on: movedOn.value }))
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
const label = 'font-label-md text-label-md text-on-surface-variant'
const chip = (on) =>
  `min-w-0 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-body-sm cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
    on ? 'bg-primary-container text-on-primary-container font-semibold' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
  }`
</script>

<template>
  <form class="flex flex-col gap-space-md" @submit.prevent="submit">
    <p class="text-body-md text-on-surface-variant">{{ investment.name }} · saldo {{ formatBRL(investment.balance) }}</p>
    <fieldset class="grid grid-cols-3 gap-1 bg-surface-container rounded-lg p-1">
      <legend class="sr-only">Tipo de movimentação</legend>
      <label v-for="t in TYPES" :key="t.id" :class="chip(type === t.id)">
        <input v-model="type" type="radio" :value="t.id" class="sr-only" />
        <span class="material-symbols-outlined text-[16px] hidden sm:inline">{{ t.icon }}</span><span class="truncate">{{ t.label }}</span>
      </label>
    </fieldset>
    <div class="grid grid-cols-2 gap-space-sm">
      <label class="flex flex-col gap-1">
        <span :class="label">{{ type === 'balance' ? 'Saldo atual (R$)' : 'Valor (R$)' }}</span>
        <input v-model="amount" required inputmode="decimal" placeholder="0,00" :class="input" />
      </label>
      <label class="flex flex-col gap-1">
        <span :class="label">Data</span>
        <input v-model="movedOn" type="date" required :class="input" />
      </label>
    </div>
    <p class="text-body-sm text-on-surface-variant">
      <template v-if="type === 'balance'">Use o saldo que aparece no banco ou na corretora. A diferença para o que você aportou vira rendimento.</template>
      <template v-else-if="type === 'deposit'">Dinheiro que você colocou. Soma no saldo e no aportado.</template>
      <template v-else>Dinheiro que você tirou. Diminui o saldo e o aportado.</template>
    </p>
    <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>
    <div class="flex gap-space-sm justify-end">
      <button type="button" class="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg" @click="emit('cancel')">Cancelar</button>
      <button type="submit" :disabled="busy" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60">
        <span class="material-symbols-outlined text-[18px]">save</span>{{ busy ? 'Salvando…' : 'Registrar' }}
      </button>
    </div>
  </form>
</template>
