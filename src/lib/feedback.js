// Feedback do app (docs/spec.md): screens, kinds, "apontar na tela" and the markdown for the weekly review.

export const SCREENS = [
  { route: '/', label: 'Visão Geral' },
  { route: '/fixos', label: 'Custos Fixos' },
  { route: '/individual?tab=resumo', label: 'Meu Espaço · Resumo' },
  { route: '/individual?tab=entradas', label: 'Meu Espaço · Entradas' },
  { route: '/individual?tab=gastos', label: 'Meu Espaço · Gastos' },
  { route: '/individual?tab=investimentos', label: 'Meu Espaço · Investimentos' },
  { route: '/individual?tab=orcamento', label: 'Meu Espaço · Orçamento' },
  { route: '/acerto', label: 'Acerto & Metas' },
  { route: '/ajuda', label: 'Como usar' },
  { route: '/feedback', label: 'Feedback' },
  { route: 'geral', label: 'O app todo' },
]
export const screenLabel = (route) => SCREENS.find((s) => s.route === route)?.label || route

// vue-router route -> one of SCREENS (Meu Espaço keeps its tab).
export function screenOf(route) {
  const key = route.path === '/individual' ? `/individual?tab=${route.query.tab || 'resumo'}` : route.path
  return SCREENS.some((s) => s.route === key) ? key : 'geral'
}

export const KINDS = {
  bug: { label: 'Problema', icon: 'bug_report', cls: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  improvement: { label: 'Melhoria', icon: 'auto_awesome', cls: 'bg-primary-fixed text-on-primary-fixed' },
  missing: { label: 'Está faltando', icon: 'extension', cls: 'bg-secondary-fixed text-on-secondary-fixed' },
}

const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

// What "apontar na tela" stores: the nearest data-tour name + a short text of the element (max 200 chars).
// Touching [data-private] (Meu Espaço, my personal totals) only the name: feedback is visible to both.
export function describeElement(el) {
  if (el.matches('.material-symbols-outlined') && el.parentElement) el = el.parentElement
  let text = el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || ''
  // Icon ligatures ("check_circle") are text too; drop them.
  for (const i of el.querySelectorAll('.material-symbols-outlined')) text = text.replace(i.textContent, ' ')
  const tour = el.closest('[data-tour]')?.getAttribute('data-tour')
  // Private if the element is inside private content OR contains some (e.g. clicking the gap of a card grid).
  const priv = el.closest('[data-private]') || el.querySelector('[data-private]') || location.hash.startsWith('#/individual')
  text = priv ? '' : cut(oneLine(text), 120)
  return cut([tour && `[${tour}]`, text && `"${text}"`].filter(Boolean).join(' ') || `<${el.tagName.toLowerCase()}>`, 200)
}

// Overlay mode: highlights the element under the pointer/finger; a click/tap picks it, Esc or "Cancelar" gives up.
// Resolves to describeElement(picked) or null. Page clicks are swallowed while picking so nothing activates.
export function pickElement() {
  return new Promise((resolve) => {
    const box = document.createElement('div')
    box.className = 'duo-pick-box'
    box.hidden = true
    const bar = document.createElement('div')
    bar.className = 'duo-pick-bar'
    bar.setAttribute('role', 'status')
    const msg = document.createElement('span')
    msg.textContent = 'Toque ou clique no ponto da tela (Esc cancela)'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'Cancelar'
    bar.append(msg, cancel)
    document.body.append(box, bar)
    document.documentElement.classList.add('duo-picking')

    const inBar = (e) => bar.contains(e.target)
    const at = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      return el && el !== document.documentElement && el !== document.body && !bar.contains(el) ? el : null
    }
    const show = (el) => {
      const r = el.getBoundingClientRect()
      Object.assign(box.style, { top: `${r.top - 3}px`, left: `${r.left - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` })
      box.hidden = false
    }
    const block = (e) => {
      if (inBar(e)) return
      e.preventDefault()
      e.stopPropagation()
    }
    const move = (e) => {
      const el = !inBar(e) && at(e)
      if (el) show(el)
    }
    const down = (e) => {
      block(e)
      move(e)
    }
    const up = (e) => {
      if (inBar(e)) return
      block(e)
      const el = at(e)
      if (el) finish(describeElement(el), true)
    }
    const key = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      finish(null)
    }
    const guards = [['pointermove', move], ['pointerdown', down], ['pointerup', up], ['mousedown', block], ['mouseup', block], ['click', block]]
    const opts = { capture: true, passive: false }
    guards.forEach(([t, f]) => addEventListener(t, f, opts))
    addEventListener('keydown', key, true)
    cancel.addEventListener('click', () => finish(null))

    let done = false
    function finish(value, picked = false) {
      if (done) return
      done = true
      box.remove()
      bar.remove()
      document.documentElement.classList.remove('duo-picking')
      removeEventListener('keydown', key, true)
      guards.forEach(([t, f]) => removeEventListener(t, f, opts))
      // The pick's own click (and a tap's synthetic one) still comes after pointerup: swallow just that one.
      if (picked) {
        const swallow = (e) => {
          e.preventDefault()
          e.stopPropagation()
        }
        addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => removeEventListener('click', swallow, { capture: true }), 400)
      }
      resolve(value)
    }
  })
}

const dateBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

// Open items as markdown grouped by screen (SCREENS order), for pasting into the weekly review with Claude.
export function feedbackMarkdown(items, nameOf, today = new Date().toISOString()) {
  const open = items.filter((i) => i.status === 'open')
  const order = (r) => (SCREENS.findIndex((s) => s.route === r) + 1 || 99)
  const routes = [...new Set(open.map((i) => i.route))].sort((a, b) => order(a) - order(b) || a.localeCompare(b))
  const out = [`# Feedback aberto do DuoFinance (${open.length}, ${dateBR(today)})`, '']
  if (!open.length) out.push('Nenhum item aberto.')
  for (const route of routes) {
    out.push(`## ${screenLabel(route)} (\`${route}\`)`, '')
    for (const i of open.filter((x) => x.route === route)) {
      const meta = [`**${KINDS[i.kind]?.label || i.kind}**`, nameOf(i.user_id), dateBR(i.created_at), i.element && `elemento: ${i.element}`]
      out.push(`- ${meta.filter(Boolean).join(' · ')}`, ...i.message.trim().split('\n').map((l) => `  ${l}`.trimEnd()))
    }
    out.push('')
  }
  return out.join('\n').trimEnd() + '\n'
}

// Clipboard with a fallback for browsers/contexts without the async API.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.append(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}
