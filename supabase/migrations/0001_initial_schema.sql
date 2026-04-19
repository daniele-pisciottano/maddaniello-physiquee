-- ============================================================
-- Maddaniello's Physique — Schema v1 (Fase 0 + base Fase 1)
-- Esegui in: Supabase → SQL Editor → New query → incolla → Run
-- ============================================================

-- Extensions ---------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
-- pgvector verrà attivato in Fase 7 (RAG knowledge base):
-- create extension if not exists "vector";

-- Enums --------------------------------------------------------
do $$ begin
  create type sex_enum as enum ('male','female','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_level as enum ('sedentary','light','moderate','high','athlete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_type as enum ('cut','bulk','recomp','maintain');
exception when duplicate_object then null; end $$;

-- Profile ------------------------------------------------------
create table if not exists profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sex sex_enum,
  birth_date date,
  height_cm numeric(5,2),
  activity_level activity_level default 'moderate',
  goal_type goal_type,
  goal_weight_kg numeric(5,2),
  goal_body_fat_pct numeric(4,2),
  goal_deadline date,
  dietary_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Measurements -------------------------------------------------
create table if not exists measurements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg numeric(5,2),
  body_fat_pct numeric(4,2),
  circumferences jsonb not null default '{}'::jsonb,
  -- Shape consigliata per circumferences:
  -- { "waist_cm": 82, "chest_cm": 104, "hips_cm": 98, "arm_cm": 38, "thigh_cm": 58, "neck_cm": 38 }
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists measurements_user_date_idx
  on measurements(user_id, measured_at desc);

-- Trigger: updated_at su profile ------------------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profile_touch_updated_at on profile;
create trigger profile_touch_updated_at
  before update on profile
  for each row execute function public.touch_updated_at();

-- Trigger: crea profile automaticamente alla registrazione ----
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security ------------------------------------------
alter table profile enable row level security;
alter table measurements enable row level security;

-- profile policies
drop policy if exists "profile_select_own" on profile;
create policy "profile_select_own" on profile
  for select using (auth.uid() = user_id);

drop policy if exists "profile_insert_own" on profile;
create policy "profile_insert_own" on profile
  for insert with check (auth.uid() = user_id);

drop policy if exists "profile_update_own" on profile;
create policy "profile_update_own" on profile
  for update using (auth.uid() = user_id);

-- measurements policies
drop policy if exists "measurements_select_own" on measurements;
create policy "measurements_select_own" on measurements
  for select using (auth.uid() = user_id);

drop policy if exists "measurements_insert_own" on measurements;
create policy "measurements_insert_own" on measurements
  for insert with check (auth.uid() = user_id);

drop policy if exists "measurements_update_own" on measurements;
create policy "measurements_update_own" on measurements
  for update using (auth.uid() = user_id);

drop policy if exists "measurements_delete_own" on measurements;
create policy "measurements_delete_own" on measurements
  for delete using (auth.uid() = user_id);

-- ============================================================
-- FINE v1. Prossime migration (non applicare ora):
--   0002_food_and_meals.sql  — foods, recipes, meal_entries, dietary_rules
--   0003_training_sleep.sql  — workouts, sleep_entries, supplements
--   0004_ai_memory.sql       — api_credentials, system_prompts,
--                              learned_corrections, ai_usage_daily, chat
--   0005_knowledge_rag.sql   — pgvector, knowledge_docs, knowledge_chunks
--   0006_phases.sql          — phases, phase_reviews
-- ============================================================
