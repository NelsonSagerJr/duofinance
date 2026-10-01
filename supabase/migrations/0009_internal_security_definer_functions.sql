-- Keep app-facing RPC names stable while moving privileged implementations
-- out of the PostgREST-exposed public schema.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Moving this function preserves policy dependencies; replace its body with
-- an empty search_path and fully qualified object names.
alter function public.my_household_id() set schema private;
create or replace function private.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.members as m
  where m.user_id = (select auth.uid())
$$;
revoke all on function private.my_household_id() from public, anon;
grant execute on function private.my_household_id() to authenticated;

-- Defaults store function dependencies by OID, but set them explicitly so
-- newly inserted rows use the private helper too.
alter table public.categories
  alter column household_id set default private.my_household_id();
alter table public.feedback
  alter column household_id set default private.my_household_id();

-- Replace the policies that used the public helper. Keep the existing access
-- rules and evaluate stable identity helpers once per statement.
drop policy households_select on public.households;
create policy households_select on public.households for select to authenticated
  using (id = (select private.my_household_id()));

drop policy households_update on public.households;
create policy households_update on public.households for update to authenticated
  using (id = (select private.my_household_id()))
  with check (id = (select private.my_household_id()));

drop policy members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (household_id = (select private.my_household_id()));

drop policy fixed_bills_all on public.fixed_bills;
create policy fixed_bills_all on public.fixed_bills for all to authenticated
  using (household_id = (select private.my_household_id()))
  with check (household_id = (select private.my_household_id()));

drop policy settlements_all on public.settlements;
create policy settlements_all on public.settlements for all to authenticated
  using (household_id = (select private.my_household_id()))
  with check (household_id = (select private.my_household_id()));

drop policy goals_all on public.goals;
create policy goals_all on public.goals for all to authenticated
  using (household_id = (select private.my_household_id()))
  with check (household_id = (select private.my_household_id()));

drop policy goal_contributions_all on public.goal_contributions;
create policy goal_contributions_all on public.goal_contributions for all to authenticated
  using (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and g.household_id = (select private.my_household_id())
    )
  )
  with check (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and g.household_id = (select private.my_household_id())
    )
    and exists (
      select 1 from public.members m
      where m.user_id = member_id and m.household_id = (select private.my_household_id())
    )
  );

drop policy expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (
    household_id = (select private.my_household_id())
    and (scope = 'house' or owner_id = (select auth.uid()))
  );

drop policy expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    household_id = (select private.my_household_id())
    and (scope = 'house' or (owner_id = (select auth.uid()) and paid_by = (select auth.uid())))
  );

drop policy expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated
  using (
    household_id = (select private.my_household_id())
    and (scope = 'house' or owner_id = (select auth.uid()))
  )
  with check (
    household_id = (select private.my_household_id())
    and (scope = 'house' or (owner_id = (select auth.uid()) and paid_by = (select auth.uid())))
  );

drop policy expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated
  using (
    household_id = (select private.my_household_id())
    and (scope = 'house' or owner_id = (select auth.uid()))
  );

drop policy feedback_select on public.feedback;
create policy feedback_select on public.feedback for select to authenticated
  using (household_id = (select private.my_household_id()));

drop policy feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (
    household_id = (select private.my_household_id())
    and user_id = (select auth.uid())
  );

drop policy feedback_update on public.feedback;
create policy feedback_update on public.feedback for update to authenticated
  using (household_id = (select private.my_household_id()))
  with check (household_id = (select private.my_household_id()));

drop policy feedback_delete_own on public.feedback;
create policy feedback_delete_own on public.feedback for delete to authenticated
  using (
    household_id = (select private.my_household_id())
    and user_id = (select auth.uid())
  );

drop policy categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (household_id = (select private.my_household_id()));

drop policy categories_insert on public.categories;
create policy categories_insert on public.categories for insert to authenticated
  with check (household_id = (select private.my_household_id()));

drop policy categories_update on public.categories;
create policy categories_update on public.categories for update to authenticated
  using (household_id = (select private.my_household_id()))
  with check (household_id = (select private.my_household_id()));

-- Move the privileged implementation behind the private schema. The wrapper
-- stays SECURITY INVOKER so the app can keep calling public.move_category.
alter function public.move_category(uuid, uuid) set schema private;
create or replace function private.move_category(from_id uuid, to_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hh uuid := private.my_household_id();
  me uuid := (select auth.uid());
  k text;
begin
  select c.kind into k
  from public.categories c
  where c.id = from_id and c.household_id = hh;

  if hh is null or k is null or from_id = to_id
     or not exists (
       select 1 from public.categories c
       where c.id = to_id and c.household_id = hh and c.kind = k and not c.archived
     ) then
    raise exception 'categoria inválida';
  end if;

  if k = 'expense' then
    update public.expenses set category_id = to_id
     where category_id = from_id and household_id = hh
       and (scope = 'house' or owner_id = me);
    update public.fixed_bills set category_id = to_id
     where category_id = from_id and household_id = hh;
    update public.budgets t set limit_cents = t.limit_cents + s.limit_cents
      from public.budgets s
     where t.user_id = me and t.category_id = to_id
       and s.user_id = me and s.category_id = from_id;
    delete from public.budgets
     where user_id = me and category_id = from_id
       and exists (
         select 1 from public.budgets t
         where t.user_id = me and t.category_id = to_id
       );
    update public.budgets set category_id = to_id
     where user_id = me and category_id = from_id;
  else
    update public.incomes set category_id = to_id
     where category_id = from_id and user_id = me;
    update public.recurring_incomes set category_id = to_id
     where category_id = from_id and user_id = me;
  end if;

  -- Always archive; whether it could be deleted could reveal partner usage.
  update public.categories set archived = true where id = from_id;
end
$$;
revoke all on function private.move_category(uuid, uuid) from public, anon;
grant execute on function private.move_category(uuid, uuid) to authenticated;

create function public.move_category(from_id uuid, to_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.move_category(from_id, to_id);
end
$$;
revoke all on function public.move_category(uuid, uuid) from public, anon;
grant execute on function public.move_category(uuid, uuid) to authenticated;

-- Do the same for the split-update RPC.
alter function public.set_default_share(numeric) set schema private;
create or replace function private.set_default_share(my_pct numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if my_pct is null or my_pct < 0 or my_pct > 100 then
    raise exception 'percentual inválido';
  end if;

  update public.members
     set default_share_pct = case
       when user_id = (select auth.uid()) then my_pct
       else 100 - my_pct
     end
   where household_id = private.my_household_id();
end
$$;
revoke all on function private.set_default_share(numeric) from public, anon;
grant execute on function private.set_default_share(numeric) to authenticated;

create function public.set_default_share(my_pct numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.set_default_share(my_pct);
end
$$;
revoke all on function public.set_default_share(numeric) from public, anon;
grant execute on function public.set_default_share(numeric) to authenticated;

commit;
