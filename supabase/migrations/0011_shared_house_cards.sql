-- House expenses: tag the card of whoever paid (the partner's too), one card per member when split at the till.
-- Card names become visible to the household; tags on personal expenses stay private. Adds a default card.
-- Safe to run on a database that already has 0001–0010. One transaction.
begin;

-- ---- Cartões: household can read (for the select), only the owner writes -------------------------------------
alter table public.cards add column is_default boolean not null default false;
create unique index cards_one_default on public.cards (user_id) where is_default;

drop policy cards_own on public.cards;
create policy cards_select on public.cards for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.members m
      where m.user_id = cards.user_id and m.household_id = (select private.my_household_id())
    )
  );
create policy cards_insert on public.cards for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy cards_update on public.cards for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cards_delete on public.cards for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---- Tags: user_id = card owner. Mine anywhere I can see the expense; anyone's in my household on house expenses.
-- The expenses subqueries run under the expenses RLS, so they only see my household's house rows and my own.
drop policy expense_cards_own on public.expense_cards;
create policy expense_cards_select on public.expense_cards for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.expenses e where e.id = expense_id and e.scope = 'house')
  );
create policy expense_cards_insert on public.expense_cards for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and exists (select 1 from public.expenses e where e.id = expense_id))
    or (
      exists (select 1 from public.expenses e where e.id = expense_id and e.scope = 'house')
      and exists (
        select 1 from public.members m
        where m.user_id = expense_cards.user_id and m.household_id = (select private.my_household_id())
      )
    )
  );
create policy expense_cards_delete on public.expense_cards for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.expenses e where e.id = expense_id and e.scope = 'house')
  );
-- No UPDATE: the app deletes and re-inserts tags.
revoke update on public.expense_cards from authenticated;

commit;
