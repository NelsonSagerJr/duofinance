import { state } from './store.js'

// Categories are household rows (supabase/migrations/0007_categories.sql), loaded with the session into
// state.categories: [{ id, kind: 'expense'|'income', name, icon, color, archived, sort }].
// Archived ones stay resolvable (history rows keep their name) but are hidden from pickers.

// Palette tokens allowed by the DB check; full class strings so Tailwind keeps them.
export const COLORS = {
  primary: { chip: 'bg-primary/15 text-primary', dot: 'bg-primary', label: 'Verde' },
  'chart-in': { chip: 'bg-chart-in/15 text-chart-in', dot: 'bg-chart-in', label: 'Esmeralda' },
  'chart-worth': { chip: 'bg-chart-worth/15 text-chart-worth', dot: 'bg-chart-worth', label: 'Azul' },
  secondary: { chip: 'bg-secondary/15 text-secondary', dot: 'bg-secondary', label: 'Anil' },
  'chart-net': { chip: 'bg-chart-net/15 text-chart-net', dot: 'bg-chart-net', label: 'Roxo' },
  tertiary: { chip: 'bg-tertiary/15 text-tertiary', dot: 'bg-tertiary', label: 'Vermelho' },
  'chart-out': { chip: 'bg-chart-out/15 text-chart-out', dot: 'bg-chart-out', label: 'Laranja' },
  outline: { chip: 'bg-outline/15 text-on-surface-variant', dot: 'bg-outline', label: 'Cinza' },
}
export const chipClass = (c) => (COLORS[c?.color] || COLORS.outline).chip

// Icon grid offered in Configurações → Categorias (Material Symbols names).
export const ICONS = [
  'restaurant', 'shopping_cart', 'local_cafe', 'bakery_dining', 'local_bar', 'home', 'receipt_long', 'bolt',
  'water_drop', 'wifi', 'phone_iphone', 'medical_services', 'medication', 'fitness_center', 'spa', 'directions_car',
  'local_gas_station', 'directions_bus', 'flight', 'celebration', 'movie', 'sports_esports', 'music_note', 'pets',
  'shopping_bag', 'checkroom', 'redeem', 'child_care', 'school', 'menu_book', 'build', 'cleaning_services',
  'local_florist', 'volunteer_activism', 'subscriptions', 'credit_card', 'work', 'laptop_mac', 'trending_up', 'sell',
  'savings', 'account_balance', 'payments', 'more_horiz',
]

const FALLBACK = Object.freeze({ id: null, kind: null, name: 'Sem categoria', icon: 'category', color: 'outline', archived: false })

export const categoryById = (id) => state.categories.find((c) => c.id === id) || FALLBACK

// Options for a picker: active categories of that kind, plus the row's current one even if archived.
export const pickable = (kind, currentId = null) =>
  state.categories.filter((c) => c.kind === kind && (!c.archived || c.id === currentId))

export const INVESTMENT_KINDS = [
  { id: 'renda_fixa', label: 'Renda fixa', icon: 'account_balance' },
  { id: 'acoes', label: 'Ações', icon: 'candlestick_chart' },
  { id: 'fiis', label: 'FIIs', icon: 'apartment' },
  { id: 'cripto', label: 'Cripto', icon: 'currency_bitcoin' },
  { id: 'previdencia', label: 'Previdência', icon: 'elderly' },
  { id: 'outros', label: 'Outros', icon: 'more_horiz' },
]
export const investmentKindById = (id) => INVESTMENT_KINDS.find((c) => c.id === id) || INVESTMENT_KINDS[INVESTMENT_KINDS.length - 1]
