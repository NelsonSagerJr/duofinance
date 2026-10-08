<script setup>
import { ref, computed } from 'vue'
import { formatBRL, formatBRLCompact } from '../../lib/money.js'
import { useWidth, niceTicks, smooth } from './chart.js'

// Cumulative spend by day: this month (solid + area), previous month (thin), dashed projection to month end.
// cur: cumulative cents per day up to the last day to draw; prev: full previous month or null; proj: projectMonth() or null.
const props = defineProps({
  cur: { type: Array, required: true },
  prev: { type: Array, default: null },
  proj: { type: Object, default: null },
  days: { type: Number, required: true },
  curLabel: String,
  prevLabel: String,
})

const box = ref(null)
const width = useWidth(box)
const H = 200
const AXIS = 22
const RIGHT = 52
const TOP = 12
const uid = `pace${Math.random().toString(36).slice(2, 8)}`

const ticks = computed(() => niceTicks(0, Math.max(...props.cur, ...(props.prev || []), props.proj?.total || 0)))
const y = (v) => TOP + (H - TOP) * (1 - v / ticks.value[ticks.value.length - 1])
const x = (d) => 4 + ((d - 1) / Math.max(1, props.days - 1)) * (width.value - 4 - RIGHT)
const pts = (arr) => arr.map((v, i) => [x(i + 1), y(v)])
const curLine = computed(() => smooth(pts(props.cur)))
const curArea = computed(() => `${curLine.value} L${x(props.cur.length)},${y(0)} L${x(1)},${y(0)} Z`)
const prevLine = computed(() => props.prev && smooth(pts(props.prev.slice(0, props.days))))
const last = computed(() => props.cur.length)
const projAt = (d) => props.proj && props.cur[last.value - 1] + ((props.proj.total - props.cur[last.value - 1]) * (d - last.value)) / Math.max(1, props.days - last.value)
const xTicks = computed(() => [1, 8, 15, 22, props.days])

const active = ref(null)
function track(ev) {
  const r = box.value.getBoundingClientRect()
  active.value = Math.max(1, Math.min(props.days, Math.round(((ev.clientX - r.left - 4) / (width.value - 4 - RIGHT)) * (props.days - 1)) + 1))
}
function key(ev) {
  const d = { ArrowLeft: -1, ArrowRight: 1 }[ev.key]
  if (!d) return
  ev.preventDefault()
  active.value = Math.max(1, Math.min(props.days, (active.value ?? last.value) + d))
}
const tip = computed(() => {
  const d = active.value
  if (d == null || !width.value) return null
  const cur = d <= last.value ? props.cur[d - 1] : null
  return { d, cur, proj: cur == null && props.proj ? projAt(d) : null, prev: props.prev?.[d - 1] ?? null, left: Math.min(Math.max(x(d) - 90, 0), width.value - 180) }
})
const dotY = computed(() => tip.value && (tip.value.cur ?? tip.value.proj))
</script>

<template>
  <figure class="flex flex-col gap-space-sm m-0">
    <div ref="box" class="relative w-full">
      <svg v-if="width" :width="width" :height="H + AXIS" :viewBox="`0 0 ${width} ${H + AXIS}`" style="max-width:100%;height:auto" class="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
        role="img" tabindex="0" :aria-label="`Gasto acumulado por dia: ${formatBRL(cur[cur.length - 1])} até o dia ${cur.length}. Use as setas para ver cada dia.`"
        @pointermove="track" @pointerdown="track" @pointerleave="$event.pointerType === 'mouse' && (active = null)" @keydown="key" @blur="active = null">
        <defs>
          <linearGradient :id="uid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgb(var(--c-chart-worth))" stop-opacity=".35" />
            <stop offset="1" stop-color="rgb(var(--c-chart-worth))" stop-opacity="0" />
          </linearGradient>
        </defs>
        <g class="font-label-sm text-[11px]">
          <template v-for="t in ticks" :key="t">
            <line :x1="0" :x2="width - RIGHT" :y1="y(t)" :y2="y(t)" class="stroke-outline-variant" :class="t ? 'opacity-30' : ''" shape-rendering="crispEdges" />
            <text :x="width - RIGHT + 8" :y="y(t)" dy="0.32em" class="fill-on-surface-variant tabular-nums">{{ formatBRLCompact(t) }}</text>
          </template>
          <text v-for="d in xTicks" :key="d" :x="x(d)" :y="H + 16" text-anchor="middle" class="fill-on-surface-variant">{{ d }}</text>
        </g>
        <path v-if="prevLine" :d="prevLine" fill="none" class="stroke-outline" stroke-width="2" stroke-opacity=".7" />
        <path :d="curArea" :fill="`url(#${uid})`" />
        <path v-if="proj && last < days" :d="`M${x(last)},${y(cur[last - 1])} L${x(days)},${y(proj.total)}`" class="stroke-chart-net" stroke-width="2" stroke-dasharray="4 5" />
        <path :d="curLine" fill="none" class="stroke-chart-worth glow" stroke-width="3" stroke-linecap="round" />
        <circle :cx="x(last)" :cy="y(cur[last - 1])" r="5" class="fill-chart-worth stroke-surface-container-lowest" stroke-width="2" />
        <template v-if="proj && last < days">
          <circle :cx="x(days)" :cy="y(proj.total)" r="4" class="fill-chart-net" />
          <text :x="x(days) - 6" :y="y(proj.total) - 10" text-anchor="end" class="fill-on-surface font-label-sm text-[11px] font-semibold">~{{ formatBRLCompact(proj.total) }}</text>
        </template>
        <template v-if="tip">
          <line :x1="x(tip.d)" :x2="x(tip.d)" :y1="TOP" :y2="H" class="stroke-outline" stroke-dasharray="2 4" />
          <circle v-if="dotY != null" :cx="x(tip.d)" :cy="y(dotY)" r="4" class="fill-on-surface" />
        </template>
      </svg>
      <div v-if="tip" class="pointer-events-none absolute top-0 z-10 w-[180px] rounded-lg bg-inverse-surface text-inverse-on-surface shadow-lg px-3 py-2 text-body-sm" :style="{ left: tip.left + 'px' }">
        <div class="font-label-md text-label-md opacity-80">Dia {{ tip.d }}</div>
        <div v-if="tip.cur != null">{{ curLabel }}: <strong class="tabular-nums">{{ formatBRL(tip.cur) }}</strong></div>
        <div v-else-if="tip.proj != null">Projeção: <strong class="tabular-nums">~{{ formatBRL(tip.proj) }}</strong></div>
        <div v-if="tip.prev != null" class="opacity-80">{{ prevLabel }}: {{ formatBRL(tip.prev) }}</div>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-md text-label-md text-on-surface-variant">
      <span class="inline-flex items-center gap-1.5"><span class="w-4 h-[3px] rounded bg-chart-worth"></span>{{ curLabel }}</span>
      <span v-if="prev" class="inline-flex items-center gap-1.5"><span class="w-4 h-0.5 rounded bg-outline"></span>{{ prevLabel }}</span>
      <span v-if="proj" class="inline-flex items-center gap-1.5"><span class="w-4 border-t-2 border-dashed border-chart-net"></span>Projeção</span>
    </div>
    <details class="text-body-sm">
      <summary class="cursor-pointer text-primary font-label-md text-label-md w-fit">Ver em tabela</summary>
      <div class="max-h-64 overflow-y-auto mt-2">
        <table class="w-full text-left tabular-nums">
          <thead class="text-on-surface-variant font-label-sm text-label-sm uppercase"><tr><th class="py-1.5">Dia</th><th class="py-1.5 text-right">{{ curLabel }}</th><th v-if="prev" class="py-1.5 text-right">{{ prevLabel }}</th></tr></thead>
          <tbody class="divide-y divide-outline-variant/30">
            <tr v-for="d in days" :key="d"><td class="py-1">{{ d }}</td><td class="py-1 text-right">{{ d <= last ? formatBRL(cur[d - 1]) : '—' }}</td><td v-if="prev" class="py-1 text-right">{{ prev[d - 1] != null ? formatBRL(prev[d - 1]) : '—' }}</td></tr>
          </tbody>
        </table>
      </div>
    </details>
  </figure>
</template>
