import { nextTick } from 'vue'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { state, me, partner, closeExpenseForm } from './store.js'

// Guided tour across every screen. Targets are data-tour="..." attributes; the same name can sit on the desktop
// and the mobile variant of a control (sidebar vs bottom nav) and the first *visible* one wins. `el` may list
// fallbacks (row button -> its list) for empty states; nothing found = centered popover, never a crash.

const KEY = (userId) => `duofinance-tour-done:${userId}`
const $ = (name) => `[data-tour="${name}"]`

function visible(sel) {
  return [...document.querySelectorAll(sel)].find((el) => el.getClientRects().length) || null
}
const pick = (step) => (step.el || []).map(visible).find(Boolean) || null

// ponytail: every view renders "Carregando…" while fetching; cheaper than wiring a loading flag through each view.
const loading = () => document.querySelector('main')?.innerText.includes('Carregando')

async function waitForTarget(step, ms = 2000) {
  if (!step.el) return
  const t0 = Date.now()
  await nextTick()
  // Wait for the preferred target; stop early once the page finished loading and only fallbacks exist.
  while (Date.now() - t0 < ms && !visible(step.el[0]) && (loading() || Date.now() - t0 < 250)) {
    await new Promise((r) => setTimeout(r, 50))
  }
}

// driver.js only scrolls when the target is outside the viewport; here the fixed top bar and mobile bottom nav
// can still cover it, so scroll it into the free band between them.
function reveal(el) {
  if (!el) return
  for (let n = el; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return
  const top = (document.querySelector('header')?.offsetHeight || 0) + 8
  const bottom = innerHeight - (visible('nav.fixed[data-tour="nav"]')?.offsetHeight || 0) - 8
  const r = el.getBoundingClientRect()
  if (r.top >= top && r.bottom <= bottom) return
  const room = bottom - top
  scrollBy(0, r.height <= room ? r.top - top - (room - r.height) / 2 : r.top - top)
}

// driver.js renders descriptions with innerHTML, and member names are user input.
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function buildSteps() {
  const a = esc(me.value?.name || 'Você')
  const b = esc(partner.value?.name || 'seu par')
  const [p1, p2] = state.members
  const n1 = p1?.name ? esc(p1.name) : a
  const n2 = p2?.name ? esc(p2.name) : b
  const s = (route, el, title, description, side) => ({
    route,
    el: el && [].concat(el).map($),
    popover: { title, description, ...(side ? { side } : {}) },
  })

  return [
    s('/', null, 'Bem-vindo ao DuoFinance',
      `Aqui vocês dois controlam o dinheiro do mês. Existem <b>2 tipos de gasto</b>:<br>
       • <b>Casa</b>: mercado, aluguel, luz… Os dois veem e ele entra no acerto;<br>
       • <b>Pessoal</b>: <b>privado</b>. Só quem lançou vê (nem o total aparece para o outro) e não entra no acerto.<br><br>
       No fim do mês, o <b>acerto</b> compara quanto cada um pagou dos gastos da casa com quanto devia pagar e diz quem transfere quanto para quem.`),
    s('/', 'month', 'Tudo é por mês',
      'Use as setas para trocar de mês. Todas as telas (totais, contas fixas, acerto, gastos pessoais) mostram só o mês escolhido aqui.'),
    s('/', 'new-expense', 'Novo Lançamento',
      'Abre o formulário para lançar qualquer gasto, de qualquer tela. É o jeito mais rápido de registrar algo.'),
    s('/', 'theme', 'Tema claro ou escuro',
      'Escolha tema do sistema, claro ou escuro. No celular, cada toque alterna entre os três.'),
    s('/', 'nav', 'Menu',
      '<b>Visão Geral</b>: resumo do mês.<br><b>Custos Fixos</b>: contas que se repetem todo mês.<br><b>Meu Espaço</b>: suas finanças pessoais (privadas): entradas, gastos, investimentos e orçamento.<br><b>Acerto &amp; Metas</b>: quem deve quanto, metas, configurações e categorias.<br><b>Como usar</b>: guia passo a passo e este tour.<br><b>Feedback</b>: o que vocês pediram para melhorar no app (no celular, pelo botão redondo de feedback).'),
    s('/', 'logout', 'Sair', 'Encerra a sessão neste aparelho. Seus dados continuam salvos.'),
    s('/', 'feedback-button', 'Feedback',
      'Achou um problema, quer uma melhoria ou sentiu falta de algo? Toque aqui, em qualquer tela. Dá para <b>apontar na tela</b> o botão ou trecho de que você está falando. Os dois veem os feedbacks.', 'left'),

    // ---- Visão Geral
    s('/', 'stat-house', 'Total da Casa',
      'Soma de todos os gastos da casa no mês (inclui contas fixas pagas). É o valor que entra no acerto.'),
    s('/', 'stat-bills', 'Contas Fixas',
      'Quanto já foi pago em contas fixas neste mês, quantas estão pagas e quanto ainda falta.'),
    s('/', 'stat-personal', 'Meus gastos pessoais',
      `O total dos <b>seus</b> gastos pessoais no mês. É privado: ${b} não vê este valor (cada um vê só o próprio). Não entra no acerto.`),
    s('/', 'overview-acerto', 'Acerto do Mês',
      'O resumo de quem transfere quanto para quem, já descontando o que foi quitado. Em "Detalhes" você vê a conta completa.'),
    s('/', 'overview-upcoming', 'Próximos Vencimentos',
      'Contas fixas deste mês que ainda não foram pagas. As vencidas aparecem em vermelho.'),
    s('/', 'overview-recent', 'Atividades Recentes',
      'Os últimos lançamentos do mês, com quem pagou e se é da casa ou pessoal. Use o lápis para editar e a lixeira para excluir.'),
    s('/', 'quick-add', 'Lançamento Rápido',
      'Mesmo formulário do botão "Novo Lançamento", sempre à mão nesta tela: descrição, valor, data e categoria.', 'left'),
    s('/', ['scope', 'quick-add'], 'Casa ou Pessoal?',
      `<b>Casa</b>: gasto dos dois. Os dois veem e ele entra no acerto.<br><b>Pessoal</b>: privado, só você vê, e fica fora do acerto.<br><br>Atenção: se lançar um gasto da casa como Pessoal por engano, ${b} não vai vê-lo (nem ele entra no acerto) até você editar e trocar para Casa.`),
    s('/', ['paid-by', 'quick-add'], 'Quem pagou?',
      `Quem tirou o dinheiro do bolso. É isso que decide o acerto: se ${n1} pagou o mercado inteiro, ${n2} fica devendo a parte que cabe a ele(a). (Só aparece em gastos da casa; o pessoal é sempre seu.)`),
    s('/', ['split-at-till', 'paid-by', 'quick-add'], 'Dividido na hora',
      `Quando cada um pagou a própria parte no caixa (ex.: restaurante de R$ 200, R$ 100 no cartão de ${n1} e R$ 100 no de ${n2}). O gasto conta no total da casa e na parte de cada um no Meu Espaço, mas <b>não mexe no acerto</b>: ninguém deve nada a ninguém por ele.`),
    s('/', ['split', 'quick-add'], 'Dividir diferente do padrão',
      `Cada gasto da casa é salvo com a divisão padrão do momento (ex.: 50/50, ajustável em Configurações). Marque esta opção para <b>um gasto específico</b> com outra divisão.<br><br>Ex.: aluguel de R$ 2.000 em 70/30 → ${n1} deve R$ 1.400 e ${n2} R$ 600, só nesse lançamento.`),

    // ---- Custos Fixos
    s('/fixos', 'fixos-header', 'Custos Fixos',
      'Contas que se repetem todo mês com valor e dia de vencimento: aluguel, internet, condomínio… Você cadastra uma vez e marca como paga a cada mês.'),
    s('/fixos', 'add-bill', 'Adicionar Custo Fixo',
      'Cadastre nome, valor, dia de vencimento e categoria. Contas inativas ficam guardadas mas não aparecem como pendentes.'),
    s('/fixos', 'fixos-totals', 'Resumo do mês', 'Total das contas ativas, quanto já foi pago e quanto ainda falta pagar neste mês.'),
    s('/fixos', ['bill-status', 'bills-list'], 'Status da conta',
      '<b>Paga</b>: já foi lançada neste mês.<br><b>Pendente</b>: ainda não venceu.<br><b>Vencida</b>: passou do dia e não foi paga.'),
    s('/fixos', ['bill-pay', 'bills-list'], 'Marcar como paga',
      'Pergunta quem pagou e cria automaticamente um <b>gasto da casa</b> neste mês com o valor da conta. Ele entra no Total da Casa e no acerto. Se cada um pagou a sua parte, escolha <b>Dividido na hora</b>: entra no total, sem mexer no acerto.'),
    s('/fixos', ['bill-actions', 'bills-list'], 'Editar, excluir ou desfazer',
      'Lápis edita a conta, lixeira exclui (pagamentos antigos continuam no histórico). Numa conta paga aparece a seta de desfazer, que apaga o pagamento do mês.'),

    // ---- Meu Espaço (each tab has its own route so the tour opens it; ?tab= is how the page remembers it)
    s('/individual?tab=resumo', 'personal-header', 'Meu Espaço',
      `Suas finanças pessoais: o que entra, o que sai, investimentos e orçamento. Esta tela é <b>só sua</b>: ${b} não vê nada daqui, nem os totais. Quando ${b} entra, vê o próprio espaço.`),
    s('/individual?tab=resumo', 'personal-tabs', 'Cinco abas',
      '<b>Resumo</b>: os números e gráficos do mês.<br><b>Entradas</b>: salário e extras.<br><b>Gastos</b>: seus gastos pessoais e sua parte da casa.<br><b>Investimentos</b>: sua carteira.<br><b>Orçamento</b>: limites por categoria.<br><br>Tudo segue o mês escolhido lá em cima.'),
    s('/individual?tab=resumo', 'my-kpis', 'Os números do mês',
      `<b>Entradas</b>: o que você recebeu.<br><b>Saídas</b>: seus gastos pessoais + <b>sua parte</b> das despesas da casa (pela divisão de cada uma).<br><b>Sobra</b> = entradas − saídas; a <b>taxa de poupança</b> é quanto da renda sobrou.<br><b>Investido no mês</b> = aportes − resgates; <b>patrimônio</b> = soma dos saldos dos investimentos.<br><br>Ex.: entrou R$ 5.000, você gastou R$ 800 pessoal e sua parte da casa deu R$ 1.700 → saídas R$ 2.500, sobra R$ 2.500, taxa 50%.`),
    s('/individual?tab=resumo', 'chart-cashflow', 'Entradas × saídas',
      'Os últimos 12 meses até o mês escolhido: colunas de entradas e saídas e a linha da sobra. Passe o mouse ou toque num mês para ver os valores; "Ver em tabela" mostra tudo em números.'),
    s('/individual?tab=resumo', 'chart-budget', 'Gastos por categoria',
      'Quanto você gastou em cada categoria no mês (pessoal + sua parte da casa). O tracinho marca o limite do orçamento; o que passou fica em vermelho com "▲ acima".'),
    s('/individual?tab=resumo', 'chart-worth', 'Evolução do patrimônio', 'A soma dos saldos dos seus investimentos no fim de cada um dos últimos 12 meses.'),
    s('/individual?tab=entradas', 'recurring-list', 'Rendas fixas',
      'Cadastre uma vez o que cai todo mês (salário, aluguel que você recebe…) com valor e dia. Todo mês ela aparece aqui como pendente.'),
    s('/individual?tab=entradas', ['recurring-receive', 'recurring-status', 'recurring-list'], 'Marcar como recebida',
      'Quando o dinheiro cair, um toque lança a entrada do mês com o valor da renda. A seta de desfazer apaga esse recebimento. Se o valor mudou, edite a renda antes.'),
    s('/individual?tab=entradas', ['add-income', 'incomes-list'], 'Entradas avulsas',
      'Freela, bônus, venda de algo usado: o que não se repete. Lance com descrição, valor, data e categoria.'),
    s('/individual?tab=gastos', 'add-personal', 'Adicionar gasto pessoal',
      'Abre o formulário já marcado como Pessoal. Gastos pessoais <b>não entram no acerto</b> da casa.'),
    s('/individual?tab=gastos', ['personal-list', 'personal-extrato'], 'Extrato pessoal',
      'Todos os seus gastos pessoais do mês. Use o lápis para editar (inclusive trocar para Casa, se foi engano) e a lixeira para excluir.'),
    s('/individual?tab=gastos', 'house-share', 'Minha parte da casa',
      `Quanto de cada despesa da casa cabe a você. É isso que entra nas suas saídas, não o valor inteiro. Ex.: mercado de R$ 300 em 50/50 → R$ 150 para você, não importa se quem pagou foi ${n1}, ${n2} ou se foi dividido na hora.`),
    s('/individual?tab=investimentos', ['add-investment', 'portfolio'], 'Sua carteira',
      'Crie cada aplicação (CDB, ações, FIIs, previdência…). A tabela mostra o <b>aportado</b> (aportes − resgates), o <b>saldo</b> e o <b>rendimento</b> em reais e em %.'),
    s('/individual?tab=investimentos', ['move-actions', 'portfolio'], 'Aporte, resgate e saldo',
      '<b>Aporte</b>: dinheiro que você colocou. <b>Resgate</b>: o que tirou. <b>Atualizar saldo</b>: informe o saldo que o banco mostra; a diferença para o aportado vira rendimento.<br><br>Ex.: aportou R$ 1.000 e o banco mostra R$ 1.030 → rendimento de R$ 30 (3%). Arquive o que você já zerou.'),
    s('/individual?tab=orcamento', 'budget-list', 'Orçamento',
      'Um limite mensal por categoria. A barra mostra quanto já foi (pessoal + sua parte da casa) e avisa quando passa do limite.'),
    s('/individual?tab=orcamento', 'budget-edit', 'Definir limites',
      'Escreva quanto quer gastar por mês em cada categoria (ex.: Lazer 300,00). Deixe vazio o que não quiser controlar. Vale para todos os meses.'),

    // ---- Acerto & Metas
    s('/acerto', 'acerto-transfer', 'Quem transfere para quem',
      'O resultado do mês: quanto uma pessoa precisa transferir para a outra para as contas da casa ficarem justas.'),
    s('/acerto', 'acerto-members', 'Devido, Pago e Saldo',
      `<b>Devido</b>: a parte de cada um nos gastos da casa (pela divisão).<br><b>Pago</b>: quanto cada um realmente pagou.<br><b>Saldo</b> = Pago − Devido. Quem ficou negativo transfere esse valor para o outro.<br><br>Ex.: ${n1} pagou R$ 300, ${n2} R$ 100, 50/50 → cada um devia R$ 200; ${n2} transfere R$ 100.`),
    s('/acerto', ['acerto-settle', 'acerto-transfer'], 'Marcar como quitado',
      'Depois de fazer a transferência (Pix, dinheiro…), clique aqui para registrar. O valor pendente do mês zera.'),
    s('/acerto', 'goals', 'Metas compartilhadas',
      'Objetivos a dois, como uma viagem ou reserva de emergência, com o quanto cada um já guardou.'),
    s('/acerto', 'new-goal', 'Criar nova meta', 'Dê um nome, um valor alvo e, se quiser, um prazo.'),
    s('/acerto', ['goal-contribute', 'goals'], 'Aportar',
      'Registre quanto alguém guardou para a meta. A barra de progresso e o total de cada pessoa atualizam na hora.'),
    s('/acerto', 'house-expenses', 'Despesas da casa',
      'Todos os gastos da casa que formam o acerto do mês, com quem pagou (ou "Dividido na hora") e a divisão usada em cada um.'),
    s('/acerto', 'settings', 'Configurações', 'Seu nome como aparece no app e a divisão padrão das despesas da casa.'),
    s('/acerto', 'settings-pct', 'Divisão padrão (%)',
      `Sua parte em todos os gastos da casa. A outra pessoa fica com o resto: 60 para ${a} = 40 para ${b}. Vale para os <b>próximos</b> lançamentos: cada gasto guarda a divisão com que foi salvo, então meses anteriores não mudam.`),
    s('/acerto', 'settings-logout', 'Sair', 'Também dá para sair por aqui.'),
    s('/acerto', 'categories', 'Categorias',
      'A lista é <b>da casa</b>: os dois veem e editam. Crie categorias de gastos e de entradas com ícone e cor; elas aparecem em todos os formulários, no orçamento e nos gráficos. Quais gastos pessoais usam cada uma continua privado.'),
    s('/acerto', ['category-actions', 'categories'], 'Editar, arquivar ou excluir',
      'O lápis renomeia (o nome muda em todo o histórico). <b>Arquivar</b> tira das opções novas e mantém o histórico. <b>Excluir</b> arquiva a categoria, e dá para antes <b>mover os lançamentos</b> para outra.'),
    s('/feedback', ['feedback-copy'], 'Feedback e revisão semanal',
      'Aqui ficam os feedbacks dos dois, com filtros por situação e tela. Uma vez por semana, toque em <b>Copiar abertos para o Claude</b>, cole numa conversa com o Claude e peça as correções. Depois marque como resolvido o que foi feito.'),

    // ---- Ajuda
    s('/ajuda', 'help-restart', 'Como usar',
      'Esta página tem o passo a passo de tudo, com exemplos em reais. Refaça este tour quando quiser pelo botão aqui (no computador, também por "Fazer tour" no menu lateral).'),
    s('/ajuda', null, 'Dica: use como app no celular',
      '<b>Android (Chrome)</b>: menu ⋮ → "Adicionar à tela inicial".<br><b>iPhone (Safari)</b>: botão Compartilhar → "Adicionar à Tela de Início".<br><br>O DuoFinance ganha um ícone e abre em tela cheia. Pronto, é isso!'),
  ]
}

export function isTourDone(userId) {
  try {
    return !!localStorage.getItem(KEY(userId))
  } catch {
    return true // storage blocked: don't nag on every load
  }
}

let active = null

let starting = false

export async function startTour(router) {
  // isActive(), not onDestroyed: driver skips onDestroyed when closed mid-animation, which would lock the tour out.
  if (starting || active?.isActive()) return
  starting = true
  const userId = state.session?.user?.id
  try {
    localStorage.setItem(KEY(userId), '1')
  } catch {
    // storage blocked: tour still runs
  }
  closeExpenseForm()
  state.feedbackOpen = false
  const steps = buildSteps()
  let busy = false

  // Push the target step's route if needed, wait for its element, then let driver move.
  const go = async (index, move) => {
    if (busy) return
    busy = true
    try {
      const step = steps[index]
      if (step.route !== router.currentRoute.value.fullPath) await router.push(step.route)
      await waitForTarget(step)
      reveal(pick(step))
      move()
    } catch {
      move() // never hang: worst case the step shows centered
    } finally {
      busy = false
    }
  }

  active = driver({
    steps: steps.map(({ el, popover }) => ({ element: el ? () => pick({ el }) : undefined, popover })),
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Próximo',
    prevBtnText: 'Anterior',
    doneBtnText: 'Concluir',
    popoverClass: 'duo-tour',
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 12,
    disableActiveInteraction: true,
    onNextClick: (_el, _step, { driver: d }) => {
      const i = d.getActiveIndex()
      if (i >= steps.length - 1) return d.destroy()
      go(i + 1, d.moveNext)
    },
    onPrevClick: (_el, _step, { driver: d }) => {
      const i = d.getActiveIndex()
      if (i > 0) go(i - 1, d.movePrevious)
    },
  })

  try {
    if (router.currentRoute.value.fullPath !== steps[0].route) await router.push(steps[0].route)
    await waitForTarget(steps[1]) // let the first page load behind the welcome popover
    active.drive(0)
  } finally {
    starting = false
  }
}

// First login on this browser: show the tour once per user.
export function maybeStartTour(router) {
  const id = state.session?.user?.id
  if (id && !isTourDone(id)) startTour(router)
}
