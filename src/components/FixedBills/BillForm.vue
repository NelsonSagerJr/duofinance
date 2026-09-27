<script setup>
import { ref, computed } from 'vue'
import { upsertFixedBill } from '../../lib/store.js'
import { parseBRL } from '../../lib/money.js'
import { pickable } from '../../lib/categories.js'

// bill: row to edit (null = create).
const props = defineProps({ bill: { type: Object, default: null } })
const emit = defineEmits(['saved', 'cancel'])

const b = props.bill || {}
const name = ref(b.name || '')
const amount = ref(b.amount_cents ? (b.amount_cents / 100).toFixed(2).replace('.', ',') : '')
const dueDay = ref(b.due_day || 10)
const categoryOptions = computed(() => pickable('expense', b.category_id))
const category = ref(b.category_id || (categoryOptions.value.find((c) => c.name === 'Contas') || categoryOptions.value[0])?.id || '')
const active = ref(b.active ?? true)
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  const amount_cents = parseBRL(amount.value)
  if (!amount_cents || amount_cents <= 0) return (error.value = 'Informe um valor válido, ex: 150,00')
  if (!category.value) return (error.value = 'Escolha uma categoria (crie em Acerto & Metas → Categorias).')
  const due_day = Number(dueDay.value)
  if (!Number.isInteger(due_day) || due_day < 1 || due_day > 31) return (error.value = 'Dia de vencimento deve ser de 1 a 31')
  busy.value = true
  try {
    const row = { name: name.value.trim(), amount_cents, due_day, category_id: category.value, active: active.value }
    emit('saved', await upsertFixedBill(props.bill ? { id: props.bill.id, ...row } : row))
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
      <span :class="label">Nome</span>
      <input v-model="name" required maxlength="120" placeholder="Ex: Aluguel, Internet" :class="input" />
    </label>

    <div class="grid grid-cols-2 gap-space-sm">
      <label class="flex flex-col gap-1">
        <span :class="label">Valor (R$)</span>
        <input v-model="amount" required inputmode="decimal" placeholder="0,00" :class="input" />
      </label>
      <label class="flex flex-col gap-1">
        <span :class="label">Vence todo dia</span>
        <input v-model="dueDay" type="number" required min="1" max="31" step="1" :class="input" />
      </label>
    </div>

    <label class="flex flex-col gap-1">
      <span :class="label">Categoria</span>
      <select v-model="category" :class="input">
        <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ c.name }}{{ c.archived ? ' (arquivada)' : '' }}</option>
      </select>
    </label>

    <label class="flex items-center gap-2 text-body-md text-on-surface cursor-pointer">
      <input v-model="active" type="checkbox" class="w-4 h-4 accent-primary" />
      Conta ativa (entra nos meses)
    </label>

    <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>

    <div class="flex gap-space-sm justify-end">
      <button type="button" class="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg" @click="emit('cancel')">Cancelar</button>
      <button type="submit" :disabled="busy"
        class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60">
        <span class="material-symbols-outlined text-[18px]">{{ bill ? 'save' : 'add' }}</span>
        {{ busy ? 'Salvando…' : bill ? 'Salvar' : 'Adicionar' }}
      </button>
    </div>
  </form>
</template>
