-- DuoFinance schema. Money is always integer cents.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  default_share_pct numeric not null default 50 check (default_share_pct between 0 and 100),
  unique (user_id, household_id) -- target of composite FKs: a member reference must be in the same household
);
create index members_household_idx on public.members (household_id);

-- security definer: reads members bypassing RLS, so member policies don't recurse.
create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.members where user_id = auth.uid()
$$;
revoke execute on function public.my_household_id() from public;
grant execute on function public.my_household_id() to authenticated;

create table public.fixed_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  amount_cents integer not null check (amount_cents > 0),
  due_day smallint not null check (due_day between 1 and 31),
  category text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, household_id) -- target of the composite FK from expenses
);
create index fixed_bills_household_idx on public.fixed_bills (household_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  spent_on date not null default current_date,
  category text not null,
  scope text not null check (scope in ('house', 'personal')),
  owner_id uuid,
  paid_by uuid not null,
  share_pct_override jsonb,
  fixed_bill_id uuid,
  bill_month date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((scope = 'personal') = (owner_id is not null)),
  check (fixed_bill_id is null or bill_month is not null),
  check (share_pct_override is null or jsonb_typeof(share_pct_override) = 'object'),
  unique (fixed_bill_id, bill_month), -- NULLs are distinct, so this only binds when set
  -- Composite FKs: FK checks skip RLS, so the household has to be part of the key itself.
  foreign key (owner_id, household_id) references public.members (user_id, household_id),
  foreign key (paid_by, household_id) references public.members (user_id, household_id),
  foreign key (fixed_bill_id, household_id) references public.fixed_bills (id, household_id)
    on delete set null (fixed_bill_id) -- PG15+
);
create index expenses_household_spent_idx on public.expenses (household_id, spent_on);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month date not null,
  from_id uuid not null,
  to_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  settled_at timestamptz not null default now(),
  check (from_id <> to_id),
  foreign key (from_id, household_id) references public.members (user_id, household_id),
  foreign key (to_id, household_id) references public.members (user_id, household_id)
);
create index settlements_household_month_idx on public.settlements (household_id, month);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  target_cents integer not null check (target_cents > 0),
  deadline date,
  created_at timestamptz not null default now()
);
create index goals_household_idx on public.goals (household_id);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  member_id uuid not null references public.members (user_id),
  amount_cents integer not null check (amount_cents > 0),
  contributed_on date not null default current_date
);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id);

-- Row Level Security ---------------------------------------------------------

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.fixed_bills enable row level security;
alter table public.expenses enable row level security;
alter table public.settlements enable row level security;
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;

create policy households_select on public.households for select to authenticated
  using (id = public.my_household_id());
create policy households_update on public.households for update to authenticated
  using (id = public.my_household_id()) with check (id = public.my_household_id());

create policy members_select on public.members for select to authenticated
  using (household_id = public.my_household_id());
create policy members_update_self on public.members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy fixed_bills_all on public.fixed_bills for all to authenticated
  using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());
create policy expenses_all on public.expenses for all to authenticated
  using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());
create policy settlements_all on public.settlements for all to authenticated
  using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());
create policy goals_all on public.goals for all to authenticated
  using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());
create policy goal_contributions_all on public.goal_contributions for all to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_id and g.household_id = public.my_household_id()))
  with check (
    exists (select 1 from public.goals g where g.id = goal_id and g.household_id = public.my_household_id())
    and exists (select 1 from public.members m where m.user_id = member_id and m.household_id = public.my_household_id())
  );

-- Grants (Supabase already grants these by default; explicit so the file is self-contained).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.households, public.fixed_bills, public.expenses,
  public.settlements, public.goals, public.goal_contributions to authenticated;
-- members: read all of the household, update only own name/percentage (never household_id / user_id).
revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;
grant update (name, default_share_pct) on public.members to authenticated;
revoke all on public.households, public.fixed_bills, public.expenses, public.settlements,
  public.goals, public.goal_contributions from anon;

-- Setting the default split touches both members (sum must stay 100), but RLS only lets a user
-- update their own row, so this runs as definer and is scoped to the caller's household.
create or replace function public.set_default_share(my_pct numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if my_pct is null or my_pct < 0 or my_pct > 100 then
    raise exception 'percentual inválido';
  end if;
  update public.members
     set default_share_pct = case when user_id = auth.uid() then my_pct else 100 - my_pct end
   where household_id = public.my_household_id();
end
$$;
revoke execute on function public.set_default_share(numeric) from public;
grant execute on function public.set_default_share(numeric) to authenticated;
