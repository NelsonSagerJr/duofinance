<script setup>
import { arc } from './chart.js'

// Single progress ring. value = fraction (over 1 draws an inner red arc for the excess); color = token name (--c-*).
defineProps({ value: { type: Number, default: 0 }, color: { type: String, default: 'chart-worth' }, size: { type: Number, default: 84 }, thick: { type: Number, default: 8 }, text: String, sub: String })
</script>

<template>
  <svg :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size" class="block shrink-0" aria-hidden="true">
    <circle :cx="size / 2" :cy="size / 2" :r="(size - thick) / 2" fill="none" class="stroke-surface-container-highest" :stroke-width="thick" />
    <circle :cx="size / 2" :cy="size / 2" :r="(size - thick) / 2" fill="none" :style="{ stroke: `rgb(var(--c-${color}))` }" :stroke-width="thick" stroke-linecap="round"
      :stroke-dasharray="arc((size - thick) / 2, value)" :transform="`rotate(-90 ${size / 2} ${size / 2})`" />
    <circle v-if="value > 1" :cx="size / 2" :cy="size / 2" :r="(size - thick) / 2 - thick - 2" fill="none" class="stroke-tertiary" stroke-width="3" stroke-linecap="round"
      :stroke-dasharray="arc((size - thick) / 2 - thick - 2, value - 1)" :transform="`rotate(-90 ${size / 2} ${size / 2})`" />
    <text :x="size / 2" :y="size / 2 + (sub ? 2 : 5)" text-anchor="middle" :class="value > 1 ? 'fill-tertiary' : 'fill-on-surface'" class="font-bold tabular-nums" :font-size="size / 5.5">{{ text }}</text>
    <text v-if="sub" :x="size / 2" :y="size / 2 + size / 6" text-anchor="middle" class="fill-on-surface-variant" :font-size="size / 11">{{ sub }}</text>
  </svg>
</template>
