<script setup>
import { ref, computed } from 'vue'
import { formatBRL } from '../../lib/money.js'

// Month heatmap of spend per day (dailyTotals() rows) + the heaviest days. One hue, 5 steps, light -> dark.
const props = defineProps({ month: { type: String, required: true }, days: { type: Array, required: true }, today: { type: String, required: true } })

const LEVELS = ['bg-surface-container-high', 'bg-primary/20', 'bg-primary/40', 'bg-primary/70', 'bg-primary']
const max = computed(() => Math.max(0, ...props.days.map((d) => d.cents)))
const level = (c) => (!c ? 0 : Math.min(4, Math.ceil((c / max.value) * 4)))
// Weekday of the 1st (0 = domingo), computed from the month itself.
const offset = computed(() => new Date(props.month + 'T12:00:00').getDay())
const mm = computed(() => props.month.slice(5, 7))
const iso = (d) => `${props.month.slice(0, 8)}${String(d).padStart(2, '0')}`
const dd = (d) => `${String(d).padStart(2, '0')}/${mm.value}`
const notes = (d) => d.items.slice(0, 3).map((i) => i.desc).join(', ') + (d.items.length > 3 ? '…' : '')
const top = computed(() => props.days.filter((d) => d.cents).sort((a, b) => b.cents - a.cents).slice(0, 4))
const label = (d) => (iso(d.day) > props.today ? `${dd(d.day)}: ainda não chegou` : d.cents ? `${dd(d.day)}: ${formatBRL(d.cents)}, ${notes(d)}` : `${dd(d.day)}: sem gastos`)

const active = ref(null)
</script>

<template>
  <figure class="m-0 grid grid-cols-1 md:grid-cols-[minmax(0,420px)_1fr] gap-space-lg items-start">
    <div class="min-w-0">
      <div class="relative grid grid-cols-7 gap-1.5" role="img" :aria-label="`Gastos por dia: ${top.map(label).join('; ') || 'sem gastos'}`">
        <span v-for="(w, i) in ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']" :key="'h' + i" class="text-center font-label-sm text-[10px] text-on-surface-variant tracking-widest" aria-hidden="true">{{ w }}</span>
        <span v-for="i in offset" :key="'o' + i" aria-hidden="true"></span>
        <span v-for="d in days" :key="d.day" tabindex="0" :aria-label="label(d)"
          class="aspect-square rounded-lg grid place-items-center font-label-sm text-[11px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-chart-worth cursor-default"
          :class="[
            iso(d.day) > today ? 'border border-dashed border-outline-variant text-on-surface-variant/60' : LEVELS[level(d.cents)],
            iso(d.day) <= today && level(d.cents) >= 3 ? 'text-on-primary font-bold' : 'text-on-surface-variant',
            iso(d.day) === today && 'ring-2 ring-chart-worth ring-offset-1 ring-offset-surface-container-lowest',
          ]"
          @pointerenter="active = d" @pointerleave="active = null" @focus="active = d" @blur="active = null">{{ d.day }}</span>
      </div>
      <div class="mt-2 min-h-[36px] font-body-sm text-body-sm text-on-surface-variant" aria-live="polite">
        <template v-if="active"><strong class="text-on-surface">{{ dd(active.day) }}</strong> · {{ label(active).slice(7) }}</template>
        <span v-else class="flex items-center gap-1.5">menos <i v-for="(l, k) in LEVELS" :key="k" class="w-3 h-3 rounded-sm inline-block" :class="l"></i> mais</span>
      </div>
    </div>
    <div class="min-w-0">
      <div class="eyebrow mb-2">Dias mais pesados</div>
      <p v-if="!top.length" class="text-body-md text-on-surface-variant">Nenhum gasto neste mês ainda.</p>
      <ul v-else class="flex flex-col divide-y divide-outline-variant/30">
        <li v-for="d in top" :key="d.day" class="flex items-center justify-between gap-3 py-2">
          <span class="min-w-0"><strong class="text-on-surface tabular-nums">{{ dd(d.day) }}</strong> <span class="text-body-sm text-on-surface-variant break-words">{{ notes(d) }}</span></span>
          <strong class="tabular-nums whitespace-nowrap text-on-surface">{{ formatBRL(d.cents) }}</strong>
        </li>
      </ul>
      <details class="text-body-sm mt-2">
        <summary class="cursor-pointer text-primary font-label-md text-label-md w-fit">Ver em tabela</summary>
        <table class="w-full mt-2 text-left tabular-nums">
          <thead class="text-on-surface-variant font-label-sm text-label-sm uppercase"><tr><th class="py-1.5">Dia</th><th class="py-1.5 text-right">Gasto</th></tr></thead>
          <tbody class="divide-y divide-outline-variant/30">
            <tr v-for="d in days.filter((x) => x.cents)" :key="d.day"><td class="py-1">{{ dd(d.day) }}</td><td class="py-1 text-right">{{ formatBRL(d.cents) }}</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  </figure>
</template>
