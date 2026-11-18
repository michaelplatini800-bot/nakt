create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- Aucune politique : personne ne peut lire ou modifier cette table depuis l'app.

create or replace function public.stats_admin()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'acces refuse';
  end if;
  return json_build_object(
    'comptes_total', (select count(*) from auth.users),
    'comptes_7_jours', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'cycles_total', (select count(*) from public.cycles)
  );
end;
$$;

revoke execute on function public.stats_admin() from anon;
grant execute on function public.stats_admin() to authenticated;
