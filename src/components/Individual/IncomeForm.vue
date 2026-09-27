<script setup>
import { ref, computed } from 'vue'
import { state, upsertIncome, upsertRecurringIncome } from '../../lib/store.js'
import { parseBRL } from '../../lib/money.js'
import { pickable } from '../../lib/categories.js'
import { defaultDate } from '../../lib/month.js'

// recurring = renda fixa (name, day, active) instead of an entrada avulsa (description, date). row = edit, null = new.
const props = defineProps({ row: { type: Object, default: null }, recurring: { type: Boolean, default: false } })
const emit = defineEmits(['saved', 'cancel'])

const r = props.row || {}
const name = ref((props.recurring ? r.name : r.description) || '')
const amount = ref(r.amount_cents ? (r.amount_cents / 100).toFixed(2).replace('.', ',') : '')
const categoryOptions = computed(() => pickable('income', r.category_id))
const category = ref(r.category_id || categoryOptions.value[0]?.id || '')
const day = ref(r.day || 5)
const receivedOn = ref(r.received_on || defaultDate(state.month))
const active = ref(r.active ?? true)
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  const amount_cents = parseBRL(amount.value)
  if (!amount_cents || amount_cents <= 0) return (error.value = 'Informe um valor válido, ex: 5.000,00')
  if (!category.value) return (error.value = 'Escolha uma categoria (crie em Acerto & Metas → Categorias).')
  const d = Number(day.value)
  if (props.recurring && !(Number.isInteger(d) && d >= 1 && d <= 31)) return (error.value = 'O dia deve ser de 1 a 31')
  const base = { ...(r.id ? { id: r.id } : {}), amount_cents, category_id: category.value }
  const row = props.recurring
    ? { ...base, name: name.value.trim(), day: d, active: active.value }
    : { ...base, description: name.value.trim(), received_on: receivedOn.value, recurring_income_id: r.recurring_income_id ?? null, income_month: r.income_month ?? null }
  busy.value = true
  try {
    emit('saved', await (props.recurring ? upsertRecurringIncome(row) : upsertIncome(row)))
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
const label = 'font-label-md text-label-md text-on-surface-variant'
</script>

<template>
  <form class="flex flex-col gap-space-md" @submit.prevent="submit">
    <label class="flex flex-col gap-1">
      <span :class="label">{{ recurring ? 'Nome' : 'Descrição' }}</span>
      <input v-model="name" required maxlength="120" :placeholder="recurring ? 'Ex: Salário, Aluguel recebido' : 'Ex: Freela de site, Venda do sofá'" :class="input" />
    </label>
    <div class="grid grid-cols-2 gap-space-sm">
      <label class="flex flex-col gap-1">
        <span :class="label">Valor (R$)</span>
        <input v-model="amount" required inputmode="decimal" placeholder="0,00" :class="input" />
      </label>
      <label v-if="recurring" class="flex flex-col gap-1">
        <span :class="label">Cai todo dia</span>
        <input v-model="day" type="number" required min="1" max="31" step="1" :class="input" />
      </label>
      <label v-else class="flex flex-col gap-1">
        <span :class="label">Data</span>
        <input v-model="receivedOn" type="date" required :class="input" />
      </label>
    </div>
    <label class="flex flex-col gap-1">
      <span :class="label">Categoria</span>
      <select v-model="category" :class="input">
        <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ c.name }}{{ c.archived ? ' (arquivada)' : '' }}</option>
      </select>
    </label>
    <label v-if="recurring" class="flex items-center gap-2 text-body-md text-on-surface cursor-pointer">
      <input v-model="active" type="checkbox" class="w-4 h-4 accent-primary" />
      Renda ativa (aparece todo mês)
    </label>
    <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>
    <div class="flex gap-space-sm justify-end">
      <button type="button" class="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg" @click="emit('cancel')">Cancelar</button>
      <button type="submit" :disabled="busy" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60">
        <span class="material-symbols-outlined text-[18px]">{{ row ? 'save' : 'add' }}</span>{{ busy ? 'Salvando…' : row ? 'Salvar' : 'Adicionar' }}
      </button>
    </div>
  </form>
</template>
