-- ============================================================
-- Maddaniello's Physique — Schema v6 (phase reviews bisettimanali)
-- Richiede 0001..0005 già applicate.
-- ============================================================

-- phase_reviews ----------------------------------------------
-- Review periodica (default bisettimanale) che valuta aderenza ai
-- target e trend peso, con suggerimento AI di aggiustamenti.
create table if not exists phase_reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  period_start date not null,
  period_end date not null,
  auto boolean not null default false,

  -- Metriche del periodo (calcolate lato server al momento della review)
  days_with_data integer not null default 0,
  avg_kcal numeric(7, 2),
  avg_protein_g numeric(6, 2),
  avg_carb_g numeric(6, 2),
  avg_fat_g numeric(6, 2),
  adherence_pct_kcal numeric(5, 2),
  adherence_pct_protein numeric(5, 2),
  weight_start numeric(5, 2),
  weight_end numeric(5, 2),
  weight_delta numeric(5, 2),
  body_fat_start numeric(4, 2),
  body_fat_end numeric(4, 2),

  -- Snapshot dei target al momento della review
  target_kcal_at_review integer,
  target_protein_at_review integer,
  target_carb_at_review integer,
  target_fat_at_review integer,
  goal_type_at_review text,

  -- AI suggestion (JSON strutturato) + reasoning testuale (markdown)
  ai_suggestion jsonb,
  ai_reasoning text,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd_cents integer,

  -- Status
  applied boolean not null default false,
  applied_at timestamptz,
  dismissed boolean not null default false,

  created_at timestamptz not null default now()
);
create index if not exists phase_reviews_user_idx
  on phase_reviews(user_id, reviewed_at desc);

-- RLS --------------------------------------------------------
alter table phase_reviews enable row level security;

drop policy if exists phase_reviews_select_own on phase_reviews;
create policy phase_reviews_select_own on phase_reviews
  for select using (auth.uid() = user_id);

drop policy if exists phase_reviews_insert_own on phase_reviews;
create policy phase_reviews_insert_own on phase_reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists phase_reviews_update_own on phase_reviews;
create policy phase_reviews_update_own on phase_reviews
  for update using (auth.uid() = user_id);

drop policy if exists phase_reviews_delete_own on phase_reviews;
create policy phase_reviews_delete_own on phase_reviews
  for delete using (auth.uid() = user_id);

-- ============================================================
-- FINE v6. Prossime migration:
--   0007_training.sql — workouts, sleep_entries, supplements
--   0008_knowledge_rag.sql — pgvector, knowledge_docs, knowledge_chunks
-- ============================================================
