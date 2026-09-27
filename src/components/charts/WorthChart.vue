<script setup>
import { ref, computed } from 'vue'
import { formatBRL, formatBRLCompact } from '../../lib/money.js'
import { useWidth, niceTicks, shortMonth, longMonth } from './chart.js'

// rows: [{ month, patrimonio }] oldest first. One series: line + light area wash, crosshair readout.
const props = defineProps({ rows: { type: Array, required: true } })

const box = ref(null)
const width = useWidth(box)
const H = 180
const AXIS = 24
const LEFT = 60
const TOP = 16
const RIGHT = 12

const ticks = computed(() => {
  const vals = props.rows.map((r) => r.patrimonio)
  return niceTicks(Math.min(...vals), Math.max(...vals))
})
const y = (v) => {
  const t = ticks.value
  return TOP + (H - TOP) * (1 - (v - t[0]) / (t[t.length - 1] - t[0]))
}
const step = computed(() => (width.value - LEFT - RIGHT) / Math.max(1, props.rows.length - 1))
const x = (i) => LEFT + step.value * i
const labelEvery = computed(() => (step.value < 30 ? 2 : 1))
const line = computed(() => props.rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.patrimonio)}`).join(' '))
const area = computed(() => `${line.value} L${x(props.rows.length - 1)},${y(0)} L${x(0)},${y(0)} Z`)
const last = computed(() => props.rows[props.rows.length - 1])
const first = computed(() => props.rows[0])

const active = ref(null)
// Crosshair snaps to the nearest month from the pointer's x.
function track(ev) {
  const r = box.value.getBoundingClientRect()
  active.value = Math.max(0, Math.min(props.rows.length - 1, Math.round((ev.clientX - r.left - LEFT) / step.value)))
}
function key(ev) {
  const d = { ArrowLeft: -1, ArrowRight: 1 }[ev.key]
  if (!d) return
  ev.preventDefault()
  active.value = Math.max(0, Math.min(props.rows.length - 1, (active.value ?? props.rows.length - 1) + d))
}
const tip = computed(() => {
  if (active.value == null || !width.value) return null
  return { row: props.rows[active.value], left: Math.min(Math.max(x(active.value) - 80, 0), width.value - 160) }
})
</script>

<template>
  <figure class="flex flex-col gap-space-sm m-0">
    <div ref="box" class="relative w-full">
      <svg v-if="width" :width="width" :height="H + AXIS" class="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
        role="img" tabindex="0" :aria-label="`Patrimônio de ${longMonth(first.month)} a ${longMonth(last.month)}: de ${formatBRL(first.patrimonio)} para ${formatBRL(last.patrimonio)}. Use as setas para ver cada mês.`"
        @pointermove="track" @pointerdown="track" @pointerleave="$event.pointerType === 'mouse' && (active = null)" @keydown="key" @blur="active = null">
        <g class="font-label-sm text-[11px]">
          <template v-for="t in ticks" :key="t">
            <line :x1="LEFT" :x2="width - RIGHT" :y1="y(t)" :y2="y(t)" class="stroke-outline-variant" :class="t === 0 ? '' : 'opacity-40'" stroke-width="1" shape-rendering="crispEdges" />
            <text :x="LEFT - 8" :y="y(t)" dy="0.32em" text-anchor="end" class="fill-on-surface-variant tabular-nums">{{ formatBRLCompact(t) }}</text>
          </template>
          <template v-for="(r, i) in rows" :key="r.month">
            <text v-if="(rows.length - 1 - i) % labelEvery === 0" :x="x(i)" :y="H + 16" text-anchor="middle" class="fill-on-surface-variant" :class="{ 'font-bold fill-on-surface': i === rows.length - 1 }">{{ shortMonth(r.month) }}</text>
          </template>
        </g>
        <path :d="area" class="fill-chart-worth/10" />
        <path :d="line" fill="none" class="stroke-chart-worth" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <line v-if="active != null" :x1="x(active)" :x2="x(active)" :y1="TOP" :y2="H" class="stroke-outline" stroke-width="1" />
        <circle v-if="active != null" :cx="x(active)" :cy="y(rows[active].patrimonio)" r="5" class="fill-chart-worth stroke-surface-container-lowest" stroke-width="2" />
        <circle :cx="x(rows.length - 1)" :cy="y(last.patrimonio)" r="5" class="fill-chart-worth stroke-surface-container-lowest" stroke-width="2" />
      </svg>
      <div v-if="tip" class="pointer-events-none absolute top-0 z-10 w-[160px] rounded-lg bg-inverse-surface text-inverse-on-surface shadow-lg px-3 py-2 text-body-sm" :style="{ left: tip.left + 'px' }">
        <div class="font-label-md text-label-md opacity-80 first-letter:uppercase">{{ longMonth(tip.row.month) }}</div>
        <div class="flex items-center gap-2"><span class="w-3 h-[3px] rounded bg-chart-worth"></span><strong class="tabular-nums">{{ formatBRL(tip.row.patrimonio) }}</strong></div>
      </div>
    </div>
    <figcaption class="font-body-sm text-body-sm text-on-surface-variant">
      Fim de {{ shortMonth(last.month) }}: <strong class="text-on-surface">{{ formatBRL(last.patrimonio) }}</strong>
      <template v-if="last.patrimonio !== first.patrimonio"> ({{ last.patrimonio > first.patrimonio ? '+' : '−' }}{{ formatBRL(Math.abs(last.patrimonio - first.patrimonio)) }} em 12 meses)</template>
    </figcaption>
    <details class="text-body-sm">
      <summary class="cursor-pointer text-primary font-label-md text-label-md w-fit">Ver em tabela</summary>
      <table class="w-full mt-2 text-left tabular-nums">
        <thead class="text-on-surface-variant font-label-sm text-label-sm uppercase"><tr><th class="py-1.5">Mês</th><th class="py-1.5 text-right">Patrimônio</th></tr></thead>
        <tbody class="divide-y divide-outline-variant/30">
          <tr v-for="r in rows" :key="r.month"><td class="py-1.5 first-letter:uppercase">{{ longMonth(r.month) }}</td><td class="py-1.5 text-right">{{ formatBRL(r.patrimonio) }}</td></tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>
