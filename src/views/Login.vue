<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { state, signIn } from '../lib/store.js'
import { theme, themeOptions, cycleTheme } from '../lib/theme.js'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref(state.error)
const busy = ref(false)
const currentTheme = computed(() => themeOptions.find((o) => o.value === theme.value))

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await signIn(email.value.trim(), password.value)
    router.push('/')
  } catch (e) {
    error.value = e.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="relative min-h-screen bg-surface flex items-center justify-center px-4 py-10">
    <button type="button" :aria-label="`${currentTheme.label} (trocar)`" :title="currentTheme.label"
      class="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
      @click="cycleTheme">
      <span class="material-symbols-outlined text-[20px]">{{ currentTheme.icon }}</span>
    </button>
    <div class="w-full max-w-sm flex flex-col gap-space-lg">
      <div class="flex items-center justify-center gap-space-sm">
        <img src="../assets/logo.svg" alt="" class="h-10 w-10" />
        <div class="flex flex-col">
          <span class="font-headline-md text-headline-md text-primary font-bold leading-none">DuoFinance</span>
          <span class="font-label-sm text-label-sm text-on-surface-variant">Finanças a Dois</span>
        </div>
      </div>

      <form class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md" @submit.prevent="submit">
        <h1 class="font-headline-sm text-headline-sm text-on-surface">Entrar</h1>
        <label class="flex flex-col gap-1">
          <span class="font-label-md text-label-md text-on-surface-variant">E-mail</span>
          <input v-model="email" type="email" required autocomplete="email"
            class="w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md focus:ring-2 focus:ring-primary outline-none" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="font-label-md text-label-md text-on-surface-variant">Senha</span>
          <input v-model="password" type="password" required autocomplete="current-password"
            class="w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md focus:ring-2 focus:ring-primary outline-none" />
        </label>
        <p v-if="error" role="alert" class="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>
        <button type="submit" :disabled="busy"
          class="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-3 rounded-lg transition-all disabled:opacity-60">
          <span class="material-symbols-outlined text-[18px]">login</span>
          {{ busy ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </div>
  </main>
</template>
