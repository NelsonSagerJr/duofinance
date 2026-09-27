<script setup>
defineProps({ label: String, icon: String, value: String })
</script>

<template>
  <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm min-w-0">
    <div class="flex items-start justify-between gap-2">
      <span class="font-body-sm text-body-sm text-on-surface-variant truncate">{{ label }}</span>
      <div class="w-8 h-8 shrink-0 rounded-lg bg-surface-container flex items-center justify-center text-primary">
        <span class="material-symbols-outlined text-[20px]">{{ icon }}</span>
      </div>
    </div>
    <div class="font-numeric-stat text-numeric-stat text-on-surface whitespace-nowrap truncate">{{ value }}</div>
    <div class="font-label-sm text-label-sm text-on-surface-variant"><slot /></div>
  </div>
</template>
