<script setup>
defineProps({ title: { type: String, required: true } })
const emit = defineEmits(['close'])
</script>

<template>
  <div class="fixed inset-0 z-[60] bg-scrim/40 dark:bg-scrim/60 flex items-end md:items-center justify-center md:p-4" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div role="dialog" aria-modal="true" :aria-label="title" class="w-full md:max-w-md max-h-[92vh] overflow-y-auto bg-surface-container-lowest rounded-t-xl md:rounded-xl p-space-lg shadow-xl flex flex-col gap-space-md">
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-headline-sm text-headline-sm text-on-surface">{{ title }}</h2>
        <button type="button" aria-label="Fechar" class="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" @click="emit('close')">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <slot />
    </div>
  </div>
</template>
