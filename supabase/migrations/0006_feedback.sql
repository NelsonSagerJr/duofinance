-- Feedback about the app, shared by the household (like house expenses).
-- One transaction: a failure part-way leaves nothing half-applied.
begin;
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household_id() references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  route text not null check (char_length(route) <= 80),
  element text check (char_length(element) <= 200),
  kind text not null check (kind in ('bug', 'improvement', 'missing')),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (user_id, household_id) references public.members (user_id, household_id) on delete cascade
);
create index feedback_household_created_idx on public.feedback (household_id, created_at desc);

alter table public.feedback enable row level security;

create policy feedback_select on public.feedback for select to authenticated
  using (household_id = public.my_household_id());
create policy feedback_insert on public.feedback for insert to authenticated
  with check (household_id = public.my_household_id() and user_id = auth.uid());
-- Either of the two can mark an item resolved/reopened; only the status columns are writable.
create policy feedback_update on public.feedback for update to authenticated
  using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());
create policy feedback_delete_own on public.feedback for delete to authenticated
  using (household_id = public.my_household_id() and user_id = auth.uid());

revoke all on public.feedback from anon, authenticated;
grant select, insert, delete on public.feedback to authenticated;
grant update (status, resolved_at) on public.feedback to authenticated;

commit;
