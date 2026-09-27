const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(cents) {
  return fmt.format((cents || 0) / 100)
}

// "1.234,56" -> 123456, "12,5" -> 1250, "R$ 10" -> 1000, "12.50" -> 1250. Invalid -> null.
export function parseBRL(input) {
  let s = String(input ?? '').replace(/R\$|\s/g, '')
  if (s.includes(',')) {
    // pt-BR only: "1.234,56" or "1234,5". Rejects "1,234.56" and "12,345".
    if (!/^-?(\d{1,3}(\.\d{3})*|\d+),\d{1,2}$/.test(s)) return null
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '') // "1.234" = mil duzentos e trinta e quatro
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null
  return Math.round(Number(s) * 100)
}

// plural(1, 'conta paga', 'contas pagas') -> '1 conta paga'
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Chart axis ticks: "R$ 5 mil", "R$ 1,2 mi".
const compact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 })
export const formatBRLCompact = (cents) => compact.format((cents || 0) / 100)

// 0.2345 -> "23,5%"; null -> "—"
const pctFmt = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
export const formatPct = (ratio) => (ratio == null ? '—' : pctFmt.format(ratio))
