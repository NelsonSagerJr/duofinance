<script setup>
import { ref, computed, watch } from 'vue'
import { state, memberName, listFixedBills, listExpenses, deleteFixedBill, markBillPaid, deleteExpense } from '../lib/store.js'
import { formatBRL, plural } from '../lib/money.js'
import { categoryById } from '../lib/categories.js'
import { monthRange, monthLabel, dueDate, todayISO } from '../lib/month.js'
import Modal from '../components/FixedBills/Modal.vue'
import BillForm from '../components/FixedBills/BillForm.vue'

const bills = ref([])
const expenses = ref([])
const loading = ref(true)
const error = ref('') // load error
const actionError = ref('') // error from pay/delete/undo
const busyId = ref(null)
const editing = ref(null) // null = closed, {} = new, row = edit
const paying = ref(null) // bill being marked as paid

let seq = 0
async function load() {
  const mine = ++seq // ignore stale responses when the month changes fast
  loading.value = true
  error.value = ''
  try {
    const [b, e] = await Promise.all([listFixedBills(), listExpenses(monthRange(state.month))])
    if (mine !== seq) return
    bills.value = b
    expenses.value = e
  } catch (e) {
    if (mine === seq) error.value = e.message
  } finally {
    if (mine === seq) loading.value = false
  }
}
watch(() => [state.month, state.version], load, { immediate: true })

const STATUS = {
  paga: { label: 'Paga', cls: 'bg-primary-fixed text-on-primary-fixed', dot: 'bg-primary' },
  pendente: { label: 'Pendente', cls: 'bg-secondary-fixed text-on-secondary-fixed', dot: 'bg-secondary' },
  vencida: { label: 'Vencida', cls: 'bg-tertiary-fixed text-on-tertiary-fixed', dot: 'bg-tertiary' },
  inativa: { label: 'Inativa', cls: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-outline' },
}

const rows = computed(() => {
  const today = todayISO()
  return bills.value.map((bill) => {
    const payment = expenses.value.find((e) => e.fixed_bill_id === bill.id && e.bill_month === state.month) || null
    const due = dueDate(state.month, bill.due_day)
    const status = payment ? 'paga' : !bill.active ? 'inativa' : today > due ? 'vencida' : 'pendente'
    return { bill, payment, due, status }
  })
})

const totals = computed(() => {
  const active = rows.value.filter((r) => r.bill.active)
  const sum = (list, f) => list.reduce((s, r) => s + f(r), 0)
  return {
    total: sum(active, (r) => r.bill.amount_cents),
    paid: sum(rows.value.filter((r) => r.payment), (r) => r.payment.amount_cents),
    open: sum(active.filter((r) => !r.payment), (r) => r.bill.amount_cents),
    openCount: active.filter((r) => !r.payment).length,
    overdue: active.filter((r) => r.status === 'vencida').length,
  }
})

const shortDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

async function run(id, fn) {
  actionError.value = ''
  busyId.value = id
  try {
    await fn()
  } catch (e) {
    actionError.value = e.code === '23505' ? 'Essa conta já foi paga neste mês.' : e.message
  } finally {
    busyId.value = null
  }
}

function pay(member) {
  const bill = paying.value
  paying.value = null
  run(bill.id, () => markBillPaid(bill, state.month, member.user_id))
}

function undo(r) {
  if (!confirm(`Desfazer o pagamento de "${r.bill.name}" em ${monthLabel(state.month)}?`)) return
  run(r.bill.id, () => deleteExpense(r.payment.id))
}

function remove(bill) {
  if (!confirm(`Excluir a conta fixa "${bill.name}"? Pagamentos já lançados continuam no histórico.`)) return
  editing.value = null
  run(bill.id, () => deleteFixedBill(bill.id))
}

const iconBtn = 'w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50'
</script>

<template>
  <div class="flex flex-col gap-space-lg">
    <!-- Header -->
    <div data-tour="fixos-header" class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
      <div class="flex flex-col">
        <h1 class="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Custos Fixos da Casa</h1>
        <p class="font-body-md text-body-md text-on-surface-variant">Contas recorrentes de {{ monthLabel(state.month) }}.</p>
      </div>
      <button type="button" data-tour="add-bill" class="self-start sm:self-auto inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all shadow-md active:scale-95" @click="editing = {}">
        <span class="material-symbols-outlined text-[20px]">add_circle</span>
        Adicionar Custo Fixo
      </button>
    </div>

    <div v-if="error" role="alert" class="rounded-xl bg-error-container text-on-error-container p-space-md flex items-center justify-between gap-space-md">
      <span class="text-body-md">Não foi possível carregar as contas: {{ error }}</span>
      <button type="button" class="font-label-lg text-label-lg underline shrink-0" @click="load">Tentar de novo</button>
    </div>

    <template v-else>
      <!-- Metric cards -->
      <div data-tour="fixos-totals" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden">
          <div class="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
          <div class="flex items-center justify-between">
            <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Total Custos Fixos</span>
            <div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[20px]">account_balance_wallet</span></div>
          </div>
          <div class="my-2 font-numeric-stat text-numeric-stat text-on-surface whitespace-nowrap">{{ formatBRL(totals.total) }}</div>
          <div class="font-body-sm text-body-sm text-on-surface-variant">{{ plural(rows.filter((r) => r.bill.active).length, 'conta ativa', 'contas ativas') }}</div>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden">
          <div class="absolute top-0 left-0 right-0 h-1 bg-primary-container"></div>
          <div class="flex items-center justify-between">
            <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Já Pago</span>
            <div class="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed"><span class="material-symbols-outlined text-[20px]">check_circle</span></div>
          </div>
          <div class="my-2 font-numeric-stat text-numeric-stat text-primary whitespace-nowrap">{{ formatBRL(totals.paid) }}</div>
          <div class="font-body-sm text-body-sm text-on-surface-variant">{{ plural(rows.filter((r) => r.payment).length, 'conta paga', 'contas pagas') }}</div>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden">
          <div class="absolute top-0 left-0 right-0 h-1 bg-tertiary"></div>
          <div class="flex items-center justify-between">
            <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Restante a Pagar</span>
            <div class="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary"><span class="material-symbols-outlined text-[20px]">hourglass_top</span></div>
          </div>
          <div class="my-2 font-numeric-stat text-numeric-stat text-on-surface whitespace-nowrap">{{ formatBRL(totals.open) }}</div>
          <div class="font-body-sm text-body-sm" :class="totals.overdue ? 'text-tertiary font-semibold' : 'text-on-surface-variant'">
            {{ plural(totals.openCount, 'pendente', 'pendentes') }}<template v-if="totals.overdue"> · {{ totals.overdue }} vencida{{ totals.overdue > 1 ? 's' : '' }}</template>
          </div>
        </div>
      </div>

      <p v-if="actionError" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ actionError }}</p>

      <!-- Bills list -->
      <section data-tour="bills-list" class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div class="flex items-center gap-3 p-space-md md:px-6">
          <div class="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0"><span class="material-symbols-outlined">home_work</span></div>
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex-1">Contas recorrentes</h2>
          <span v-if="!loading" class="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">{{ bills.length }}</span>
        </div>

        <p v-if="loading" class="px-6 py-10 text-center text-body-md text-on-surface-variant">Carregando…</p>

        <div v-else-if="!bills.length" class="px-6 py-10 flex flex-col items-center gap-space-sm text-center">
          <span class="material-symbols-outlined text-[40px] text-outline">receipt_long</span>
          <p class="text-body-md text-on-surface-variant">Nenhuma conta fixa cadastrada ainda.</p>
          <button type="button" class="font-label-lg text-label-lg text-primary hover:underline" @click="editing = {}">Adicionar a primeira</button>
        </div>

        <ul v-else class="divide-y divide-surface-container">
          <li v-for="r in rows" :key="r.bill.id"
            class="flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-2 px-space-md md:px-6 py-4 hover:bg-surface-container-low/70 transition-colors"
            :class="{ 'opacity-60': !r.bill.active && !r.payment }">
            <!-- Name / category -->
            <div class="flex items-center gap-3 min-w-0 flex-1 basis-full md:basis-auto">
              <div class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                <span class="material-symbols-outlined text-[20px]">{{ categoryById(r.bill.category).icon }}</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-semibold text-body-md text-on-surface truncate">{{ r.bill.name }}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant truncate">{{ categoryById(r.bill.category).label }}</span>
              </div>
              <span class="ml-auto md:hidden font-semibold text-body-lg text-on-surface whitespace-nowrap">{{ formatBRL(r.bill.amount_cents) }}</span>
            </div>

            <!-- Due -->
            <div class="flex flex-col md:w-36 shrink-0">
              <span class="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
                <span class="material-symbols-outlined text-[16px]" :class="r.status === 'vencida' ? 'text-tertiary' : 'text-primary'">event</span>
                Todo dia {{ r.bill.due_day }}
              </span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">
                <template v-if="r.payment">Pago por {{ memberName(r.payment.paid_by) }}</template>
                <template v-else>Vence {{ shortDate(r.due) }}</template>
              </span>
            </div>

            <span class="hidden md:block w-32 shrink-0 text-right font-semibold font-headline-sm text-headline-sm text-on-surface whitespace-nowrap">{{ formatBRL(r.bill.amount_cents) }}</span>

            <!-- Status -->
            <span class="md:w-24 shrink-0 md:text-center">
              <span data-tour="bill-status" class="inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold" :class="STATUS[r.status].cls">
                <span class="w-1.5 h-1.5 rounded-full" :class="STATUS[r.status].dot"></span>{{ STATUS[r.status].label }}
              </span>
            </span>

            <!-- Actions -->
            <div data-tour="bill-actions" class="flex items-center justify-end gap-1 ml-auto md:ml-0 shrink-0">
              <button v-if="!r.payment && r.bill.active" type="button" data-tour="bill-pay" :disabled="busyId === r.bill.id"
                class="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-primary text-on-primary hover:bg-primary/90 font-label-md text-label-md transition-all active:scale-95 disabled:opacity-50"
                @click="paying = r.bill">
                <span class="material-symbols-outlined text-[18px]">check_circle</span>Marcar como paga
              </button>
              <button v-if="r.payment" type="button" :disabled="busyId === r.bill.id" :class="iconBtn" class="text-on-surface-variant" title="Desfazer pagamento" aria-label="Desfazer pagamento" @click="undo(r)">
                <span class="material-symbols-outlined text-[20px]">undo</span>
              </button>
              <button type="button" :disabled="busyId === r.bill.id" :class="iconBtn" class="text-on-surface-variant" title="Editar" aria-label="Editar" @click="editing = r.bill">
                <span class="material-symbols-outlined text-[20px]">edit</span>
              </button>
              <button type="button" :disabled="busyId === r.bill.id" :class="iconBtn" class="text-error" title="Excluir" aria-label="Excluir" @click="remove(r.bill)">
                <span class="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
          </li>
        </ul>

        <div v-if="!loading && bills.length" class="flex items-center justify-end gap-1 px-space-md md:px-6 py-3 bg-surface-container-low text-body-sm text-on-surface-variant">
          Total mensal: <strong class="text-on-surface">{{ formatBRL(totals.total) }}</strong>
        </div>
      </section>
    </template>

    <Modal v-if="editing" :title="editing.id ? 'Editar custo fixo' : 'Novo custo fixo'" @close="editing = null">
      <BillForm :bill="editing.id ? editing : null" @saved="editing = null" @cancel="editing = null" />
    </Modal>

    <Modal v-if="paying" title="Quem pagou?" @close="paying = null">
      <p class="text-body-md text-on-surface-variant">{{ paying.name }} · {{ formatBRL(paying.amount_cents) }} · {{ monthLabel(state.month) }}</p>
      <div class="flex gap-space-sm">
        <button v-for="m in state.members" :key="m.user_id" type="button"
          class="flex-1 min-w-0 truncate px-3 py-3 rounded-lg bg-surface-container-low hover:bg-primary-container hover:text-on-primary-container text-on-surface font-label-lg text-label-lg transition-colors"
          @click="pay(m)">{{ m.name }}</button>
      </div>
    </Modal>
  </div>
</template>
