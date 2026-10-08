<script setup>
import { ref, computed } from 'vue'
import { state, upsertCard, deleteCard } from '../../lib/store.js'
import { formatBRL } from '../../lib/money.js'
import { addMonths, dueDate } from '../../lib/month.js'
import { invoiceMonth, cardAmount } from '../../lib/cards.js'
import { myHouseShare } from '../../lib/personal.js'
import Modal from '../FixedBills/Modal.vue'

const props = defineProps({ view: { type: Object, required: true } })

// Per card: the invoice closing in the chosen month and the next (still open) one.
const cards = computed(() => {
  const { month, expenses, expenseCards, members, meId } = props.view
  const tag = new Map(expenseCards.map((t) => [t.expense_id, t.card_id]))
  const months = [month, addMonths(month, 1)]
  return state.cards.filter((c) => !c.archived).map((c) => {
    const totals = [0, 0]
    for (const e of expenses) {
      if (tag.get(e.id) !== c.id) continue
      const k = months.indexOf(invoiceMonth(e.spent_on, c.closing_day))
      if (k >= 0) totals[k] += cardAmount(e, myHouseShare(e, members, meId))
    }
    return { ...c, invoices: months.map((m, k) => ({ closes: dueDate(m, c.closing_day), cents: totals[k] })) }
  })
})
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

const editing = ref(null)
const error = ref('')
const busy = ref(false)
async function save() {
  error.value = ''
  const day = Number(editing.value.closing_day)
  if (!(day >= 1 && day <= 31)) return (error.value = 'Dia de fechamento entre 1 e 31.')
  busy.value = true
  try {
    await upsertCard({ ...editing.value, name: editing.value.name.trim(), closing_day: day })
    editing.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
async function remove(c) {
  if (!confirm(`Excluir o cartão "${c.name}"? Os gastos continuam, só perdem a marcação do cartão.`)) return
  try {
    await deleteCard(c.id)
  } catch (e) {
    alert('Não foi possível excluir: ' + (e.message || e))
  }
}

const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
const label = 'font-label-md text-label-md text-on-surface-variant'
const iconBtn = 'w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
</script>

<template>
  <section class="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
      <div>
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Faturas dos cartões</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Compras a partir do dia de fechamento vão para a fatura seguinte. Na casa dividida na hora, entra só a sua parte.</p>
      </div>
      <button type="button" class="inline-flex items-center justify-center gap-2 bg-surface-container-high text-on-surface font-label-lg text-label-lg px-4 py-2.5 rounded-lg shrink-0"
        @click="editing = { name: '', closing_day: 1 }">
        <span class="material-symbols-outlined text-[18px]">add_card</span>Novo cartão
      </button>
    </div>
    <p v-if="!cards.length" class="text-body-md text-on-surface-variant">Nenhum cartão. Cadastre um para marcar nos gastos e ver a fatura.</p>
    <ul v-else class="grid grid-cols-1 md:grid-cols-2 gap-space-md">
      <li v-for="c in cards" :key="c.id" class="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px] text-primary">credit_card</span>
          <span class="flex-1 min-w-0 truncate font-label-lg text-label-lg text-on-surface">{{ c.name }}</span>
          <button type="button" :class="iconBtn" :aria-label="`Editar ${c.name}`" title="Editar" @click="editing = { ...c }"><span class="material-symbols-outlined text-[18px]">edit</span></button>
          <button type="button" :class="iconBtn" :aria-label="`Excluir ${c.name}`" title="Excluir" @click="remove(c)"><span class="material-symbols-outlined text-[18px]">delete</span></button>
        </div>
        <div class="grid grid-cols-2 gap-space-sm">
          <div v-for="(inv, k) in c.invoices" :key="inv.closes" class="flex flex-col">
            <span class="font-label-sm text-label-sm text-on-surface-variant">Fecha {{ dm(inv.closes) }}{{ k ? ' · aberta' : '' }}</span>
            <span class="font-label-lg text-label-lg text-on-surface">{{ formatBRL(inv.cents) }}</span>
          </div>
        </div>
      </li>
    </ul>

    <Modal v-if="editing" :title="editing.id ? 'Editar cartão' : 'Novo cartão'" @close="editing = null">
      <form class="flex flex-col gap-space-md" @submit.prevent="save">
        <label class="flex flex-col gap-1">
          <span :class="label">Nome</span>
          <input v-model="editing.name" required maxlength="40" placeholder="Ex: Nubank, Inter" :class="input" />
        </label>
        <label class="flex flex-col gap-1">
          <span :class="label">Dia de fechamento da fatura</span>
          <input v-model="editing.closing_day" type="number" min="1" max="31" required :class="input" />
        </label>
        <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>
        <div class="flex gap-space-sm justify-end">
          <button type="button" class="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg" @click="editing = null">Cancelar</button>
          <button type="submit" :disabled="busy" class="bg-primary text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg disabled:opacity-60">{{ busy ? 'Salvando…' : 'Salvar' }}</button>
        </div>
      </form>
    </Modal>
  </section>
</template>
