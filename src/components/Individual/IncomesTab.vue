<script setup>
import { ref, computed } from 'vue'
import { markIncomeReceived, deleteIncome, deleteRecurringIncome } from '../../lib/store.js'
import { formatBRL } from '../../lib/money.js'
import { categoryById, chipClass } from '../../lib/categories.js'
import { monthLabel, monthRange, dueDate, todayISO } from '../../lib/month.js'
import Modal from '../FixedBills/Modal.vue'
import IncomeForm from './IncomeForm.vue'

const props = defineProps({ view: { type: Object, required: true } })

const inMonth = (d) => d >= monthRange(props.view.month).start && d < monthRange(props.view.month).end
const monthIncomes = computed(() => props.view.incomes.filter((i) => inMonth(i.received_on)))
const total = computed(() => monthIncomes.value.reduce((s, i) => s + i.amount_cents, 0))

// Fixed incomes with this month's status. Received = an income for (recurring_income_id, month) exists.
const fixed = computed(() => {
  const today = todayISO()
  return props.view.recurring.map((r) => {
    const income = props.view.incomes.find((i) => i.recurring_income_id === r.id && i.income_month === props.view.month) || null
    const due = dueDate(props.view.month, r.day)
    return { r, income, due, status: income ? 'recebida' : !r.active ? 'inativa' : today >= due ? 'atrasada' : 'pendente' }
  })
})
const pendingTotal = computed(() => fixed.value.filter((f) => !f.income && f.r.active).reduce((s, f) => s + f.r.amount_cents, 0))
const avulsas = computed(() => monthIncomes.value.filter((i) => !i.recurring_income_id || !props.view.recurring.some((r) => r.id === i.recurring_income_id)))

const STATUS = {
  recebida: { label: 'Recebida', cls: 'bg-primary-fixed text-on-primary-fixed' },
  pendente: { label: 'Pendente', cls: 'bg-secondary-fixed text-on-secondary-fixed' },
  atrasada: { label: 'Aguardando', cls: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  inativa: { label: 'Inativa', cls: 'bg-surface-container-high text-on-surface-variant' },
}

const editing = ref(null) // { row, recurring }
const busyId = ref(null)
const actionError = ref('')
async function run(id, fn) {
  actionError.value = ''
  busyId.value = id
  try {
    await fn()
  } catch (e) {
    actionError.value = e.code === '23505' ? 'Essa renda já foi marcada como recebida neste mês.' : e.message
  } finally {
    busyId.value = null
  }
}
const receive = (f) => run(f.r.id, () => markIncomeReceived(f.r, props.view.month))
function undo(f) {
  if (confirm(`Desfazer o recebimento de "${f.r.name}" em ${monthLabel(props.view.month)}?`)) run(f.r.id, () => deleteIncome(f.income.id))
}
function removeRecurring(r) {
  if (!confirm(`Excluir a renda fixa "${r.name}"? Os recebimentos já lançados continuam no histórico.`)) return
  editing.value = null
  run(r.id, () => deleteRecurringIncome(r.id))
}
function removeIncome(i) {
  if (confirm(`Excluir "${i.description}" (${formatBRL(i.amount_cents)})?`)) run(i.id, () => deleteIncome(i.id))
}

const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const card = 'bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden'
const iconBtn = 'w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50'
const primaryBtn = 'inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95'
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-1">
      <span class="font-body-sm text-body-sm text-on-surface-variant">Entradas em {{ monthLabel(view.month) }}</span>
      <span class="font-numeric-stat text-numeric-stat text-on-surface whitespace-nowrap truncate">{{ formatBRL(total) }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant">{{ monthIncomes.length }} lançamento(s)</span>
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-1">
      <span class="font-body-sm text-body-sm text-on-surface-variant">Rendas fixas a receber</span>
      <span class="font-numeric-stat text-numeric-stat text-on-surface whitespace-nowrap truncate">{{ formatBRL(pendingTotal) }}</span>
      <span class="font-label-sm text-label-sm text-on-surface-variant">ainda não marcadas como recebidas</span>
    </div>
  </div>

  <p v-if="actionError" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ actionError }}</p>

  <!-- Rendas fixas -->
  <section data-tour="recurring-list" :class="card">
    <div class="flex flex-wrap items-center gap-3 p-space-md md:px-6">
      <div class="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0"><span class="material-symbols-outlined">event_repeat</span></div>
      <div class="flex-1 min-w-[10rem]">
        <h2 class="font-headline-sm text-headline-sm text-on-surface">Rendas fixas</h2>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Salário e o que cai todo mês. Marque quando receber.</p>
      </div>
      <button type="button" data-tour="add-recurring" :class="primaryBtn" @click="editing = { row: null, recurring: true }">
        <span class="material-symbols-outlined text-[18px]">add_circle</span>Nova renda fixa
      </button>
    </div>
    <div v-if="!fixed.length" class="px-6 pb-8 pt-2 flex flex-col items-center gap-space-sm text-center">
      <span class="material-symbols-outlined text-[40px] text-outline">work</span>
      <p class="text-body-md text-on-surface-variant max-w-md">Cadastre seu salário uma vez (valor e dia em que cai). Todo mês ele aparece aqui como pendente, e um toque em <b class="text-on-surface">Marcar como recebida</b> lança a entrada.</p>
    </div>
    <ul v-else class="divide-y divide-surface-container">
      <li v-for="f in fixed" :key="f.r.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-space-md md:px-6 py-4" :class="{ 'opacity-60': f.status === 'inativa' }">
        <div class="flex items-center gap-3 min-w-0 flex-1 basis-full sm:basis-auto">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" :class="chipClass(categoryById(f.r.category_id))"><span class="material-symbols-outlined text-[20px]">{{ categoryById(f.r.category_id).icon }}</span></div>
          <div class="flex flex-col min-w-0">
            <span class="font-semibold text-body-md text-on-surface truncate">{{ f.r.name }}</span>
            <span class="font-body-sm text-body-sm text-on-surface-variant">{{ categoryById(f.r.category_id).name }} · todo dia {{ f.r.day }}<template v-if="f.income"> · recebida {{ ddmm(f.income.received_on) }}</template></span>
          </div>
          <span class="ml-auto font-semibold text-body-lg text-on-surface whitespace-nowrap">{{ formatBRL(f.income?.amount_cents ?? f.r.amount_cents) }}</span>
        </div>
        <span data-tour="recurring-status" class="inline-flex px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold" :class="STATUS[f.status].cls">{{ STATUS[f.status].label }}</span>
        <div class="flex items-center gap-1 ml-auto">
          <button v-if="!f.income && f.r.active" type="button" data-tour="recurring-receive" :disabled="busyId === f.r.id"
            class="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-primary text-on-primary hover:bg-primary/90 font-label-md text-label-md active:scale-95 disabled:opacity-50" @click="receive(f)">
            <span class="material-symbols-outlined text-[18px]">check_circle</span>Marcar como recebida
          </button>
          <button v-if="f.income" type="button" :disabled="busyId === f.r.id" :class="iconBtn" title="Desfazer recebimento" aria-label="Desfazer recebimento" @click="undo(f)"><span class="material-symbols-outlined text-[20px]">undo</span></button>
          <button type="button" :disabled="busyId === f.r.id" :class="iconBtn" title="Editar" :aria-label="`Editar ${f.r.name}`" @click="editing = { row: f.r, recurring: true }"><span class="material-symbols-outlined text-[20px]">edit</span></button>
          <button type="button" :disabled="busyId === f.r.id" :class="iconBtn" class="!text-error" title="Excluir" :aria-label="`Excluir ${f.r.name}`" @click="removeRecurring(f.r)"><span class="material-symbols-outlined text-[20px]">delete</span></button>
        </div>
      </li>
    </ul>
  </section>

  <!-- Entradas avulsas -->
  <section data-tour="incomes-list" :class="card">
    <div class="flex flex-wrap items-center gap-3 p-space-md md:px-6">
      <div class="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0"><span class="material-symbols-outlined">payments</span></div>
      <div class="flex-1 min-w-[10rem]">
        <h2 class="font-headline-sm text-headline-sm text-on-surface">Entradas avulsas</h2>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Freela, bônus, venda… o que não se repete.</p>
      </div>
      <button type="button" data-tour="add-income" :class="primaryBtn" @click="editing = { row: null, recurring: false }">
        <span class="material-symbols-outlined text-[18px]">add_circle</span>Nova entrada
      </button>
    </div>
    <p v-if="!avulsas.length" class="px-6 pb-8 pt-2 text-center text-body-md text-on-surface-variant">Nenhuma entrada avulsa em {{ monthLabel(view.month) }}. Recebeu um extra? Lance em <b class="text-on-surface">Nova entrada</b>.</p>
    <ul v-else class="divide-y divide-surface-container max-h-[28rem] overflow-y-auto overscroll-contain">
      <li v-for="i in avulsas" :key="i.id" class="flex items-center justify-between gap-2 px-space-md md:px-6 py-3.5">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center shrink-0" :class="chipClass(categoryById(i.category_id))"><span class="material-symbols-outlined text-[20px]">{{ categoryById(i.category_id).icon }}</span></div>
          <div class="flex flex-col min-w-0">
            <span class="font-semibold text-body-md text-on-surface truncate">{{ i.description }}</span>
            <span class="font-body-sm text-body-sm text-on-surface-variant">{{ ddmm(i.received_on) }} · {{ categoryById(i.category_id).name }}</span>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <span class="font-label-lg text-label-lg text-on-surface whitespace-nowrap mr-1">{{ formatBRL(i.amount_cents) }}</span>
          <button type="button" :class="iconBtn" title="Editar" :aria-label="`Editar ${i.description}`" @click="editing = { row: i, recurring: false }"><span class="material-symbols-outlined text-[18px]">edit</span></button>
          <button type="button" :disabled="busyId === i.id" :class="iconBtn" class="hover:!bg-error-container hover:!text-on-error-container" title="Excluir" :aria-label="`Excluir ${i.description}`" @click="removeIncome(i)"><span class="material-symbols-outlined text-[18px]">delete</span></button>
        </div>
      </li>
    </ul>
  </section>

  <Modal v-if="editing" :title="editing.recurring ? (editing.row ? 'Editar renda fixa' : 'Nova renda fixa') : editing.row ? 'Editar entrada' : 'Nova entrada'" @close="editing = null">
    <IncomeForm :row="editing.row" :recurring="editing.recurring" @saved="editing = null" @cancel="editing = null" />
  </Modal>
</template>
