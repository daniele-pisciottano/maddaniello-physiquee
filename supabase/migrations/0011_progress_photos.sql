-- ============================================================
-- Maddaniello's Physique — Schema v11 (foto progressi + Vision AI)
-- Richiede 0001..0010 già applicate.
-- ============================================================

-- progress_sessions ------------------------------------------
-- Ogni sessione può contenere 3 foto (fronte/retro/lato) + l'analisi
-- AI Vision. Le foto fisiche sono in Supabase Storage, qui teniamo
-- solo i path e i metadati + risultato dell'analisi.
create table if not exists progress_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at date not null default current_date,
  front_path text,
  back_path text,
  side_path text,
  -- AI Vision analysis
  ai_bf_estimate numeric(4, 2),
  ai_bf_confidence text, -- 'low' | 'medium' | 'high'
  ai_lean_mass_kg numeric(5, 2),
  ai_analysis text,
  ai_model text,
  ai_tokens_in integer,
  ai_tokens_out integer,
  ai_cost_usd_cents integer,
  ai_analyzed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists progress_sessions_user_idx
  on progress_sessions(user_id, taken_at desc);

drop trigger if exists progress_sessions_touch on progress_sessions;
create trigger progress_sessions_touch before update on progress_sessions
  for each row execute function public.touch_updated_at();

-- RLS --------------------------------------------------------
alter table progress_sessions enable row level security;

drop policy if exists progress_sessions_select_own on progress_sessions;
create policy progress_sessions_select_own on progress_sessions
  for select using (auth.uid() = user_id);
drop policy if exists progress_sessions_insert_own on progress_sessions;
create policy progress_sessions_insert_own on progress_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists progress_sessions_update_own on progress_sessions;
create policy progress_sessions_update_own on progress_sessions
  for update using (auth.uid() = user_id);
drop policy if exists progress_sessions_delete_own on progress_sessions;
create policy progress_sessions_delete_own on progress_sessions
  for delete using (auth.uid() = user_id);

-- Storage bucket per le foto --------------------------------
-- Private; path pattern: {user_id}/{session_id}/{orientation}.jpg
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- Policies su storage.objects
-- L'utente può inserire/leggere/eliminare solo nella propria cartella
drop policy if exists "progress_photos_insert_own" on storage.objects;
create policy "progress_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "progress_photos_select_own" on storage.objects;
create policy "progress_photos_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "progress_photos_update_own" on storage.objects;
create policy "progress_photos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'progress-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "progress_photos_delete_own" on storage.objects;
create policy "progress_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progress-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- FINE v11.
-- ============================================================
