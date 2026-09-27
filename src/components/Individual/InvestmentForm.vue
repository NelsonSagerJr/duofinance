<script setup>
import { ref } from 'vue'
import { upsertInvestment, deleteInvestment } from '../../lib/store.js'
import { INVESTMENT_KINDS } from '../../lib/categories.js'

const props = defineProps({ row: { type: Object, default: null } })
const emit = defineEmits(['saved', 'cancel'])

const name = ref(props.row?.name || '')
const kind = ref(props.row?.kind || 'renda_fixa')
const error = ref('')
const busy = ref(false)

async function run(fn) {
  error.value = ''
  busy.value = true
  try {
    emit('saved', await fn())
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
const submit = () => run(() => upsertInvestment({ ...(props.row ? { id: props.row.id } : {}), name: name.value.trim(), kind: kind.value }))
function remove() {
  if (confirm(`Excluir "${props.row.name}" e todo o histórico de movimentações? Para só tirar da carteira, use Arquivar.`)) run(() => deleteInvestment(props.row.id))
}

const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
const label = 'font-label-md text-label-md text-on-surface-variant'
</script>

<template>
  <form class="flex flex-col gap-space-md" @submit.prevent="submit">
    <label class="flex flex-col gap-1">
      <span :class="label">Nome</span>
      <input v-model="name" required maxlength="120" placeholder="Ex: CDB Banco X, Tesouro Selic" :class="input" />
    </label>
    <label class="flex flex-col gap-1">
      <span :class="label">Tipo</span>
      <select v-model="kind" :class="input">
        <option v-for="k in INVESTMENT_KINDS" :key="k.id" :value="k.id">{{ k.label }}</option>
      </select>
    </label>
    <p v-if="!row" class="text-body-sm text-on-surface-variant">Depois de criar, registre o primeiro aporte (ou o saldo que já tem, em "Atualizar saldo").</p>
    <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>
    <div class="flex flex-wrap gap-space-sm justify-end">
      <button v-if="row" type="button" :disabled="busy" class="mr-auto px-3 py-2.5 rounded-lg text-error hover:bg-error-container hover:text-on-error-container font-label-lg text-label-lg" @click="remove">Excluir</button>
      <button type="button" class="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg" @click="emit('cancel')">Cancelar</button>
      <button type="submit" :disabled="busy" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60">
        <span class="material-symbols-outlined text-[18px]">{{ row ? 'save' : 'add' }}</span>{{ busy ? 'Salvando…' : row ? 'Salvar' : 'Criar' }}
      </button>
    </div>
  </form>
</template>
