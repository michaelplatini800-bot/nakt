-- ============================================================
-- NakT — schéma de base de données
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ---------- Table 1 : cycles ----------
create table if not exists public.cycles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  start_date    date not null,
  period_length integer not null check (period_length between 1 and 10),
  cycle_length  integer not null check (cycle_length between 20 and 45),
  created_at    timestamptz not null default now()
);

-- ---------- Table 2 : journal ----------
create table if not exists public.journal (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  entry_date  date not null,
  mood        text check (char_length(mood) <= 50),
  symptoms    text check (char_length(symptoms) <= 200),
  flow        text check (flow in ('aucun', 'léger', 'moyen', 'abondant')),
  temperature numeric check (temperature between 35.0 and 42.0),
  created_at  timestamptz not null default now()
);

-- ---------- Table 3 : test_log ----------
-- Seulement la date du test + une note libre. Aucun résultat stocké.
create table if not exists public.test_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  test_date  date not null,
  note       text check (char_length(note) <= 100),
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- RLS activée : sans politique, personne n'accède à rien.
alter table public.cycles   enable row level security;
alter table public.journal  enable row level security;
alter table public.test_log enable row level security;

-- ---------- Politiques : uniquement son propre compte ----------
-- USING : lignes visibles. WITH CHECK : lignes qu'on a le droit d'écrire.
create policy "cycles_select_propre" on public.cycles
  for select using (auth.uid() = user_id);
create policy "cycles_insert_propre" on public.cycles
  for insert with check (auth.uid() = user_id);
create policy "cycles_update_propre" on public.cycles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cycles_delete_propre" on public.cycles
  for delete using (auth.uid() = user_id);

create policy "journal_select_propre" on public.journal
  for select using (auth.uid() = user_id);
create policy "journal_insert_propre" on public.journal
  for insert with check (auth.uid() = user_id);
create policy "journal_update_propre" on public.journal
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal_delete_propre" on public.journal
  for delete using (auth.uid() = user_id);

create policy "test_log_select_propre" on public.test_log
  for select using (auth.uid() = user_id);
create policy "test_log_insert_propre" on public.test_log
  for insert with check (auth.uid() = user_id);
create policy "test_log_update_propre" on public.test_log
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "test_log_delete_propre" on public.test_log
  for delete using (auth.uid() = user_id);

-- Aucun accès anonyme : aucune policy "anon" n'existe, c'est voulu.
