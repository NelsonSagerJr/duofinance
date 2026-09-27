-- Categorias personalizáveis (docs/spec.md). Safe to run on a live database that already has 0001–0006:
-- seeds the default list for every household, maps the old text keys to the new rows and drops the text columns.
-- One transaction: if anything fails, nothing changes.
begin;

-- ---- Table -----------------------------------------------------------------------
-- Shared by the household (names only: which private rows use a category stays private).
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household_id() references public.households (id) on delete cascade,
  kind text not null check (kind in ('expense', 'income')),
  name text not null check (char_length(btrim(name)) between 1 and 40 and char_length(name) <= 40 and name !~ '[<>]'),
  -- Material Symbols name; the UI offers a fixed grid, the DB only keeps it a short identifier.
  icon text not null check (icon ~ '^[a-z0-9_]{1,40}$'),
  -- Palette token (tailwind.config.js); the UI maps each one to fixed classes.
  color text not null check (color in ('primary', 'secondary', 'tertiary', 'chart-in', 'chart-out', 'chart-net', 'chart-worth', 'outline')),
  archived boolean not null default false,
  sort integer not null default 0 check (sort between 0 and 10000),
  created_at timestamptz not null default now(),
  unique (id, household_id) -- target of the composite FKs from house tables
);
create unique index categories_name_uniq on public.categories (household_id, kind, lower(name)) where not archived;

alter table public.categories enable row level security;
create policy categories_select on public.categories for select to authenticated
  using (household_id = public.my_household_id());
create policy categories_insert on public.categories for insert to authenticated
  with check (household_id = public.my_household_id());
create policy categories_update on public.categories for update to authenticated
  using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());
-- No DELETE at all: "Excluir" archives. A delete that fails only when the partner's private rows use the
-- category would reveal that usage.

revoke all on public.categories from anon, authenticated;
grant select on public.categories to authenticated;
grant insert (household_id, kind, name, icon, color, archived, sort) on public.categories to authenticated;
grant update (name, icon, color, archived, sort) on public.categories to authenticated; -- never kind/household

-- ---- Defaults (the old fixed lists) ------------------------------------------------
-- key = the text the app stored before 0007; only used by the backfill below.
create or replace function public.default_categories()
returns table (key text, kind text, name text, icon text, color text, sort int)
language sql
immutable
set search_path = public
as $$
  values
    ('alimentacao', 'expense', 'Alimentação', 'restaurant', 'chart-out', 0),
    ('moradia', 'expense', 'Moradia', 'home', 'primary', 1),
    ('contas', 'expense', 'Contas', 'receipt_long', 'chart-worth', 2),
    ('saude', 'expense', 'Saúde', 'medical_services', 'tertiary', 3),
    ('transporte', 'expense', 'Transporte', 'directions_car', 'secondary', 4),
    ('lazer', 'expense', 'Lazer', 'celebration', 'chart-net', 5),
    ('pets', 'expense', 'Pets', 'pets', 'chart-in', 6),
    ('compras', 'expense', 'Compras', 'shopping_bag', 'chart-out', 7),
    ('outros', 'expense', 'Outros', 'more_horiz', 'outline', 8),
    ('salario', 'income', 'Salário', 'work', 'chart-in', 0),
    ('freela', 'income', 'Freela', 'laptop_mac', 'secondary', 1),
    ('bonus', 'income', 'Bônus', 'redeem', 'chart-net', 2),
    ('rendimentos', 'income', 'Rendimentos', 'trending_up', 'chart-worth', 3),
    ('vendas', 'income', 'Vendas', 'sell', 'chart-out', 4),
    ('outros', 'income', 'Outros', 'more_horiz', 'outline', 5)
$$;
revoke execute on function public.default_categories() from public, anon, authenticated;

-- New households get the defaults (seed.sql only inserts the household; this trigger does the rest).
create or replace function public.seed_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (household_id, kind, name, icon, color, sort)
  select new.id, d.kind, d.name, d.icon, d.color, d.sort from public.default_categories() d;
  return new;
end
$$;
revoke execute on function public.seed_categories() from public, anon, authenticated;
create trigger households_seed_categories after insert on public.households
  for each row execute function public.seed_categories();

insert into public.categories (household_id, kind, name, icon, color, sort)
select h.id, d.kind, d.name, d.icon, d.color, d.sort from public.households h cross join public.default_categories() d;

-- ---- Text keys -> category_id -------------------------------------------------------
alter table public.expenses add column category_id uuid;
alter table public.fixed_bills add column category_id uuid;
alter table public.incomes add column category_id uuid;
alter table public.recurring_incomes add column category_id uuid;
alter table public.budgets add column category_id uuid;

-- Old value = the key ('lazer') or, from hand-written SQL, the label ('Lazer'); anything else -> Outros.
create temporary table category_map on commit drop as
select distinct c.household_id, c.kind, c.id, k.old
from public.categories c
join public.default_categories() d on d.kind = c.kind and d.name = c.name
cross join lateral (values (d.key), (lower(d.name))) k (old);

update public.expenses t set category_id = coalesce(
  (select m.id from category_map m where m.household_id = t.household_id and m.kind = 'expense' and m.old = lower(btrim(t.category))),
  (select m.id from category_map m where m.household_id = t.household_id and m.kind = 'expense' and m.old = 'outros'));
update public.fixed_bills t set category_id = coalesce(
  (select m.id from category_map m where m.household_id = t.household_id and m.kind = 'expense' and m.old = lower(btrim(t.category))),
  (select m.id from category_map m where m.household_id = t.household_id and m.kind = 'expense' and m.old = 'outros'));
-- Private tables have no household_id: the user's household comes from members. 0005 already limited them to the keys.
update public.incomes t set category_id = m.id
  from public.members u, category_map m
 where u.user_id = t.user_id and m.household_id = u.household_id and m.kind = 'income' and m.old = t.category;
update public.recurring_incomes t set category_id = m.id
  from public.members u, category_map m
 where u.user_id = t.user_id and m.household_id = u.household_id and m.kind = 'income' and m.old = t.category;
update public.budgets t set category_id = m.id
  from public.members u, category_map m
 where u.user_id = t.user_id and m.household_id = u.household_id and m.kind = 'expense' and m.old = t.category;
-- A budget of a user without a household can't point anywhere (it was never shown); an income can't be dropped,
-- so the NOT NULL below aborts the whole migration instead if one exists.
delete from public.budgets where category_id is null;

alter table public.expenses drop column category, alter column category_id set not null,
  add foreign key (category_id, household_id) references public.categories (id, household_id);
alter table public.fixed_bills drop column category, alter column category_id set not null,
  add foreign key (category_id, household_id) references public.categories (id, household_id);
alter table public.incomes drop column category, alter column category_id set not null,
  add foreign key (category_id) references public.categories (id);
alter table public.recurring_incomes drop column category, alter column category_id set not null,
  add foreign key (category_id) references public.categories (id);
alter table public.budgets drop constraint budgets_pkey;
alter table public.budgets drop column category, alter column category_id set not null,
  add primary key (user_id, category_id),
  add foreign key (category_id) references public.categories (id);

create index expenses_category_idx on public.expenses (category_id);
create index fixed_bills_category_idx on public.fixed_bills (category_id);
create index incomes_category_idx on public.incomes (category_id);
create index recurring_incomes_category_idx on public.recurring_incomes (category_id);
create index budgets_category_idx on public.budgets (category_id);

-- ---- Same household + right kind, for every writer ----------------------------------------
-- The composite FK already pins house rows to their household; private rows (no household_id) are pinned here to
-- the household of their user_id. Also checks expense vs income. Definer, so it works the same for any role; the
-- error is identical for "doesn't exist" and "belongs to another household" (no existence oracle).
create or replace function public.check_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row jsonb := to_jsonb(new);
  hh uuid := coalesce((row ->> 'household_id')::uuid,
    (select m.household_id from public.members m where m.user_id = (row ->> 'user_id')::uuid));
begin
  if not exists (select 1 from public.categories c where c.id = new.category_id and c.household_id = hh and c.kind = tg_argv[0]) then
    raise exception 'categoria inválida' using errcode = '23503';
  end if;
  return new;
end
$$;
revoke execute on function public.check_category() from public, anon, authenticated;
create trigger expenses_category before insert or update on public.expenses
  for each row execute function public.check_category('expense');
create trigger fixed_bills_category before insert or update on public.fixed_bills
  for each row execute function public.check_category('expense');
create trigger budgets_category before insert or update on public.budgets
  for each row execute function public.check_category('expense');
create trigger incomes_category before insert or update on public.incomes
  for each row execute function public.check_category('income');
create trigger recurring_incomes_category before insert or update on public.recurring_incomes
  for each row execute function public.check_category('income');

-- ---- Move everything to another category, then delete ------------------------------------
-- House rows (house expenses, fixed bills) move for everyone; private rows (personal expenses, incomes, budgets)
-- only the caller's. If the partner's private rows still use the source it can't be deleted, so it's archived;
-- the result says only that (true = deleted, false = archived), never how many rows or whose.
create or replace function public.move_category(from_id uuid, to_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hh uuid := public.my_household_id();
  me uuid := auth.uid();
  k text;
begin
  select c.kind into k from public.categories c where c.id = from_id and c.household_id = hh;
  if hh is null or k is null or from_id = to_id
     or not exists (select 1 from public.categories c where c.id = to_id and c.household_id = hh and c.kind = k and not c.archived) then
    raise exception 'categoria inválida';
  end if;

  if k = 'expense' then
    update public.expenses set category_id = to_id
     where category_id = from_id and household_id = hh and (scope = 'house' or owner_id = me);
    update public.fixed_bills set category_id = to_id where category_id = from_id and household_id = hh;
    -- Merging two limits: the target keeps the sum.
    update public.budgets t set limit_cents = t.limit_cents + s.limit_cents
      from public.budgets s
     where t.user_id = me and t.category_id = to_id and s.user_id = me and s.category_id = from_id;
    delete from public.budgets
     where user_id = me and category_id = from_id
       and exists (select 1 from public.budgets t where t.user_id = me and t.category_id = to_id);
    update public.budgets set category_id = to_id where user_id = me and category_id = from_id;
  else
    update public.incomes set category_id = to_id where category_id = from_id and user_id = me;
    update public.recurring_incomes set category_id = to_id where category_id = from_id and user_id = me;
  end if;

  -- Always archive, never delete: whether it could be deleted would reveal if the partner's private rows use it.
  update public.categories set archived = true where id = from_id;
end
$$;
revoke execute on function public.move_category(uuid, uuid) from public, anon;
grant execute on function public.move_category(uuid, uuid) to authenticated;


commit;
