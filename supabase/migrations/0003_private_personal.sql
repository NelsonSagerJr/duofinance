-- Personal expenses are private: only their owner can see or change them.
-- House expenses stay visible to the whole household.

drop policy expenses_all on public.expenses;

create policy expenses_select on public.expenses for select to authenticated
  using (household_id = public.my_household_id() and (scope = 'house' or owner_id = auth.uid()));

create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    household_id = public.my_household_id()
    and (scope = 'house' or (owner_id = auth.uid() and paid_by = auth.uid()))
  );

create policy expenses_update on public.expenses for update to authenticated
  using (household_id = public.my_household_id() and (scope = 'house' or owner_id = auth.uid()))
  with check (
    household_id = public.my_household_id()
    and (scope = 'house' or (owner_id = auth.uid() and paid_by = auth.uid()))
  );

create policy expenses_delete on public.expenses for delete to authenticated
  using (household_id = public.my_household_id() and (scope = 'house' or owner_id = auth.uid()));

-- Fixed bills are house bills; a payment can't be personal.
alter table public.expenses add constraint expenses_bill_is_house check (fixed_bill_id is null or scope = 'house');
