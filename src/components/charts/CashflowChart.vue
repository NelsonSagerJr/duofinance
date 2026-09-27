<script setup>
import { ref, computed } from 'vue'
import { formatBRL, formatBRLCompact } from '../../lib/money.js'
import { useWidth, niceTicks, columnPath, shortMonth, longMonth } from './chart.js'

// rows: [{ month, entradas, saidas, sobra }] oldest first. Entradas/saídas as columns, sobra as a line, one axis.
const props = defineProps({ rows: { type: Array, required: true } })

const box = ref(null)
const width = useWidth(box)
const H = 220 // plot height
const AXIS = 24 // x-axis label band (inside the SVG height, so nothing gets clipped)
const LEFT = 60
const TOP = 12

const ticks = computed(() => {
  const vals = props.rows.flatMap((r) => [r.entradas, r.saidas, r.sobra])
  return niceTicks(Math.min(...vals), Math.max(...vals))
})
const y = (v) => {
  const t = ticks.value
  const lo = t[0], hi = t[t.length - 1]
  return TOP + (H - TOP) * (1 - (v - lo) / (hi - lo))
}
const plotW = computed(() => Math.max(0, width.value - LEFT))
const band = computed(() => plotW.value / props.rows.length)
const colW = computed(() => Math.min(24, Math.max(3, (band.value - 8) / 2 - 1)))
const cx = (i) => LEFT + band.value * (i + 0.5)
const labelEvery = computed(() => (band.value < 30 ? 2 : 1))

const bars = computed(() =>
  props.rows.map((r, i) => ({
    in: columnPath(cx(i) - colW.value - 1, colW.value, y(0), y(r.entradas)),
    out: columnPath(cx(i) + 1, colW.value, y(0), y(r.saidas)),
  })),
)
const line = computed(() => props.rows.map((r, i) => `${i ? 'L' : 'M'}${cx(i)},${y(r.sobra)}`).join(' '))
const last = computed(() => props.rows[props.rows.length - 1])

// Hover / focus readout. The hit target is the whole month band, not the painted marks.
const active = ref(null)
const tip = computed(() => {
  if (active.value == null || !width.value) return null
  const left = Math.min(Math.max(cx(active.value) - 90, 0), width.value - 180)
  return { row: props.rows[active.value], left }
})
const aria = (r) => `${longMonth(r.month)}: entradas ${formatBRL(r.entradas)}, saídas ${formatBRL(r.saidas)}, sobra ${formatBRL(r.sobra)}`
</script>

<template>
  <figure class="flex flex-col gap-space-sm m-0">
    <!-- Legend: rect for columns, line key for the line -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-md text-label-md text-on-surface-variant">
      <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-chart-in"></span>Entradas</span>
      <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-chart-out"></span>Saídas</span>
      <span class="inline-flex items-center gap-1.5"><span class="w-4 h-0.5 rounded bg-chart-net"></span>Sobra</span>
    </div>

    <div ref="box" class="relative w-full" @pointerleave="$event.pointerType === 'mouse' && (active = null)">
      <svg v-if="width" :width="width" :height="H + AXIS" role="img" :aria-label="`Entradas, saídas e sobra de ${longMonth(rows[0].month)} a ${longMonth(last.month)}`" class="block overflow-visible">
        <g class="font-label-sm text-[11px]">
          <template v-for="t in ticks" :key="t">
            <line :x1="LEFT" :x2="width" :y1="y(t)" :y2="y(t)" class="stroke-outline-variant" :class="t === 0 ? 'opacity-100' : 'opacity-40'" stroke-width="1" shape-rendering="crispEdges" />
            <text :x="LEFT - 8" :y="y(t)" dy="0.32em" text-anchor="end" class="fill-on-surface-variant tabular-nums">{{ formatBRLCompact(t) }}</text>
          </template>
          <template v-for="(r, i) in rows" :key="r.month">
            <text v-if="(rows.length - 1 - i) % labelEvery === 0" :x="cx(i)" :y="H + 16" text-anchor="middle" class="fill-on-surface-variant" :class="{ 'font-bold fill-on-surface': i === rows.length - 1 }">{{ shortMonth(r.month) }}</text>
          </template>
        </g>

        <line v-if="active != null" :x1="cx(active)" :x2="cx(active)" :y1="TOP" :y2="H" class="stroke-outline" stroke-width="1" />

        <g v-for="(b, i) in bars" :key="i" :class="{ 'opacity-60': active != null && active !== i }">
          <path :d="b.in" class="fill-chart-in" />
          <path :d="b.out" class="fill-chart-out" />
        </g>

        <path :d="line" fill="none" class="stroke-chart-net" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle v-for="(r, i) in rows" :key="r.month" :cx="cx(i)" :cy="y(r.sobra)" :r="active === i || i === rows.length - 1 ? 5 : 3.5"
          class="fill-chart-net stroke-surface-container-lowest" stroke-width="2" />

        <!-- Hit targets: one focusable band per month -->
        <rect v-for="(r, i) in rows" :key="'hit' + r.month" :x="LEFT + band * i" :y="0" :width="band" :height="H + AXIS" fill="transparent"
          tabindex="0" :aria-label="aria(r)" class="outline-none focus-visible:stroke-primary focus-visible:stroke-2"
          @pointerenter="active = i" @pointermove="active = i" @pointerdown="active = i" @focus="active = i" @blur="active = null" />
      </svg>

      <div v-if="tip" class="pointer-events-none absolute top-0 z-10 w-[180px] rounded-lg bg-inverse-surface text-inverse-on-surface shadow-lg px-3 py-2 text-body-sm" :style="{ left: tip.left + 'px' }">
        <div class="font-label-md text-label-md opacity-80 first-letter:uppercase">{{ longMonth(tip.row.month) }}</div>
        <div class="flex items-center gap-2"><span class="w-3 h-[3px] rounded bg-chart-in"></span><strong class="tabular-nums">{{ formatBRL(tip.row.entradas) }}</strong><span class="opacity-80 ml-auto">entradas</span></div>
        <div class="flex items-center gap-2"><span class="w-3 h-[3px] rounded bg-chart-out"></span><strong class="tabular-nums">{{ formatBRL(tip.row.saidas) }}</strong><span class="opacity-80 ml-auto">saídas</span></div>
        <div class="flex items-center gap-2"><span class="w-3 h-[3px] rounded bg-chart-net"></span><strong class="tabular-nums">{{ formatBRL(tip.row.sobra) }}</strong><span class="opacity-80 ml-auto">sobra</span></div>
      </div>
    </div>

    <figcaption class="font-body-sm text-body-sm text-on-surface-variant">
      Sobra em {{ shortMonth(last.month) }}: <strong class="text-on-surface">{{ formatBRL(last.sobra) }}</strong>. Passe o dedo ou o mouse sobre um mês para ver os valores.
    </figcaption>

    <details class="text-body-sm">
      <summary class="cursor-pointer text-primary font-label-md text-label-md w-fit">Ver em tabela</summary>
      <div class="overflow-x-auto mt-2">
        <table class="w-full min-w-[360px] text-left tabular-nums">
          <thead class="text-on-surface-variant font-label-sm text-label-sm uppercase"><tr><th class="py-1.5 pr-2">Mês</th><th class="py-1.5 pr-2 text-right">Entradas</th><th class="py-1.5 pr-2 text-right">Saídas</th><th class="py-1.5 text-right">Sobra</th></tr></thead>
          <tbody class="divide-y divide-outline-variant/30">
            <tr v-for="r in rows" :key="r.month"><td class="py-1.5 pr-2 first-letter:uppercase">{{ longMonth(r.month) }}</td><td class="py-1.5 pr-2 text-right">{{ formatBRL(r.entradas) }}</td><td class="py-1.5 pr-2 text-right">{{ formatBRL(r.saidas) }}</td><td class="py-1.5 text-right font-semibold">{{ formatBRL(r.sobra) }}</td></tr>
          </tbody>
        </table>
      </div>
    </details>
  </figure>
</template>
