-- Hardening from the pre-public security audit. Safe to run on a database that already has 0001.

-- TRUNCATE bypasses RLS; the app only needs select/insert/update/delete.
revoke truncate, references, trigger on public.households, public.members, public.fixed_bills,
  public.expenses, public.settlements, public.goals, public.goal_contributions from authenticated, anon;

-- Percentages only change through set_default_share(), which keeps the pair summing to 100.
revoke update on public.members from authenticated;
grant update (name) on public.members to authenticated;

-- Supabase grants execute to anon directly; `revoke ... from public` in 0001 doesn't remove that.
revoke execute on function public.my_household_id() from anon;
revoke execute on function public.set_default_share(numeric) from anon;

-- Length limits so nobody can bloat the database with megabyte strings.
alter table public.households add constraint households_name_len check (char_length(name) between 1 and 80);
alter table public.members add constraint members_name_len check (char_length(name) between 1 and 80);
alter table public.fixed_bills add constraint fixed_bills_name_len check (char_length(name) between 1 and 120),
  add constraint fixed_bills_category_len check (char_length(category) <= 40);
alter table public.expenses add constraint expenses_description_len check (char_length(description) between 1 and 200),
  add constraint expenses_category_len check (char_length(category) <= 40);
alter table public.goals add constraint goals_name_len check (char_length(name) between 1 and 120);

-- share_pct_override: {member_uuid: pct}, every pct a number in 0..100, summing to 100.
create or replace function public.valid_share_override(o jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select o is null or (
    jsonb_typeof(o) = 'object'
    and not exists (
      select 1 from jsonb_each(o) e
      where jsonb_typeof(e.value) <> 'number' or (e.value)::numeric < 0 or (e.value)::numeric > 100
    )
    and (select coalesce(sum((e.value)::numeric), 0) from jsonb_each(o) e) = 100
  )
$$;
alter table public.expenses add constraint expenses_share_override_valid check (public.valid_share_override(share_pct_override));

-- created_by always reflects the real caller, whatever the client sends.
create or replace function public.set_created_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;
  return new;
end
$$;
create trigger expenses_created_by before insert or update on public.expenses
  for each row execute function public.set_created_by();
