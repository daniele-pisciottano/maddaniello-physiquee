-- ============================================================
-- Maddaniello's Physique — Schema v7 (allenamenti, sonno, integratori)
-- Richiede 0001..0006 già applicate.
-- ============================================================

-- Enums ------------------------------------------------------
do $$ begin
  create type workout_intensity as enum ('low', 'moderate', 'high');
exception when duplicate_object then null; end $$;

-- workouts ---------------------------------------------------
create table if not exists workouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  duration_min integer not null check (duration_min > 0),
  workout_type text not null,
  intensity workout_intensity,
  kcal_burned integer,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_idx
  on workouts(user_id, started_at desc);

-- sleep_entries ----------------------------------------------
-- Una riga per data del risveglio, upsert su (user_id, sleep_date).
create table if not exists sleep_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_date date not null,
  hours numeric(3, 1) not null check (hours > 0 and hours < 24),
  quality integer check (quality between 1 and 5),
  bedtime text,
  wake_time text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sleep_entries_user_date_unique
  on sleep_entries(user_id, sleep_date);

-- supplements ------------------------------------------------
create table if not exists supplements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dose numeric(8, 2),
  unit text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists supplements_user_idx
  on supplements(user_id, active);

-- supplement_log ---------------------------------------------
create table if not exists supplement_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplement_id uuid references supplements(id) on delete set null,
  supplement_name text not null,
  taken_at timestamptz not null default now(),
  dose numeric(8, 2),
  unit text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists supplement_log_user_idx
  on supplement_log(user_id, taken_at desc);

-- Triggers updated_at ---------------------------------------
drop trigger if exists sleep_entries_touch on sleep_entries;
create trigger sleep_entries_touch before update on sleep_entries
  for each row execute function public.touch_updated_at();

drop trigger if exists supplements_touch on supplements;
create trigger supplements_touch before update on supplements
  for each row execute function public.touch_updated_at();

-- RLS --------------------------------------------------------
alter table workouts enable row level security;
alter table sleep_entries enable row level security;
alter table supplements enable row level security;
alter table supplement_log enable row level security;

-- workouts: full user-own
drop policy if exists workouts_select_own on workouts;
create policy workouts_select_own on workouts for select using (auth.uid() = user_id);
drop policy if exists workouts_insert_own on workouts;
create policy workouts_insert_own on workouts for insert with check (auth.uid() = user_id);
drop policy if exists workouts_update_own on workouts;
create policy workouts_update_own on workouts for update using (auth.uid() = user_id);
drop policy if exists workouts_delete_own on workouts;
create policy workouts_delete_own on workouts for delete using (auth.uid() = user_id);

-- sleep_entries: full user-own
drop policy if exists sleep_entries_select_own on sleep_entries;
create policy sleep_entries_select_own on sleep_entries for select using (auth.uid() = user_id);
drop policy if exists sleep_entries_insert_own on sleep_entries;
create policy sleep_entries_insert_own on sleep_entries for insert with check (auth.uid() = user_id);
drop policy if exists sleep_entries_update_own on sleep_entries;
create policy sleep_entries_update_own on sleep_entries for update using (auth.uid() = user_id);
drop policy if exists sleep_entries_delete_own on sleep_entries;
create policy sleep_entries_delete_own on sleep_entries for delete using (auth.uid() = user_id);

-- supplements: full user-own
drop policy if exists supplements_select_own on supplements;
create policy supplements_select_own on supplements for select using (auth.uid() = user_id);
drop policy if exists supplements_insert_own on supplements;
create policy supplements_insert_own on supplements for insert with check (auth.uid() = user_id);
drop policy if exists supplements_update_own on supplements;
create policy supplements_update_own on supplements for update using (auth.uid() = user_id);
drop policy if exists supplements_delete_own on supplements;
create policy supplements_delete_own on supplements for delete using (auth.uid() = user_id);

-- supplement_log: full user-own
drop policy if exists supplement_log_select_own on supplement_log;
create policy supplement_log_select_own on supplement_log for select using (auth.uid() = user_id);
drop policy if exists supplement_log_insert_own on supplement_log;
create policy supplement_log_insert_own on supplement_log for insert with check (auth.uid() = user_id);
drop policy if exists supplement_log_update_own on supplement_log;
create policy supplement_log_update_own on supplement_log for update using (auth.uid() = user_id);
drop policy if exists supplement_log_delete_own on supplement_log;
create policy supplement_log_delete_own on supplement_log for delete using (auth.uid() = user_id);

-- ============================================================
-- FINE v7. Prossima migration:
--   0008_knowledge_rag.sql — pgvector + knowledge_docs + chunks
-- ============================================================
