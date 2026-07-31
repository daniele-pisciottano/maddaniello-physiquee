-- ============================================================
-- Maddaniello's Physique — Schema v12 (workout tracking stile Hevy)
-- Richiede 0001..0011 già applicate.
--
-- Modello:
--   exercise_catalog   libreria esercizi (globali + custom utente)
--                      con metadati biomeccanici (Project Exercise / Roncari)
--   routine_folders    "programma" / mesociclo (raggruppa più schede)
--   routines           una scheda = una seduta tipo (es. "Push A")
--   routine_exercises  esercizi di una scheda (+ superset, rest, target)
--   routine_sets       target per singola serie (reps/peso/RPE)
--   workout_sessions   sessione eseguita (log reale)
--   session_exercises  esercizi eseguiti nella sessione
--   session_sets       serie eseguite (peso, reps, RPE, tipo serie)
--   personal_records   PR per esercizio (1RM stimato, peso max, volume max)
--
-- La tabella `workouts` (v7) resta il registro "generico" usato da Home,
-- Trends e dal contesto AI per il bilancio calorico: completando una
-- sessione strutturata viene creata/aggiornata la riga `workouts`
-- collegata via `session_id`, così tutto il resto dell'app continua a
-- funzionare senza modifiche.
-- ============================================================

-- Enums ------------------------------------------------------
do $$ begin
  create type exercise_tracking_type as enum (
    'weight_reps',    -- peso × ripetizioni (default)
    'reps_only',      -- corpo libero a ripetizioni
    'weighted_bw',    -- corpo libero + zavorra
    'duration',       -- isometrie / plank
    'distance_time',  -- cardio
    'weight_duration' -- es. farmer walk a tempo
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type set_type as enum (
    'normal',
    'warmup',
    'drop',
    'failure',
    'backoff',
    'amrap'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status as enum ('in_progress', 'completed', 'discarded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pr_type as enum (
    'est_1rm',        -- massimale stimato (Epley)
    'max_weight',     -- carico massimo sollevato
    'max_reps',       -- reps massime (a qualsiasi carico)
    'max_set_volume', -- peso × reps massimo su singola serie
    'max_session_volume'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- exercise_catalog
-- user_id null  = esercizio globale (seed, vedi 0013)
-- user_id set   = esercizio custom dell'utente
-- ============================================================
create table if not exists exercise_catalog (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  aliases text[] not null default '{}',
  -- Classificazione
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null default 'other',
  -- Pattern motorio: squat, hinge, lunge, push_h, push_v, pull_h, pull_v,
  -- carry, core_anti_ext, core_flex, core_anti_lat, isolation, cardio
  movement_pattern text,
  -- Piano prevalente: sagittal | frontal | transverse
  plane text,
  -- multi = multiarticolare, mono = monoarticolare
  joint_type text not null default 'multi',
  is_unilateral boolean not null default false,
  tracking_type exercise_tracking_type not null default 'weight_reps',
  -- Metadati biomeccanici (Project Exercise Vol.2 — Roncari)
  -- Servono all'AI per ragionare su selezione, tecnica e sicurezza.
  biomech_notes text,
  cues text[] not null default '{}',
  common_errors jsonb not null default '[]'::jsonb,
  -- [{ "error": "...", "cause": "...", "fix": "..." }]
  contraindications text,
  -- Quanto l'esercizio è "didattico"/prioritario in una scheda: 1 = base
  -- fondamentale, 2 = complementare, 3 = accessorio/finisher
  tier smallint not null default 2 check (tier between 1 and 3),
  -- Sconsigliato dalla letteratura del libro (es. sit-up piedi bloccati,
  -- side bending, torsioni sotto carico). L'AI lo segnala.
  discouraged boolean not null default false,
  discouraged_reason text,
  default_rest_sec integer,
  video_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercise_catalog_user_idx
  on exercise_catalog(user_id, archived);
create index if not exists exercise_catalog_muscle_idx
  on exercise_catalog(primary_muscle);
create index if not exists exercise_catalog_pattern_idx
  on exercise_catalog(movement_pattern);
-- Ricerca per nome/alias (usata dal picker esercizi)
create index if not exists exercise_catalog_name_trgm_idx
  on exercise_catalog using gin (to_tsvector('simple', name));
-- Un utente non può avere due esercizi custom con lo stesso nome
create unique index if not exists exercise_catalog_user_name_unique
  on exercise_catalog(user_id, lower(name)) where user_id is not null;
create unique index if not exists exercise_catalog_global_name_unique
  on exercise_catalog(lower(name)) where user_id is null;

-- ============================================================
-- routine_folders — un "programma" (mesociclo / split)
-- ============================================================
create table if not exists routine_folders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  -- Obiettivo del blocco: hypertrophy | strength | reset | cut | maintain
  goal text,
  days_per_week smallint check (days_per_week between 1 and 7),
  -- Durata pianificata del mesociclo
  weeks_planned smallint,
  starts_on date,
  -- 'user' | 'ai' — se generato dal coach AI
  source text not null default 'user',
  ai_rationale text,
  position integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routine_folders_user_idx
  on routine_folders(user_id, archived, position);

-- ============================================================
-- routines — una scheda / seduta tipo
-- ============================================================
create table if not exists routines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references routine_folders(id) on delete set null,
  name text not null,
  description text,
  notes text,
  -- Giorno suggerito della settimana (0=lun … 6=dom), null = libero
  weekday smallint check (weekday between 0 and 6),
  position integer not null default 0,
  source text not null default 'user',
  ai_rationale text,
  archived boolean not null default false,
  last_performed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routines_user_idx
  on routines(user_id, archived, position);
create index if not exists routines_folder_idx
  on routines(folder_id, position);

-- ============================================================
-- routine_exercises
-- ============================================================
create table if not exists routine_exercises (
  id uuid primary key default uuid_generate_v4(),
  routine_id uuid not null references routines(id) on delete cascade,
  exercise_id uuid not null references exercise_catalog(id) on delete restrict,
  position integer not null default 0,
  -- Esercizi con lo stesso superset_group vanno eseguiti in superserie
  superset_group smallint,
  target_sets smallint not null default 3 check (target_sets between 1 and 20),
  rep_min smallint,
  rep_max smallint,
  target_rpe numeric(3, 1) check (target_rpe between 1 and 10),
  rest_sec integer,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists routine_exercises_routine_idx
  on routine_exercises(routine_id, position);
create index if not exists routine_exercises_exercise_idx
  on routine_exercises(exercise_id);

-- ============================================================
-- routine_sets — target per singola serie (opzionale)
-- Se assente, si usano target_sets + rep_min/rep_max di routine_exercises.
-- ============================================================
create table if not exists routine_sets (
  id uuid primary key default uuid_generate_v4(),
  routine_exercise_id uuid not null
    references routine_exercises(id) on delete cascade,
  position integer not null default 0,
  set_type set_type not null default 'normal',
  target_reps smallint,
  target_weight_kg numeric(6, 2),
  target_rpe numeric(3, 1),
  target_duration_sec integer,
  created_at timestamptz not null default now()
);
create index if not exists routine_sets_re_idx
  on routine_sets(routine_exercise_id, position);

-- ============================================================
-- workout_sessions — la sessione realmente eseguita
-- ============================================================
create table if not exists workout_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid references routines(id) on delete set null,
  name text not null,
  status session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec integer,
  notes text,
  -- RPE percepito della seduta (1-10)
  session_rpe numeric(3, 1) check (session_rpe between 1 and 10),
  -- Aggregati denormalizzati, ricalcolati dal trigger sui set
  total_volume_kg numeric(10, 2) not null default 0,
  total_sets smallint not null default 0,
  total_reps integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_sessions_user_idx
  on workout_sessions(user_id, started_at desc);
create index if not exists workout_sessions_status_idx
  on workout_sessions(user_id, status);
create index if not exists workout_sessions_routine_idx
  on workout_sessions(routine_id, started_at desc);

-- Al massimo una sessione in corso per utente
create unique index if not exists workout_sessions_one_active
  on workout_sessions(user_id) where status = 'in_progress';

-- ============================================================
-- session_exercises
-- ============================================================
create table if not exists session_exercises (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid not null references exercise_catalog(id) on delete restrict,
  position integer not null default 0,
  superset_group smallint,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists session_exercises_session_idx
  on session_exercises(session_id, position);
-- Indice per la cronologia per esercizio (grafici, "ultima volta", PR)
create index if not exists session_exercises_exercise_idx
  on session_exercises(exercise_id);

-- ============================================================
-- session_sets — la riga più scritta dell'app
-- ============================================================
create table if not exists session_sets (
  id uuid primary key default uuid_generate_v4(),
  session_exercise_id uuid not null
    references session_exercises(id) on delete cascade,
  position integer not null default 0,
  set_type set_type not null default 'normal',
  weight_kg numeric(6, 2),
  reps smallint check (reps >= 0),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  rir smallint check (rir between 0 and 10),
  duration_sec integer,
  distance_m numeric(8, 2),
  completed boolean not null default true,
  is_pr boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists session_sets_se_idx
  on session_sets(session_exercise_id, position);

-- ============================================================
-- personal_records
-- ============================================================
create table if not exists personal_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercise_catalog(id) on delete cascade,
  record_type pr_type not null,
  value numeric(10, 2) not null,
  weight_kg numeric(6, 2),
  reps smallint,
  achieved_at timestamptz not null default now(),
  session_set_id uuid references session_sets(id) on delete set null,
  session_id uuid references workout_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists personal_records_user_ex_idx
  on personal_records(user_id, exercise_id, record_type, achieved_at desc);

-- ============================================================
-- Collegamento con la tabella workouts (v7): una sessione completata
-- genera/aggiorna la riga `workouts` usata da Home/Trends/contesto AI.
-- ============================================================
alter table workouts
  add column if not exists session_id uuid
    references workout_sessions(id) on delete cascade;
-- Indice NON parziale: Postgres ammette più NULL in un unique index, e
-- un indice parziale non sarebbe inferibile da ON CONFLICT (session_id)
-- che è come l'app fa l'upsert al termine della sessione.
create unique index if not exists workouts_session_unique
  on workouts(session_id);

-- ============================================================
-- Trigger: ricalcolo aggregati sessione a ogni modifica dei set
-- Evita di doverli calcolare a runtime in query di lista.
-- ============================================================
create or replace function public.recalc_session_totals_for(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update workout_sessions s
  set total_volume_kg = coalesce(agg.volume, 0),
      total_sets = coalesce(agg.sets, 0),
      total_reps = coalesce(agg.reps, 0)
  from (
    -- "Volume allenante": il riscaldamento è escluso da tutti e tre gli
    -- aggregati, coerentemente con quanto mostra il logger durante la
    -- sessione e con il conteggio delle serie settimanali.
    select
      sum(coalesce(ss.weight_kg, 0) * coalesce(ss.reps, 0)) as volume,
      count(*) as sets,
      sum(coalesce(ss.reps, 0)) as reps
    from session_sets ss
    join session_exercises se on se.id = ss.session_exercise_id
    where se.session_id = p_session_id
      and ss.completed
      and ss.set_type <> 'warmup'
  ) agg
  where s.id = p_session_id;
$$;

create or replace function public.recalc_session_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_se_id uuid;
begin
  -- Su DELETE la riga NEW non esiste: TG_OP evita di dereferenziarla.
  if tg_op = 'DELETE' then
    v_se_id := old.session_exercise_id;
  else
    v_se_id := new.session_exercise_id;
  end if;

  select session_id into v_session_id
  from session_exercises where id = v_se_id;

  if v_session_id is not null then
    perform public.recalc_session_totals_for(v_session_id);
  end if;

  -- Trigger AFTER: il valore di ritorno viene ignorato.
  return null;
end;
$$;

drop trigger if exists session_sets_recalc on session_sets;
create trigger session_sets_recalc
  after insert or update or delete on session_sets
  for each row execute function public.recalc_session_totals();

-- Rimuovendo un esercizio, i suoi set spariscono in cascata: a quel punto
-- la riga padre non esiste più e il trigger sui set non saprebbe a quale
-- sessione appartenessero. Senza questo, i totali resterebbero gonfiati.
create or replace function public.recalc_on_exercise_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_session_totals_for(old.session_id);
  return null;
end;
$$;

drop trigger if exists session_exercises_recalc on session_exercises;
create trigger session_exercises_recalc
  after delete on session_exercises
  for each row execute function public.recalc_on_exercise_delete();

-- ============================================================
-- Trigger updated_at
-- ============================================================
drop trigger if exists exercise_catalog_touch on exercise_catalog;
create trigger exercise_catalog_touch before update on exercise_catalog
  for each row execute function public.touch_updated_at();

drop trigger if exists routine_folders_touch on routine_folders;
create trigger routine_folders_touch before update on routine_folders
  for each row execute function public.touch_updated_at();

drop trigger if exists routines_touch on routines;
create trigger routines_touch before update on routines
  for each row execute function public.touch_updated_at();

drop trigger if exists workout_sessions_touch on workout_sessions;
create trigger workout_sessions_touch before update on workout_sessions
  for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table exercise_catalog enable row level security;
alter table routine_folders enable row level security;
alter table routines enable row level security;
alter table routine_exercises enable row level security;
alter table routine_sets enable row level security;
alter table workout_sessions enable row level security;
alter table session_exercises enable row level security;
alter table session_sets enable row level security;
alter table personal_records enable row level security;

-- exercise_catalog: leggi globali + tuoi, scrivi solo i tuoi
drop policy if exists exercise_catalog_select on exercise_catalog;
create policy exercise_catalog_select on exercise_catalog
  for select using (user_id is null or user_id = auth.uid());
drop policy if exists exercise_catalog_insert_own on exercise_catalog;
create policy exercise_catalog_insert_own on exercise_catalog
  for insert with check (user_id = auth.uid());
drop policy if exists exercise_catalog_update_own on exercise_catalog;
create policy exercise_catalog_update_own on exercise_catalog
  for update using (user_id = auth.uid());
drop policy if exists exercise_catalog_delete_own on exercise_catalog;
create policy exercise_catalog_delete_own on exercise_catalog
  for delete using (user_id = auth.uid());

-- routine_folders / routines / workout_sessions / personal_records:
-- ownership diretta
drop policy if exists routine_folders_all_own on routine_folders;
create policy routine_folders_all_own on routine_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists routines_all_own on routines;
create policy routines_all_own on routines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists workout_sessions_all_own on workout_sessions;
create policy workout_sessions_all_own on workout_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists personal_records_all_own on personal_records;
create policy personal_records_all_own on personal_records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tabelle figlie: ownership via parent
drop policy if exists routine_exercises_all_own on routine_exercises;
create policy routine_exercises_all_own on routine_exercises
  for all using (
    exists (
      select 1 from routines r
      where r.id = routine_exercises.routine_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from routines r
      where r.id = routine_exercises.routine_id and r.user_id = auth.uid()
    )
  );

drop policy if exists routine_sets_all_own on routine_sets;
create policy routine_sets_all_own on routine_sets
  for all using (
    exists (
      select 1 from routine_exercises re
      join routines r on r.id = re.routine_id
      where re.id = routine_sets.routine_exercise_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from routine_exercises re
      join routines r on r.id = re.routine_id
      where re.id = routine_sets.routine_exercise_id and r.user_id = auth.uid()
    )
  );

drop policy if exists session_exercises_all_own on session_exercises;
create policy session_exercises_all_own on session_exercises
  for all using (
    exists (
      select 1 from workout_sessions s
      where s.id = session_exercises.session_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from workout_sessions s
      where s.id = session_exercises.session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists session_sets_all_own on session_sets;
create policy session_sets_all_own on session_sets
  for all using (
    exists (
      select 1 from session_exercises se
      join workout_sessions s on s.id = se.session_id
      where se.id = session_sets.session_exercise_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from session_exercises se
      join workout_sessions s on s.id = se.session_id
      where se.id = session_sets.session_exercise_id and s.user_id = auth.uid()
    )
  );

-- ============================================================
-- RPC: statistiche per esercizio (grafico progressione + best set)
-- Epley: 1RM ≈ peso × (1 + reps/30)
-- ============================================================
create or replace function exercise_history(
  p_exercise_id uuid,
  p_limit int default 50
) returns table (
  session_id uuid,
  performed_at timestamptz,
  session_name text,
  best_weight_kg numeric,
  best_reps smallint,
  est_1rm numeric,
  total_volume_kg numeric,
  work_sets integer
)
language sql
stable
security invoker
as $$
  select
    s.id,
    s.started_at,
    s.name,
    max(ss.weight_kg) as best_weight_kg,
    max(ss.reps) as best_reps,
    round(max(coalesce(ss.weight_kg, 0) * (1 + coalesce(ss.reps, 0) / 30.0)), 1)
      as est_1rm,
    sum(coalesce(ss.weight_kg, 0) * coalesce(ss.reps, 0)) as total_volume_kg,
    count(*)::int as work_sets
  from workout_sessions s
  join session_exercises se on se.session_id = s.id
  join session_sets ss on ss.session_exercise_id = se.id
  where se.exercise_id = p_exercise_id
    and s.user_id = auth.uid()
    and s.status = 'completed'
    and ss.completed
    and ss.set_type <> 'warmup'
  group by s.id, s.started_at, s.name
  order by s.started_at desc
  limit p_limit;
$$;

-- ============================================================
-- RPC: volume settimanale per gruppo muscolare
-- Conta le serie allenanti (escluso warmup). I muscoli secondari
-- contano 0.5 serie, come da prassi nel conteggio del volume.
-- ============================================================
create or replace function weekly_muscle_volume(
  p_weeks int default 8
) returns table (
  week_start date,
  muscle text,
  sets numeric,
  volume_kg numeric
)
language sql
stable
security invoker
as $$
  with work as (
    select
      date_trunc('week', s.started_at)::date as week_start,
      ec.primary_muscle,
      ec.secondary_muscles,
      coalesce(ss.weight_kg, 0) * coalesce(ss.reps, 0) as vol
    from workout_sessions s
    join session_exercises se on se.session_id = s.id
    join session_sets ss on ss.session_exercise_id = se.id
    join exercise_catalog ec on ec.id = se.exercise_id
    where s.user_id = auth.uid()
      and s.status = 'completed'
      and ss.completed
      and ss.set_type <> 'warmup'
      and s.started_at >= date_trunc('week', now()) - (p_weeks || ' weeks')::interval
  ),
  expanded as (
    select week_start, primary_muscle as muscle, 1.0 as w, vol from work
    union all
    select week_start, unnest(secondary_muscles) as muscle, 0.5 as w, vol from work
  )
  select week_start, muscle, sum(w) as sets, sum(vol * w) as volume_kg
  from expanded
  group by week_start, muscle
  order by week_start desc, sets desc;
$$;

-- ============================================================
-- RPC: ultima prestazione per ogni esercizio di una scheda
-- Alimenta il precompilamento "come l'ultima volta" nel logger.
-- ============================================================
create or replace function last_performance(p_exercise_ids uuid[])
returns table (
  exercise_id uuid,
  performed_at timestamptz,
  sets jsonb
)
language sql
stable
security invoker
as $$
  with ranked as (
    select
      se.exercise_id,
      s.started_at,
      s.id as session_id,
      row_number() over (
        partition by se.exercise_id order by s.started_at desc
      ) as rn
    from workout_sessions s
    join session_exercises se on se.session_id = s.id
    where s.user_id = auth.uid()
      and s.status = 'completed'
      and se.exercise_id = any(p_exercise_ids)
    group by se.exercise_id, s.started_at, s.id
  )
  select
    r.exercise_id,
    r.started_at,
    jsonb_agg(
      jsonb_build_object(
        'position', ss.position,
        'set_type', ss.set_type,
        'weight_kg', ss.weight_kg,
        'reps', ss.reps,
        'rpe', ss.rpe
      ) order by ss.position
    ) as sets
  from ranked r
  join session_exercises se
    on se.session_id = r.session_id and se.exercise_id = r.exercise_id
  join session_sets ss on ss.session_exercise_id = se.id
  where r.rn = 1 and ss.completed
  group by r.exercise_id, r.started_at;
$$;

-- ============================================================
-- FINE v12. Prossima migration:
--   0013_exercise_seed.sql — libreria esercizi con metadati biomeccanici
-- ============================================================
