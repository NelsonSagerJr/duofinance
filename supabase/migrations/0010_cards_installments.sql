-- Cartões de crédito (privados) + compras parceladas. Safe to run on a database that already has 0001–0009.
-- One transaction: a failure part-way leaves nothing half-applied.
begin;

-- ---- Cartões ------------------------------------------------------------------
-- Private per user like the rest of Meu Espaço. closing_day: purchases on or after it go to the next invoice.
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  closing_day smallint not null check (closing_day between 1 and 31),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index cards_user_idx on public.cards (user_id);

-- Which of MY cards paid an expense: one private tag per (expense, user), so on a house expense split at the
-- till each member tags their own card and the partner never sees it. The composite FK keeps the card mine.
create table public.expense_cards (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  primary key (expense_id, user_id),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade
);
create index expense_cards_card_idx on public.expense_cards (card_id);
create index expense_cards_user_idx on public.expense_cards (user_id);

alter table public.cards enable row level security;
alter table public.expense_cards enable row level security;

create policy cards_own on public.cards for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- The exists() runs under the expenses RLS, so I can only tag expenses I can see.
create policy expense_cards_own on public.expense_cards for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.expenses e where e.id = expense_id));

revoke all on public.cards, public.expense_cards from anon, authenticated;
grant select, insert, update, delete on public.cards, public.expense_cards to authenticated;

-- ---- Parcelas -----------------------------------------------------------------
-- A purchase in N installments = N expense rows sharing installment_group, one per month (spent_on + k months).
alter table public.expenses
  add column installment_group uuid,
  add column installment_no smallint,
  add column installment_count smallint,
  add constraint expenses_installments_valid check (
    (installment_group is null and installment_no is null and installment_count is null)
    or (installment_count between 2 and 48 and installment_no between 1 and installment_count)
  );
create index expenses_installment_group_idx on public.expenses (installment_group) where installment_group is not null;

commit;
