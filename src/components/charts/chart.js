// Tiny helpers shared by the hand-rolled SVG charts (no chart lib, see docs/spec.md).
import { ref, onMounted, onBeforeUnmount } from 'vue'

// Width of an element, kept in sync with ResizeObserver, so charts draw in real pixels (text never stretches).
export function useWidth(el) {
  const width = ref(0)
  let ro
  onMounted(() => {
    ro = new ResizeObserver(([entry]) => (width.value = Math.floor(entry.contentRect.width)))
    ro.observe(el.value)
  })
  onBeforeUnmount(() => ro?.disconnect())
  return width
}

// Clean axis ticks covering [min, max] (always includes 0).
export function niceTicks(min, max, count = 4) {
  min = Math.min(0, min)
  max = Math.max(0, max)
  if (min === max) max = 100000 // empty chart: R$ 0 .. R$ 1.000
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw)
  const first = Math.floor(min / step)
  const last = Math.ceil(max / step)
  return Array.from({ length: last - first + 1 }, (_, i) => Math.round((first + i) * step))
}

// Column from baseline y0 to y, 4px rounded at the data end, square at the baseline (works for negatives too).
export function columnPath(x, w, y0, y) {
  const h = Math.abs(y0 - y)
  if (h < 0.5) return ''
  const r = Math.min(4, w / 2, h)
  const s = y < y0 ? 1 : -1 // grows up (+) or down (-)
  return `M${x},${y0} V${y + s * r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + s * r} V${y0} Z`
}

const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
const monthLong = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
// '2026-09-01' -> 'set' / 'setembro de 2026'
export const shortMonth = (m) => monthShort.format(new Date(m + 'T00:00:00Z')).replace('.', '')
export const longMonth = (m) => monthLong.format(new Date(m + 'T00:00:00Z'))
