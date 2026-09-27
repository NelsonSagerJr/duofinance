-- Rode depois de criar os 2 usuários em Authentication > Users.
-- Troque os e-mails, nomes e o nome da casa abaixo (não faça commit com os dados reais).
with h as (
  insert into public.households (name) values ('Nossa Casa') returning id
)
insert into public.members (user_id, household_id, name, default_share_pct)
select u.id, h.id, v.name, 50
from h
cross join (values
  ('pessoa1@exemplo.com', 'Pessoa 1'),
  ('pessoa2@exemplo.com', 'Pessoa 2')
) as v (email, name)
join auth.users u on u.email = v.email;
