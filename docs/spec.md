# DuoFinance — spec

Site para um casal controlar gastos pessoais, contas da casa e acerto entre os dois.

## Decisões

- **Stack:** Vue 3 + Vite + Tailwind CSS (tokens do `design/harmonia_financeira/DESIGN.md`) + `@supabase/supabase-js`. SPA com `createWebHashHistory` (GitHub Pages não tem rewrite de rota).
- **Hospedagem:** GitHub Pages via GitHub Actions. `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` vêm de *repository variables* no build. A publishable key é pública por design; a proteção é RLS. CSP via `<meta>` injetada no build (`vite.config.js`).
- **Banco/Auth:** Supabase (Postgres). Login por e-mail + senha. Cadastro público desligado no painel; os dois usuários são criados manualmente.
- **Dinheiro:** sempre inteiro em centavos (`amount_cents`). Formatação `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`.
- **Idioma:** pt-BR. Tema claro e escuro (sistema/claro/escuro, `src/lib/theme.js`; tokens em `src/style.css`). Responsivo: sidebar no desktop, bottom nav no celular.
- **Categorias:** tabela `categories` da casa (ver "Categorias personalizáveis"); a lista fixa antiga virou o seed de cada casa.
- **Nomes das pessoas** vêm do banco (`members.name`), nunca hardcoded.

## Modelo de dados

- `households(id, name, created_at)`
- `members(user_id → auth.users PK, household_id, name, default_share_pct numeric default 50)` — a soma dos dois `default_share_pct` = 100.
- `expenses(id, household_id, description, amount_cents int > 0, spent_on date, category text, scope 'house'|'personal', owner_id → members nullable (obrigatório se personal), paid_by → members, share_pct_override jsonb nullable ({user_id: pct}), fixed_bill_id nullable, bill_month date nullable, created_by, created_at)`
  - Unique `(fixed_bill_id, bill_month)` quando não nulo.
- `fixed_bills(id, household_id, name, amount_cents, due_day 1..31, category, active bool)` — contas recorrentes da casa. Marcar como paga no mês = criar uma `expense` com `scope='house'`, `fixed_bill_id` e `bill_month` (1º dia do mês).
- `settlements(id, household_id, month date, from_id, to_id, amount_cents, settled_at)` — registro de "Marcar como quitado".
- `goals(id, household_id, name, target_cents, deadline date nullable)` + `goal_contributions(id, goal_id, member_id, amount_cents, contributed_on)`.

**RLS:** toda tabela com `household_id` só é visível/editável se `household_id = (select household_id from members where user_id = auth.uid())`. `goal_contributions` herda pelo goal. `members`: usuário lê membros do próprio household; atualiza só a si mesmo. Helper `security definer` `my_household_id()` para evitar recursão de policy.

**Gastos pessoais são privados** (`0003_private_personal.sql`): `expenses` com `scope='personal'` só são visíveis/editáveis pelo dono (`owner_id = auth.uid()`), e ao gravar exigem `owner_id = paid_by = auth.uid()`. O parceiro não vê nem o total. Pagamento de conta fixa é sempre `house`. Percentual padrão só muda via `set_default_share()` (`0002_hardening.sql`).

## Regra do acerto (house expenses do mês)

Para cada despesa `scope='house'` do mês:
- percentuais = `share_pct_override` se presente, senão `default_share_pct` de cada membro;
- devido de cada membro += `amount * pct/100`; pago do membro `paid_by` += `amount`.

Saldo de cada membro = pago − devido. Quem tem saldo negativo transfere `|saldo|` para o outro, menos o que já foi quitado em `settlements` naquele mês. Arredondamento: calcular em centavos com `Math.round` por despesa; a diferença de arredondamento fica no membro que pagou. Função pura em `src/lib/settlement.js` com teste (Vitest).

Gastos `personal` não entram no acerto; só aparecem no Meu Espaço e no card pessoal do próprio dono.

## Telas (referência visual local em `design/`, fora do git)

1. **Login** — e-mail/senha, visual do design system.
2. **Visão Geral** (`vis_o_geral_conjunta`) — seletor de mês; cards: total da casa, contas fixas (pagas/pendentes), meus gastos pessoais; resumo do acerto ("X transfere R$ Y para Z"); próximos vencimentos; lançamento rápido (descrição, valor, categoria, data, casa/pessoal, quem pagou); atividades recentes. **Sem** "rateio proporcional/modelo ativo".
3. **Custos Fixos** (`custos_fixos_da_casa`) — CRUD de contas fixas; status do mês (paga/pendente/vencida); botão "Marcar como paga" (escolhe quem pagou).
4. **Meu Espaço** (`espa_o_individual`) — só os gastos pessoais de quem está logado; totais do mês por categoria; editar/excluir.
5. **Acerto & Metas** (`acerto_de_contas_metas`) — detalhe do acerto do mês (devido/pago/saldo por pessoa), tabela das despesas da casa, "Marcar como quitado"; editar percentuais padrão (50/50 default); metas com aportes.
6. **Configurações** (pode ser seção dentro de Acerto) — nome do membro, percentual padrão, sair.
7. **Como usar** (`/ajuda`) — passo a passo por tela + tour guiado (driver.js, `src/lib/tour.js`) que abre sozinho no primeiro login e pode ser refeito pelo menu.

Fora do escopo: notificações, PDF, Pix, fotos, dicas, "reunião do casal", múltiplos households, service worker (o manifest PWA existe, sem offline).

## Setup (README)

1. Criar projeto Supabase; rodar `supabase/migrations/*.sql` no SQL editor.
2. Desligar signups; criar os 2 usuários em Auth.
3. Rodar `supabase/seed.sql` ajustando e-mails/nomes (cria household + members).
4. No GitHub: Settings → Pages → Source: GitHub Actions; Settings → Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Fase 2 — "Dividido na hora" e finanças pessoais

### Dividido na hora (despesas da casa)
- `expenses.paid_by` passa a aceitar `null` **somente** em `scope='house'`: significa que cada um pagou a própria parte no caixa. UI: 3ª opção em "Quem pagou?" → **Dividido na hora** (também em "Marcar como paga" de conta fixa).
- Acerto: para essas despesas, cada membro `paid += due` (saldo 0). Continua no total da casa e na tabela de despesas ("Dividido na hora" na coluna quem pagou).

### Meu Espaço (privado por usuário)
Tudo aqui tem RLS `user_id = auth.uid()` (sem acesso do parceiro, nem totais). Abas: **Resumo · Entradas · Gastos · Investimentos · Orçamento**.

Tabelas novas (todas com `user_id → auth.users`, `household_id` não necessário):
- `recurring_incomes(id, user_id, name, amount_cents, day 1..31, category, active)` — renda fixa; "Marcar como recebida" cria uma `income` com `recurring_income_id` + `income_month` (unique por mês).
- `incomes(id, user_id, description, amount_cents > 0, received_on date, category, recurring_income_id nullable, income_month nullable)`. Categorias de entrada fixas no código: Salário, Freela, Bônus, Rendimentos, Vendas, Outros.
- `investments(id, user_id, name, kind, archived bool)` — kind: Renda fixa, Ações, FIIs, Cripto, Previdência, Outros.
- `investment_moves(id, user_id, investment_id, type 'deposit'|'withdraw'|'balance', amount_cents >= 0, moved_on date)` — `balance` = saldo informado naquela data. Saldo atual = último `balance` + aportes − resgates posteriores a ele (sem `balance`: aportes − resgates). Rendimento = saldo atual − (aportes − resgates), e % sobre o aportado líquido.
- `budgets(user_id, category, limit_cents > 0, primary key (user_id, category))` — limite mensal por categoria de gasto.

Métricas do mês (funções puras em `src/lib/personal.js`, com teste):
- **Entradas** = soma de `incomes` do mês.
- **Saídas** = gastos pessoais do mês + **minha parte da casa** (`round(amount * share_pct[me] / 100)` de cada despesa da casa do mês, com a mesma regra de arredondamento do acerto).
- **Sobra** = entradas − saídas; **taxa de poupança** = sobra / entradas.
- **Investido no mês** = aportes − resgates do mês; **patrimônio** = soma dos saldos atuais.
- **Orçamento**: por categoria, gasto (pessoal + parte da casa) vs limite.

Resumo: KPIs acima + gráficos em SVG próprio (sem lib): entradas × saídas dos últimos 12 meses com linha de sobra; gastos por categoria vs limite; evolução do patrimônio (12 meses).

Detalhes da implementação (Fase 2):
- Arredondamento de "Dividido na hora": sem pagador, a diferença de centavo fica com o primeiro membro (ordem alfabética), para as partes somarem o valor (`dueByMember` em `src/lib/settlement.js`).
- Saldo, patrimônio e carteira são a posição **no fim do mês escolhido** (movimentações posteriores ainda não contam). Movimentações do mesmo dia seguem a ordem de criação.
- A aba do Meu Espaço fica na URL (`#/individual?tab=entradas`).

## Feedback do app
- Botão flutuante **Feedback** em todas as telas (logado) → modal: tela (rota atual, editável), **apontar na tela** opcional (clicar num elemento; grava o `data-tour` mais próximo ou um trecho do texto dele), tipo (`bug` Problema · `improvement` Melhoria · `missing` Está faltando), mensagem.
- Tabela `feedback` (`0006_feedback.sql`): compartilhada pela casa; cada um cria em nome próprio, qualquer um marca `resolved`, só o autor apaga; texto não é editável.
- Página **Feedback** (`/feedback`): lista com filtros aberto/resolvido e tela, quem mandou, data; marcar resolvido/reabrir; **Copiar abertos para o Claude** → markdown agrupado por tela, para colar na revisão semanal.

## Categorias personalizáveis
- Tabela `categories(id, household_id, kind 'expense'|'income', name, icon (Material Symbol), color (token de cor da paleta), archived, sort)` — lista **da casa**: os dois veem e editam (só nomes; uso nos gastos pessoais continua privado).
- As categorias fixas atuais (`src/lib/categories.js` e as de entrada da fase 2) viram o seed inicial de cada casa; `expenses.category`, `incomes.category`, `recurring_incomes.category`, `fixed_bills.category`, `budgets.category` passam a referenciar `categories.id` (FK composta com household quando houver), migrando os valores existentes (`0007`).
- Configurações → **Categorias**: criar (nome, ícone de uma grade, cor), editar (renomear afeta o histórico), excluir = **arquivar** (some das opções novas, histórico intacto), opcionalmente "mover lançamentos para…" antes. Nunca apaga de verdade: um delete que falhasse só quando o parceiro usa a categoria em lançamentos privados revelaria esse uso.

Detalhes da implementação (categorias e feedback):
- `0007_categories.sql` roda numa transação: cria `categories`, semeia os padrões em cada casa (trigger `households_seed_categories` para casas novas), converte as chaves de texto antigas (chave ou rótulo; desconhecido → Outros) em `category_id` e apaga as colunas de texto. `budgets` passa a ter PK `(user_id, category_id)`.
- Mesma casa e mesmo tipo garantidos no banco: FK composta `(category_id, household_id)` em `expenses`/`fixed_bills` e trigger `check_category()` em todas as cinco tabelas (nas privadas, a casa vem de `members`).
- Sem DELETE: `move_category(de, para)` move linhas da casa e as privadas de quem chamou e sempre arquiva a origem; o destino precisa estar ativo. Nada revela uso privado do parceiro.
- Feedback: "apontar na tela" grava `[data-tour mais próximo] "trecho"` (máx. 200); dentro de `[data-private]` (Meu Espaço, meu total pessoal) só o nome da área.
