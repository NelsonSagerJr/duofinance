<script setup>
import { ref, computed } from 'vue'
import { formatBRL } from '../../lib/money.js'
import { categoryById } from '../../lib/categories.js'
import { useWidth } from './chart.js'

// rows: budgetUsage() output [{ category, spent, limit, over }]. Horizontal bars (spent) with a tick at the limit.
const props = defineProps({ rows: { type: Array, required: true } })

const box = ref(null)
const width = useWidth(box)
const ROW = 46
const BAR = 10
const max = computed(() => Math.max(1, ...props.rows.map((r) => Math.max(r.spent, r.limit || 0))))
const x = (v) => (v / max.value) * (width.value - 2)
// Bar with a 4px rounded data end, square at the baseline.
const bar = (w, y) => {
  if (w < 0.5) return ''
  const r = Math.min(4, w, BAR / 2)
  return `M0,${y} H${w - r} Q${w},${y} ${w},${y + r} V${y + BAR - r} Q${w},${y + BAR} ${w - r},${y + BAR} H0 Z`
}
const label = (r) => `${categoryById(r.category).name}: ${formatBRL(r.spent)}${r.limit ? ` de ${formatBRL(r.limit)}${r.over ? ', acima do limite' : ''}` : ', sem limite'}`
const active = ref(null)
</script>

<template>
  <figure class="flex flex-col gap-space-sm m-0">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-label-md text-label-md text-on-surface-variant">
      <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-chart-out"></span>Gasto no mês</span>
      <span class="inline-flex items-center gap-1.5"><span class="w-0.5 h-3.5 bg-on-surface"></span>Limite</span>
      <span class="inline-flex items-center gap-1.5"><span class="text-tertiary text-[11px]">▲</span>Acima do limite</span>
    </div>
    <div ref="box" class="w-full">
      <svg v-if="width" :width="width" :height="rows.length * ROW" role="img" :aria-label="`Gastos por categoria: ${rows.map(label).join('; ')}`" class="block overflow-visible">
        <g v-for="(r, i) in rows" :key="r.category" :transform="`translate(0 ${i * ROW})`" tabindex="0" :aria-label="label(r)"
          class="outline-none" @pointerenter="active = i" @pointerleave="active = null" @focus="active = i" @blur="active = null">
          <rect x="0" y="0" :width="width" :height="ROW" :class="active === i ? 'fill-surface-container-low' : 'fill-transparent'" rx="6" />
          <text x="0" y="16" class="fill-on-surface font-label-md text-[12px] font-semibold">{{ categoryById(r.category).name }}<tspan v-if="r.over" class="fill-tertiary"> ▲ acima</tspan></text>
          <text :x="width - 2" y="16" text-anchor="end" class="fill-on-surface-variant font-label-md text-[12px] tabular-nums">
            <tspan class="fill-on-surface font-semibold">{{ formatBRL(r.spent) }}</tspan>{{ r.limit ? ` / ${formatBRL(r.limit)}` : ' · sem limite' }}
          </text>
          <rect x="0" y="26" :width="width - 2" :height="BAR" rx="5" class="fill-surface-container-highest" />
          <path :d="bar(x(r.spent), 26)" :class="r.over ? 'fill-tertiary' : 'fill-chart-out'" />
          <rect v-if="r.limit" :x="Math.min(x(r.limit), width - 2) - 1" y="22" width="2" height="18" rx="1" class="fill-on-surface" />
        </g>
      </svg>
    </div>
    <details class="text-body-sm">
      <summary class="cursor-pointer text-primary font-label-md text-label-md w-fit">Ver em tabela</summary>
      <table class="w-full mt-2 text-left tabular-nums">
        <thead class="text-on-surface-variant font-label-sm text-label-sm uppercase"><tr><th class="py-1.5">Categoria</th><th class="py-1.5 text-right">Gasto</th><th class="py-1.5 text-right">Limite</th></tr></thead>
        <tbody class="divide-y divide-outline-variant/30">
          <tr v-for="r in rows" :key="r.category"><td class="py-1.5">{{ categoryById(r.category).name }}<span v-if="r.over" class="text-tertiary font-semibold"> · acima</span></td><td class="py-1.5 text-right">{{ formatBRL(r.spent) }}</td><td class="py-1.5 text-right">{{ r.limit ? formatBRL(r.limit) : '—' }}</td></tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>
