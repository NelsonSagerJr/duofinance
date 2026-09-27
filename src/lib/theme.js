import { ref, watch } from 'vue'

// 'system' | 'light' | 'dark'. index.html applies the same logic inline before the app loads (no flash).
const KEY = 'duofinance-theme'
const media = matchMedia('(prefers-color-scheme: dark)')

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export const theme = ref(read())

function apply() {
  const dark = theme.value === 'dark' || (theme.value === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
}

watch(theme, (v) => {
  try {
    v === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v)
  } catch {
    // storage blocked: theme still applies for this session
  }
  apply()
})
media.addEventListener('change', apply)
apply()

export const themeOptions = [
  { value: 'system', icon: 'contrast', label: 'Tema do sistema' },
  { value: 'light', icon: 'light_mode', label: 'Tema claro' },
  { value: 'dark', icon: 'dark_mode', label: 'Tema escuro' },
]

export function cycleTheme() {
  const i = themeOptions.findIndex((o) => o.value === theme.value)
  theme.value = themeOptions[(i + 1) % themeOptions.length].value
}
