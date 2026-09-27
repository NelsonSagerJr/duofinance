import { describe, it, expect } from 'vitest'
import { feedbackMarkdown, screenOf } from './feedback.js'

const names = { a: 'Ana', b: 'Bruno' }
const item = (o) => ({ status: 'open', kind: 'bug', user_id: 'a', created_at: '2026-09-20T15:00:00Z', element: null, ...o })

describe('feedbackMarkdown', () => {
  it('groups open items by screen in app order, with kind, author, date, element and indented message', () => {
    const md = feedbackMarkdown(
      [
        item({ route: '/acerto', kind: 'missing', user_id: 'b', message: 'Exportar\nem PDF' }),
        item({ route: '/', element: '[quick-add] "Categoria"', message: 'Não salva' }),
        item({ route: '/', status: 'resolved', message: 'já foi' }),
      ],
      (id) => names[id],
      '2026-09-27T12:00:00Z',
    )
    expect(md).toBe(
      [
        '# Feedback aberto do DuoFinance (2, 27/09/2026)',
        '',
        '## Visão Geral (`/`)',
        '',
        '- **Problema** · Ana · 20/09/2026 · elemento: [quick-add] "Categoria"',
        '  Não salva',
        '',
        '## Acerto & Metas (`/acerto`)',
        '',
        '- **Está faltando** · Bruno · 20/09/2026',
        '  Exportar',
        '  em PDF',
        '',
      ].join('\n'),
    )
  })

  it('says so when nothing is open', () => {
    expect(feedbackMarkdown([], () => '', '2026-09-27T12:00:00Z')).toContain('Nenhum item aberto.')
  })
})

describe('screenOf', () => {
  it('keeps the Meu Espaço tab and maps unknown routes to the whole app', () => {
    expect(screenOf({ path: '/individual', query: {} })).toBe('/individual?tab=resumo')
    expect(screenOf({ path: '/individual', query: { tab: 'orcamento' } })).toBe('/individual?tab=orcamento')
    expect(screenOf({ path: '/fixos', query: {} })).toBe('/fixos')
    expect(screenOf({ path: '/xyz', query: {} })).toBe('geral')
  })
})
