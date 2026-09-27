-- Fase 2: "Dividido na hora" + finanças pessoais (Meu Espaço). Safe to run on a database that already has 0001–0004.
-- One transaction: a failure part-way leaves nothing half-applied.
begin;

-- ---- Dividido na hora -------------------------------------------------------
-- paid_by null = each member paid their own share at the till. Only for house expenses.
-- The 0003 policies already cover it: personal rows still need owner_id = paid_by = auth.uid()
-- (null = auth.uid() is not true, so a personal row with paid_by null fails the policy too),
-- and the composite FK (paid_by, household_id) is MATCH SIMPLE, so a null skips it.
alter table public.expenses alter column paid_by drop not null;
alter table public.expenses add constraint expenses_paid_by_house_only check (paid_by is not null or scope = 'house');

-- ---- Finanças pessoais --------------------------------------------------------
-- Private per user: no household, no partner access, not even totals. user_id defaults to the caller and the
-- policies require it on every read and write. unique (id, user_id) is the target of the composite FKs, so a
-- child row can only point at a parent row of the same user (FK checks skip RLS).

create table public.recurring_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  amount_cents integer not null check (amount_cents > 0),
  day smallint not null check (day between 1 and 31),
  category text not null check (category in ('salario', 'freela', 'bonus', 'rendimentos', 'vendas', 'outros')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index recurring_incomes_user_idx on public.recurring_incomes (user_id);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  amount_cents integer not null check (amount_cents > 0),
  received_on date not null default current_date,
  category text not null check (category in ('salario', 'freela', 'bonus', 'rendimentos', 'vendas', 'outros')),
  recurring_income_id uuid,
  income_month date check (income_month is null or extract(day from income_month) = 1),
  created_at timestamptz not null default now(),
  check (recurring_income_id is null or income_month is not null),
  unique (user_id, recurring_income_id, income_month), -- one "recebida" per fixed income per month (user_id first: no cross-user probing)
  foreign key (recurring_income_id, user_id) references public.recurring_incomes (id, user_id)
    on delete set null (recurring_income_id)
);
create index incomes_user_received_idx on public.incomes (user_id, received_on);

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('renda_fixa', 'acoes', 'fiis', 'cripto', 'previdencia', 'outros')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index investments_user_idx on public.investments (user_id);

create table public.investment_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  investment_id uuid not null,
  type text not null check (type in ('deposit', 'withdraw', 'balance')),
  amount_cents integer not null check (amount_cents >= 0 and (amount_cents > 0 or type = 'balance')),
  moved_on date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key (investment_id, user_id) references public.investments (id, user_id) on delete cascade
);
create index investment_moves_user_moved_idx on public.investment_moves (user_id, moved_on);
create index investment_moves_investment_idx on public.investment_moves (investment_id);

create table public.budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('alimentacao', 'moradia', 'contas', 'saude', 'transporte', 'lazer', 'pets', 'compras', 'outros')),
  limit_cents integer not null check (limit_cents > 0),
  primary key (user_id, category)
);

-- ---- RLS: owner only ----------------------------------------------------------
alter table public.recurring_incomes enable row level security;
alter table public.incomes enable row level security;
alter table public.investments enable row level security;
alter table public.investment_moves enable row level security;
alter table public.budgets enable row level security;

create policy recurring_incomes_own on public.recurring_incomes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy incomes_own on public.incomes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy investments_own on public.investments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy investment_moves_own on public.investment_moves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy budgets_own on public.budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---- Grants -------------------------------------------------------------------
-- Supabase grants everything (truncate/references/trigger too) to anon and authenticated by default.
revoke all on public.recurring_incomes, public.incomes, public.investments, public.investment_moves, public.budgets
  from anon, authenticated;
grant select, insert, update, delete on public.recurring_incomes, public.incomes, public.investments,
  public.investment_moves, public.budgets to authenticated;

commit;
