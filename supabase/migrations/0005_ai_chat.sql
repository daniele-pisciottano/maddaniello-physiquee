-- ============================================================
-- Maddaniello's Physique — Schema v5 (chat companion + corrections)
-- Richiede 0001..0004 già applicate.
-- ============================================================

-- chat_messages ----------------------------------------------
-- Persistenza dello storico conversazione col companion.
-- system messages NON sono salvati qui: vengono ricostruiti
-- freschi ad ogni call (profilo+meal+regole cambiano continuamente).
create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  -- Metadati AI (null per role='user')
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd_cents integer
);
create index if not exists chat_messages_user_idx
  on chat_messages(user_id, created_at);

-- learned_corrections ----------------------------------------
-- Regole/correzioni che l'utente ha dato in chat. Iniettate
-- nel prompt per migliorare le future risposte.
do $$ begin
  create type correction_scope as enum ('food', 'behavior', 'rule');
exception when duplicate_object then null; end $$;

create table if not exists learned_corrections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope correction_scope not null,
  content text not null,
  source_message_id uuid references chat_messages(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists learned_corrections_user_idx
  on learned_corrections(user_id, active);

-- RLS --------------------------------------------------------
alter table chat_messages enable row level security;
alter table learned_corrections enable row level security;

-- chat_messages: full user-own (server usa service_role per insert assistant)
drop policy if exists chat_messages_select_own on chat_messages;
create policy chat_messages_select_own on chat_messages
  for select using (auth.uid() = user_id);
drop policy if exists chat_messages_insert_own on chat_messages;
create policy chat_messages_insert_own on chat_messages
  for insert with check (auth.uid() = user_id);
drop policy if exists chat_messages_delete_own on chat_messages;
create policy chat_messages_delete_own on chat_messages
  for delete using (auth.uid() = user_id);

drop policy if exists learned_corrections_select_own on learned_corrections;
create policy learned_corrections_select_own on learned_corrections
  for select using (auth.uid() = user_id);
drop policy if exists learned_corrections_insert_own on learned_corrections;
create policy learned_corrections_insert_own on learned_corrections
  for insert with check (auth.uid() = user_id);
drop policy if exists learned_corrections_update_own on learned_corrections;
create policy learned_corrections_update_own on learned_corrections
  for update using (auth.uid() = user_id);
drop policy if exists learned_corrections_delete_own on learned_corrections;
create policy learned_corrections_delete_own on learned_corrections
  for delete using (auth.uid() = user_id);

-- ============================================================
-- FINE v5. Prossime migration:
--   0006_knowledge_rag.sql — pgvector, knowledge_docs, knowledge_chunks
--   0007_training.sql — workouts, sleep_entries, supplements
--   0008_phases.sql — phases, phase_reviews
-- ============================================================
