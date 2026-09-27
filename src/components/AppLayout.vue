<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { state, openExpenseForm, closeExpenseForm, signOut } from '../lib/store.js'
import { monthLabel, prevMonth, nextMonth } from '../lib/month.js'
import ExpenseForm from './ExpenseForm.vue'
import { theme, themeOptions, cycleTheme } from '../lib/theme.js'
import { startTour, maybeStartTour } from '../lib/tour.js'

const router = useRouter()
const nav = [
  { to: '/', icon: 'dashboard', label: 'Visão Geral', short: 'Geral' },
  { to: '/fixos', icon: 'home_work', label: 'Custos Fixos', short: 'Fixos' },
  { to: '/individual', icon: 'person_outline', label: 'Meu Espaço', short: 'Meu espaço' },
  { to: '/acerto', icon: 'balance', label: 'Acerto de Contas & Metas', short: 'Acerto' },
  { to: '/ajuda', icon: 'help', label: 'Como usar', short: 'Ajuda' },
]
const currentTheme = computed(() => themeOptions.find((o) => o.value === theme.value))
const couple = computed(() => state.members.map((m) => m.name).join(' & '))

async function logout() {
  try {
    await signOut()
    router.push('/login')
  } catch (e) {
    alert(`Não foi possível sair: ${e.message}`)
  }
}

const onKey = (e) => e.key === 'Escape' && closeExpenseForm()
watch(
  () => state.form.open,
  (open) => (open ? addEventListener('keydown', onKey) : removeEventListener('keydown', onKey)),
)
onBeforeUnmount(() => removeEventListener('keydown', onKey))
// Household loads async after login; start once members are known.
watch(() => state.members.length, (n) => n && maybeStartTour(router), { immediate: true })
</script>

<template>
  <!-- Sidebar (md+) -->
  <aside class="hidden md:flex fixed left-0 top-0 h-full w-56 bg-surface-container-low shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex-col justify-between p-space-md">
    <div class="flex flex-col gap-space-lg">
      <div class="flex items-center gap-space-sm px-space-xs py-space-xs">
        <img src="../assets/logo.svg" alt="" class="h-8 w-8" />
        <div class="flex flex-col">
          <span class="font-headline-sm text-headline-sm text-primary font-bold leading-none">DuoFinance</span>
          <span class="font-label-sm text-label-sm text-on-surface-variant leading-tight">Finanças a Dois</span>
        </div>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col min-w-0">
        <span class="font-label-lg text-label-lg text-on-surface truncate">{{ couple }}</span>
        <span class="font-body-sm text-body-sm text-on-surface-variant truncate">{{ state.household?.name }}</span>
      </div>
      <nav data-tour="nav" class="flex flex-col gap-space-xs">
        <RouterLink v-for="n in nav" :key="n.to" :to="n.to"
          class="flex items-center gap-space-sm px-space-md py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all font-body-md text-body-md"
          active-class="!bg-primary-container !text-on-primary-container font-semibold">
          <span class="material-symbols-outlined text-[20px]">{{ n.icon }}</span>
          <span>{{ n.label }}</span>
        </RouterLink>
      </nav>
    </div>
    <div class="flex flex-col gap-space-sm">
      <div data-tour="theme" role="radiogroup" aria-label="Tema" class="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface-container">
        <button v-for="o in themeOptions" :key="o.value" type="button" role="radio" :aria-checked="theme === o.value" :aria-label="o.label" :title="o.label"
          class="h-8 flex items-center justify-center rounded-md transition-colors"
          :class="theme === o.value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'"
          @click="theme = o.value">
          <span class="material-symbols-outlined text-[18px]">{{ o.icon }}</span>
        </button>
      </div>
      <button type="button" data-tour="tour-button" class="flex items-center gap-space-sm px-space-md py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all font-body-md text-body-md" @click="startTour(router)">
        <span class="material-symbols-outlined text-[20px]">tour</span>
        <span>Fazer tour</span>
      </button>
      <button type="button" data-tour="logout" class="flex items-center gap-space-sm px-space-md py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all font-body-md text-body-md" @click="logout">
        <span class="material-symbols-outlined text-[20px]">logout</span>
        <span>Sair</span>
      </button>
    </div>
  </aside>

  <!-- Top bar -->
  <header class="fixed top-0 right-0 left-0 md:left-56 h-16 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-4 md:px-space-xl flex items-center justify-between gap-2">
    <div data-tour="month" class="flex items-center bg-surface-container-lowest rounded-lg p-1 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
      <button type="button" aria-label="Mês anterior" class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors" @click="state.month = prevMonth(state.month)">
        <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      <div class="flex items-center gap-1.5 px-2 sm:px-3 py-1">
        <span class="material-symbols-outlined text-[18px] text-primary">calendar_today</span>
        <span class="font-label-lg text-label-lg text-on-surface font-semibold whitespace-nowrap">{{ monthLabel(state.month) }}</span>
      </div>
      <button type="button" aria-label="Próximo mês" class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors" @click="state.month = nextMonth(state.month)">
        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
    </div>
    <div class="flex items-center gap-2">
      <button type="button" data-tour="new-expense" aria-label="Novo Lançamento" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-3 sm:px-4 py-2 rounded-lg transition-all shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] active:scale-95" @click="openExpenseForm()">
        <span class="material-symbols-outlined text-[18px]">add</span>
        <span class="hidden sm:inline">Novo Lançamento</span>
      </button>
      <button type="button" :aria-label="`${currentTheme.label} (trocar)`" :title="currentTheme.label" data-tour="theme" class="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" @click="cycleTheme">
        <span class="material-symbols-outlined text-[20px]">{{ currentTheme.icon }}</span>
      </button>
      <button type="button" data-tour="logout" aria-label="Sair" class="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" @click="logout">
        <span class="material-symbols-outlined text-[20px]">logout</span>
      </button>
    </div>
  </header>

  <main class="md:pl-56 pt-16 pb-24 md:pb-0 min-h-screen bg-surface">
    <div class="px-4 py-space-lg md:px-space-xl md:py-space-xl flex flex-col gap-space-lg w-full max-w-[1600px] mx-auto">
      <slot />
    </div>
  </main>

  <!-- Bottom nav (mobile) -->
  <nav data-tour="nav" class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest shadow-[0_-1px_8px_rgba(0,0,0,0.06)] grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
    <RouterLink v-for="n in nav" :key="n.to" :to="n.to"
      class="flex flex-col items-center gap-0.5 py-2 text-on-surface-variant font-label-sm text-label-sm"
      active-class="!text-primary">
      <span class="material-symbols-outlined text-[22px]">{{ n.icon }}</span>
      <span>{{ n.short }}</span>
    </RouterLink>
  </nav>

  <!-- Expense modal: opened anywhere via openExpenseForm(expense?, defaults?) -->
  <div v-if="state.form.open" class="fixed inset-0 z-[60] bg-scrim/40 dark:bg-scrim/60 flex items-end md:items-center justify-center md:p-4" @click.self="closeExpenseForm()">
    <div role="dialog" aria-modal="true" aria-labelledby="expense-form-title" class="w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-surface-container-lowest rounded-t-xl md:rounded-xl p-space-lg shadow-xl flex flex-col gap-space-md">
      <div class="flex items-center justify-between">
        <h2 id="expense-form-title" class="font-headline-sm text-headline-sm text-on-surface">{{ state.form.expense ? 'Editar lançamento' : 'Novo lançamento' }}</h2>
        <button type="button" aria-label="Fechar" class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" @click="closeExpenseForm()">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <ExpenseForm :expense="state.form.expense" :defaults="state.form.defaults" @saved="closeExpenseForm()" @cancel="closeExpenseForm()" />
    </div>
  </div>
</template>
