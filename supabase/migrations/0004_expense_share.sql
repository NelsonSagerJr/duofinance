-- Each house expense keeps its own split, frozen when it's created.
-- Changing the default % only affects expenses logged afterwards, so past months don't change.

alter table public.expenses rename column share_pct_override to share_pct;
alter table public.expenses rename constraint expenses_share_override_valid to expenses_share_pct_valid;

-- Existing house expenses get today's default split.
update public.expenses e
   set share_pct = (select jsonb_object_agg(m.user_id::text, m.default_share_pct)
                      from public.members m where m.household_id = e.household_id)
 where e.scope = 'house' and e.share_pct is null;

-- Runs as the caller, so RLS limits it to the caller's own household members.
create or replace function public.fill_share_pct()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.scope = 'personal' then
    new.share_pct := null;
  elsif new.share_pct is null then
    select jsonb_object_agg(user_id::text, default_share_pct) into new.share_pct
      from public.members where household_id = new.household_id;
  end if;
  return new;
end
$$;
create trigger expenses_share_pct before insert or update on public.expenses
  for each row execute function public.fill_share_pct();

alter table public.expenses add constraint expenses_house_has_share check (scope <> 'house' or share_pct is not null);

-- Names are shown in the guided tour; keep HTML out at the source too.
alter table public.members add constraint members_name_chars check (name !~ '[<>]');
