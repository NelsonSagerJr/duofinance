<script setup>
import { ref, computed } from 'vue'
import { formatBRL, formatBRLCompact } from '../../lib/money.js'
import { categoryById } from '../../lib/categories.js'

// Category split of a month. rows: [{ category, cents }] biggest first. Colors come from each category's own token.
const props = defineProps({ rows: { type: Array, required: true }, sub: String })

const S = 200
const T = 22
const R = (S - T) / 2
const L = 2 * Math.PI * R
const total = computed(() => props.rows.reduce((s, r) => s + r.cents, 0))
const segs = computed(() => {
  let off = 0
  const gap = props.rows.length > 1 ? 3 : 0
  return props.rows.map((r) => {
    const len = (r.cents / total.value) * L
    const s = { ...r, dash: `${Math.max(len - gap, 0.1)} ${L}`, off: -off }
    off += len
    return s
  })
})
const pct = (r) => Math.round((r.cents / total.value) * 100)
const color = (r) => `rgb(var(--c-${categoryById(r.category).color || 'outline'}))`
const active = ref(null)
</script>

<template>
  <figure class="m-0 flex flex-col gap-space-sm">
    <svg :viewBox="`0 0 ${S} ${S}`" class="w-full max-w-[200px] mx-auto block" role="img" :aria-label="`Por categoria: ${rows.map((r) => `${categoryById(r.category).name} ${formatBRL(r.cents)}`).join('; ')}`">
      <circle :cx="S / 2" :cy="S / 2" :r="R" fill="none" class="stroke-surface-container-high" :stroke-width="T" />
      <circle v-for="(s, i) in segs" :key="s.category" :cx="S / 2" :cy="S / 2" :r="R" fill="none" :style="{ stroke: color(s) }" :stroke-width="active === i ? T + 4 : T"
        :stroke-dasharray="s.dash" :stroke-dashoffset="s.off" :transform="`rotate(-90 ${S / 2} ${S / 2})`" class="transition-[stroke-width]"
        @pointerenter="active = i" @pointerleave="active = null" />
      <text :x="S / 2" :y="S / 2 + 2" text-anchor="middle" class="fill-on-surface font-bold tabular-nums" font-size="22">{{ active == null ? formatBRLCompact(total) : `${pct(segs[active])}%` }}</text>
      <text :x="S / 2" :y="S / 2 + 22" text-anchor="middle" class="fill-on-surface-variant" font-size="12">{{ active == null ? sub : categoryById(segs[active].category).name }}</text>
    </svg>
    <ul class="flex flex-col">
      <li v-for="(r, i) in rows" :key="r.category" tabindex="0" class="flex items-center gap-2 py-1.5 px-1 rounded-lg text-body-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="active === i && 'bg-surface-container-low'" @pointerenter="active = i" @pointerleave="active = null" @focus="active = i" @blur="active = null">
        <i class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: color(r) }"></i>
        <span class="flex-1 min-w-0 truncate text-on-surface">{{ categoryById(r.category).name }}</span>
        <span class="text-on-surface-variant tabular-nums">{{ pct(r) }}%</span>
        <span class="font-semibold tabular-nums whitespace-nowrap text-on-surface">{{ formatBRL(r.cents) }}</span>
      </li>
    </ul>
  </figure>
</template>
