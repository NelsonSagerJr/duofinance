-- Fix Supabase linter warnings without changing the row access rules.
-- Wrapping stable auth/helper calls in scalar SELECT lets PostgreSQL evaluate
-- them once per statement instead of once per candidate row.

drop policy members_update_self on public.members;
create policy members_update_self on public.members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (
    household_id = (select public.my_household_id())
    and (scope = 'house' or owner_id = (select auth.uid()))
  );

drop policy expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    household_id = (select public.my_household_id())
    and (scope = 'house' or (owner_id = (select auth.uid()) and paid_by = (select auth.uid())))
  );

drop policy expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated
  using (
    household_id = (select public.my_household_id())
    and (scope = 'house' or owner_id = (select auth.uid()))
  )
  with check (
    household_id = (select public.my_household_id())
    and (scope = 'house' or (owner_id = (select auth.uid()) and paid_by = (select auth.uid())))
  );

drop policy expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated
  using (
    household_id = (select public.my_household_id())
    and (scope = 'house' or owner_id = (select auth.uid()))
  );

drop policy feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (
    household_id = (select public.my_household_id())
    and user_id = (select auth.uid())
  );

drop policy feedback_delete_own on public.feedback;
create policy feedback_delete_own on public.feedback for delete to authenticated
  using (
    household_id = (select public.my_household_id())
    and user_id = (select auth.uid())
  );

-- This helper is not part of the app API. Revoke execution if it exists in a
-- project where it was created outside the committed migrations.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
