<script setup>
import { ref, computed, watch } from 'vue'
import { state, me, memberName, listFeedback, setFeedbackStatus, deleteFeedback } from '../lib/store.js'
import { SCREENS, KINDS, screenLabel, feedbackMarkdown, copyText } from '../lib/feedback.js'

const items = ref([])
const loading = ref(true)
const error = ref('')
const busyId = ref(null)

let req = 0
async function load() {
  const id = ++req
  loading.value = true
  error.value = ''
  try {
    const rows = await listFeedback()
    if (id === req) items.value = rows
  } catch (e) {
    if (id === req) error.value = e.message
  } finally {
    if (id === req) loading.value = false
  }
}
watch(() => state.version, load, { immediate: true })

const STATUS = [
  { id: 'open', label: 'Abertos' },
  { id: 'resolved', label: 'Resolvidos' },
  { id: 'all', label: 'Todos' },
]
const status = ref('open')
const screen = ref('')
const count = (s) => items.value.filter((i) => s === 'all' || i.status === s).length
// Only screens that have feedback, in app order, plus anything outside the list.
const screens = computed(() => {
  const used = new Set(items.value.map((i) => i.route))
  return [...SCREENS.filter((s) => used.delete(s.route)), ...[...used].map((route) => ({ route, label: route }))]
})
const shown = computed(() =>
  items.value.filter((i) => (status.value === 'all' || i.status === status.value) && (!screen.value || i.route === screen.value)),
)

async function run(id, fn) {
  error.value = ''
  busyId.value = id
  try {
    await fn()
  } catch (e) {
    error.value = e.message
  } finally {
    busyId.value = null
  }
}
const toggle = (i) => run(i.id, () => setFeedbackStatus(i.id, i.status === 'open' ? 'resolved' : 'open'))
function remove(i) {
  if (confirm('Excluir este feedback?')) run(i.id, () => deleteFeedback(i.id))
}

const copied = ref('')
async function copyOpen() {
  const ok = await copyText(feedbackMarkdown(items.value, memberName))
  copied.value = ok ? `Copiado: ${count('open')} aberto(s), em markdown.` : 'Não deu para copiar neste navegador.'
  setTimeout(() => (copied.value = ''), 4000)
}

const when = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const seg = (on) =>
  `px-3 py-1.5 rounded-md font-label-lg text-label-lg transition-colors ${on ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`
</script>

<template>
  <div class="flex flex-col gap-space-lg max-w-4xl">
    <header class="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
      <div>
        <h1 class="font-headline-lg text-headline-lg md:font-headline-xl md:text-headline-xl text-on-surface">Feedback</h1>
        <p class="text-body-md text-on-surface-variant mt-1">O que melhorar no app. Os dois veem tudo e qualquer um marca como resolvido.</p>
      </div>
      <div class="flex flex-wrap gap-space-sm shrink-0">
        <button type="button" data-tour="feedback-copy" :disabled="!count('open')"
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-lg text-label-lg active:scale-95 disabled:opacity-50"
          @click="copyOpen">
          <span class="material-symbols-outlined text-[18px]">content_copy</span>Copiar abertos para o Claude
        </button>
        <button type="button" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg active:scale-95" @click="state.feedbackOpen = true">
          <span class="material-symbols-outlined text-[18px]">add</span>Novo feedback
        </button>
      </div>
    </header>

    <p v-if="copied" role="status" class="rounded-lg bg-primary-fixed text-on-primary-fixed px-3 py-2 text-body-sm">{{ copied }}</p>
    <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>

    <div data-tour="feedback-filters" class="flex flex-wrap items-center gap-space-sm">
      <div role="group" aria-label="Situação" class="flex bg-surface-container rounded-lg p-1 gap-1">
        <button v-for="s in STATUS" :key="s.id" type="button" :aria-pressed="status === s.id" :class="seg(status === s.id)" @click="status = s.id">
          {{ s.label }} <span class="font-label-sm text-label-sm opacity-70">{{ count(s.id) }}</span>
        </button>
      </div>
      <select v-model="screen" aria-label="Filtrar por tela" class="rounded-lg border-0 bg-surface-container-lowest shadow-sm px-3 py-2 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none">
        <option value="">Todas as telas</option>
        <option v-for="s in screens" :key="s.route" :value="s.route">{{ s.label }}</option>
      </select>
    </div>

    <p v-if="loading && !items.length" class="text-body-md text-on-surface-variant">Carregando…</p>
    <div v-else-if="!shown.length" class="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col items-center gap-space-sm text-center">
      <span class="material-symbols-outlined text-[40px] text-outline">rate_review</span>
      <p class="text-body-md text-on-surface-variant max-w-md">
        <template v-if="items.length">Nada com esses filtros.</template>
        <template v-else>Nenhum feedback ainda. Achou um problema ou sentiu falta de algo? Use o botão <b class="text-on-surface">Feedback</b> no canto da tela, em qualquer página.</template>
      </p>
    </div>

    <ul v-else data-tour="feedback-list" class="flex flex-col gap-space-sm">
      <li v-for="i in shown" :key="i.id" class="bg-surface-container-lowest rounded-xl shadow-sm p-space-md md:p-space-lg flex flex-col gap-2" :class="{ 'opacity-70': i.status === 'resolved' }">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold" :class="KINDS[i.kind]?.cls">
            <span class="material-symbols-outlined text-[14px]">{{ KINDS[i.kind]?.icon }}</span>{{ KINDS[i.kind]?.label || i.kind }}
          </span>
          <span class="font-label-md text-label-md text-on-surface">{{ screenLabel(i.route) }}</span>
          <span v-if="i.status === 'resolved'" class="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary"><span class="material-symbols-outlined text-[14px]">check_circle</span>Resolvido</span>
        </div>
        <p class="text-body-md text-on-surface whitespace-pre-line break-words">{{ i.message }}</p>
        <p v-if="i.element" class="flex items-start gap-1.5 text-body-sm text-on-surface-variant min-w-0">
          <span class="material-symbols-outlined text-[16px] shrink-0 mt-0.5">ads_click</span><code class="break-words min-w-0">{{ i.element }}</code>
        </p>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-body-sm text-body-sm text-on-surface-variant">{{ memberName(i.user_id) }} · {{ when(i.created_at) }}</span>
          <span class="flex items-center gap-1">
            <button type="button" :disabled="busyId === i.id"
              class="inline-flex items-center gap-1 px-3 h-9 rounded-lg font-label-md text-label-md active:scale-95 disabled:opacity-50"
              :class="i.status === 'open' ? 'bg-primary text-on-primary hover:bg-primary/90' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'"
              @click="toggle(i)">
              <span class="material-symbols-outlined text-[18px]">{{ i.status === 'open' ? 'check' : 'undo' }}</span>{{ i.status === 'open' ? 'Resolver' : 'Reabrir' }}
            </button>
            <button v-if="i.user_id === me?.user_id" type="button" :disabled="busyId === i.id" title="Excluir" aria-label="Excluir feedback"
              class="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container disabled:opacity-50"
              @click="remove(i)"><span class="material-symbols-outlined text-[18px]">delete</span></button>
          </span>
        </div>
      </li>
    </ul>

    <aside class="rounded-xl bg-surface-container-low p-space-md flex items-start gap-3 text-body-sm text-on-surface-variant">
      <span class="material-symbols-outlined text-primary">event_repeat</span>
      <span><b class="text-on-surface">Revisão semanal:</b> uma vez por semana, toque em <b class="text-on-surface">Copiar abertos para o Claude</b>, cole numa conversa com o Claude e peça as correções. Depois marque como resolvido o que foi feito.</span>
    </aside>
  </div>
</template>
