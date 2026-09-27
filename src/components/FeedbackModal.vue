<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { addFeedback } from '../lib/store.js'
import { SCREENS, KINDS, screenOf, pickElement } from '../lib/feedback.js'

const emit = defineEmits(['close'])
const route = useRoute()

const screen = ref(screenOf(route))
const element = ref('')
const kind = ref('bug')
const message = ref('')
const picking = ref(false)
const busy = ref(false)
const error = ref('')
const sent = ref(false)

const onKey = (e) => e.key === 'Escape' && !picking.value && emit('close')
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))

async function point() {
  picking.value = true
  try {
    const picked = await pickElement()
    if (picked) element.value = picked
  } finally {
    picking.value = false
  }
}

async function submit() {
  error.value = ''
  const text = message.value.trim()
  if (!text) return (error.value = 'Escreva o que aconteceu ou o que você quer.')
  busy.value = true
  try {
    await addFeedback({ route: screen.value, element: element.value || null, kind: kind.value, message: text })
    sent.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
const label = 'font-label-md text-label-md text-on-surface-variant'
const chip = (on) =>
  `flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 py-2 rounded-lg text-body-sm text-center leading-tight cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
    on ? 'bg-primary-container text-on-primary-container font-semibold' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
  }`
</script>

<template>
  <!-- v-show, not v-if: while pointing, the page underneath has to be clickable and the form keeps its state. -->
  <div v-show="!picking" class="fixed inset-0 z-[60] bg-scrim/40 dark:bg-scrim/60 flex items-end md:items-center justify-center md:p-4" @click.self="emit('close')">
    <div role="dialog" aria-modal="true" aria-labelledby="feedback-title" class="w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-surface-container-lowest rounded-t-xl md:rounded-xl p-space-lg shadow-xl flex flex-col gap-space-md">
      <div class="flex items-center justify-between gap-2">
        <h2 id="feedback-title" class="font-headline-sm text-headline-sm text-on-surface">Enviar feedback</h2>
        <button type="button" aria-label="Fechar" class="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" @click="emit('close')">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <div v-if="sent" class="flex flex-col gap-space-md">
        <p role="status" class="flex items-start gap-2 rounded-lg bg-primary-fixed text-on-primary-fixed p-3 text-body-md">
          <span class="material-symbols-outlined text-[20px]">check_circle</span>Enviado, obrigado! Os dois veem na página Feedback.
        </p>
        <div class="flex flex-wrap gap-space-sm justify-end">
          <RouterLink to="/feedback" class="px-4 py-2.5 rounded-lg text-primary hover:bg-surface-container-high font-label-lg text-label-lg" @click="emit('close')">Ver todos</RouterLink>
          <button type="button" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg active:scale-95" @click="emit('close')">Fechar</button>
        </div>
      </div>

      <form v-else class="flex flex-col gap-space-md" @submit.prevent="submit">
        <fieldset class="flex flex-col gap-1">
          <legend :class="label" class="mb-1">Tipo</legend>
          <div class="flex bg-surface-container rounded-lg p-1 gap-1">
            <label v-for="(k, id) in KINDS" :key="id" :class="chip(kind === id)">
              <input v-model="kind" type="radio" :value="id" class="sr-only" />
              <span class="material-symbols-outlined text-[18px]">{{ k.icon }}</span><span>{{ k.label }}</span>
            </label>
          </div>
        </fieldset>

        <label class="flex flex-col gap-1">
          <span :class="label">Tela</span>
          <select v-model="screen" :class="input">
            <option v-for="s in SCREENS" :key="s.route" :value="s.route">{{ s.label }}</option>
          </select>
        </label>

        <div class="flex flex-col gap-1">
          <span :class="label">Onde na tela (opcional)</span>
          <div v-if="element" class="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
            <span class="material-symbols-outlined text-[18px] text-primary shrink-0">ads_click</span>
            <code class="flex-1 min-w-0 text-body-sm text-on-surface break-words">{{ element }}</code>
            <button type="button" class="shrink-0 px-2 h-8 rounded-lg text-primary hover:bg-surface-container-high font-label-md text-label-md" @click="point">Trocar</button>
            <button type="button" aria-label="Remover elemento" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" @click="element = ''">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <button v-else type="button" data-tour="feedback-point" class="self-start inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg" @click="point">
            <span class="material-symbols-outlined text-[18px] text-primary">ads_click</span>Apontar na tela
          </button>
          <span class="text-body-sm text-on-surface-variant">Mostra de qual botão ou trecho você está falando. No Meu Espaço só o nome da área é gravado, nunca valores.</span>
        </div>

        <label class="flex flex-col gap-1">
          <span :class="label">Mensagem</span>
          <textarea v-model="message" required maxlength="2000" rows="4" placeholder="O que aconteceu? O que você esperava?" :class="input" class="resize-y min-h-[6rem]"></textarea>
          <span class="self-end font-label-sm text-label-sm text-on-surface-variant">{{ message.length }}/2000</span>
        </label>

        <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>
        <div class="flex flex-wrap items-center gap-space-sm justify-end">
          <RouterLink to="/feedback" class="mr-auto text-label-md text-primary hover:underline font-semibold" @click="emit('close')">Ver todos</RouterLink>
          <button type="button" class="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg text-label-lg" @click="emit('close')">Cancelar</button>
          <button type="submit" :disabled="busy" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60">
            <span class="material-symbols-outlined text-[18px]">send</span>{{ busy ? 'Enviando…' : 'Enviar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
