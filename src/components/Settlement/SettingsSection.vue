<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { me, partner, updateMember, signOut } from '../../lib/store.js'

const router = useRouter()
const name = ref('')
const myPct = ref(50)
const busy = ref(false)
const error = ref('')
const saved = ref(false)

watch(me, (m) => {
  if (!m) return
  name.value = m.name
  myPct.value = Number(m.default_share_pct)
}, { immediate: true })

async function save() {
  error.value = ''
  saved.value = false
  const pct = Number(myPct.value)
  if (!name.value.trim()) return (error.value = 'Informe seu nome')
  if (!(pct >= 0 && pct <= 100)) return (error.value = 'Percentual deve ficar entre 0 e 100')
  busy.value = true
  try {
    await updateMember({ name: name.value.trim(), default_share_pct: pct })
    saved.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function logout() {
  try {
    await signOut()
    router.push('/login')
  } catch (e) {
    error.value = e.message
  }
}

const input = 'w-full rounded-lg border-0 bg-surface-container-low px-3 py-2.5 text-body-md text-on-surface focus:ring-2 focus:ring-primary outline-none'
const label = 'font-label-md text-label-md text-on-surface-variant'
</script>

<template>
  <section id="configuracoes" data-tour="settings" class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
    <div>
      <h2 class="font-headline-md text-headline-md text-on-surface">Configurações</h2>
      <p class="text-body-sm text-on-surface-variant">Seu nome e a divisão padrão das despesas da casa.</p>
    </div>

    <form class="grid grid-cols-1 sm:grid-cols-2 gap-space-md" @submit.prevent="save">
      <label class="flex flex-col gap-1">
        <span :class="label">Seu nome</span>
        <input v-model="name" required maxlength="40" :class="input" />
      </label>
      <label data-tour="settings-pct" class="flex flex-col gap-1">
        <span :class="label">Sua parte nas despesas da casa (%)</span>
        <input v-model="myPct" type="number" min="0" max="100" step="1" required :class="input" />
        <span class="text-body-sm text-on-surface-variant">{{ partner?.name || 'Parceiro(a)' }} fica com {{ 100 - Number(myPct || 0) }}%.</span>
      </label>

      <p v-if="error" role="alert" class="sm:col-span-2 rounded-lg bg-error-container text-on-error-container px-3 py-2 text-body-sm">{{ error }}</p>
      <p v-else-if="saved" role="status" class="sm:col-span-2 text-body-sm text-primary">Configurações salvas.</p>

      <div class="sm:col-span-2 flex flex-wrap gap-space-sm justify-between">
        <button type="button" data-tour="settings-logout" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-tertiary hover:bg-tertiary-fixed font-label-lg text-label-lg" @click="logout">
          <span class="material-symbols-outlined text-[18px]">logout</span>Sair
        </button>
        <button type="submit" :disabled="busy"
          class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg text-label-lg px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60">
          <span class="material-symbols-outlined text-[18px]">save</span>{{ busy ? 'Salvando…' : 'Salvar' }}
        </button>
      </div>
    </form>
  </section>
</template>
