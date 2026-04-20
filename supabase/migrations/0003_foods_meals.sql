-- ============================================================
-- Maddaniello's Physique — Schema v3 (Fase 2: foods, recipes, meals)
-- Richiede che 0001 e 0002 siano state applicate.
-- ============================================================

-- Enums --------------------------------------------------------
do $$ begin
  create type food_source as enum ('custom', 'ai', 'off_import');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entry_source as enum ('manual', 'barcode', 'ai_chat', 'recipe');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dietary_rule_type as enum (
    'max_per_week', 'max_per_day', 'min_per_day', 'exclude', 'prefer'
  );
exception when duplicate_object then null; end $$;

-- foods -------------------------------------------------------
-- Solo alimenti custom dell'utente (con macro per 100g).
-- I dati di Open Food Facts vengono fetchati live dal client, non
-- cachati qui: se l'utente vuole un prodotto OFF come "preferito"
-- lo salva esplicitamente (source='off_import').
create table if not exists foods (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source food_source not null default 'custom',
  barcode text,
  name text not null,
  brand text,
  serving_g numeric(6, 2),
  kcal_100g numeric(6, 2) not null default 0,
  protein_100g numeric(6, 2) not null default 0,
  carb_100g numeric(6, 2) not null default 0,
  fat_100g numeric(6, 2) not null default 0,
  fiber_100g numeric(6, 2),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists foods_user_name_idx on foods(user_id, lower(name));
create unique index if not exists foods_user_barcode_unique
  on foods(user_id, barcode) where barcode is not null;

-- recipes -----------------------------------------------------
create table if not exists recipes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  servings integer not null default 1 check (servings >= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recipes_user_idx on recipes(user_id, name);

create table if not exists recipe_items (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  food_id uuid references foods(id) on delete set null,
  food_name_snapshot text not null,
  grams numeric(7, 2) not null check (grams > 0),
  kcal_snapshot numeric(7, 2) not null default 0,
  protein_snapshot numeric(6, 2) not null default 0,
  carb_snapshot numeric(6, 2) not null default 0,
  fat_snapshot numeric(6, 2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists recipe_items_recipe_idx on recipe_items(recipe_id, position);

-- meal_entries -----------------------------------------------
-- Valori nutrizionali snapshottati al momento del log: se elimini
-- il food / recipe sorgente, lo storico resta intatto.
create table if not exists meal_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type meal_type not null,
  food_id uuid references foods(id) on delete set null,
  recipe_id uuid references recipes(id) on delete set null,
  food_name text not null,
  grams numeric(7, 2),
  servings numeric(5, 2),
  kcal numeric(7, 2) not null default 0,
  protein_g numeric(6, 2) not null default 0,
  carb_g numeric(6, 2) not null default 0,
  fat_g numeric(6, 2) not null default 0,
  source entry_source not null default 'manual',
  raw_ai_text text,
  confidence numeric(3, 2),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists meal_entries_user_eaten_idx
  on meal_entries(user_id, eaten_at desc);

-- dietary_rules ----------------------------------------------
-- Regole semantiche applicate dall'AI nei suggerimenti.
create table if not exists dietary_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_type dietary_rule_type not null,
  rule_value jsonb not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists dietary_rules_user_idx
  on dietary_rules(user_id, active);

-- Triggers updated_at ---------------------------------------
drop trigger if exists foods_touch on foods;
create trigger foods_touch before update on foods
  for each row execute function public.touch_updated_at();

drop trigger if exists recipes_touch on recipes;
create trigger recipes_touch before update on recipes
  for each row execute function public.touch_updated_at();

-- RLS --------------------------------------------------------
alter table foods enable row level security;
alter table recipes enable row level security;
alter table recipe_items enable row level security;
alter table meal_entries enable row level security;
alter table dietary_rules enable row level security;

-- foods: full user-own
drop policy if exists foods_select_own on foods;
create policy foods_select_own on foods
  for select using (auth.uid() = user_id);
drop policy if exists foods_insert_own on foods;
create policy foods_insert_own on foods
  for insert with check (auth.uid() = user_id);
drop policy if exists foods_update_own on foods;
create policy foods_update_own on foods
  for update using (auth.uid() = user_id);
drop policy if exists foods_delete_own on foods;
create policy foods_delete_own on foods
  for delete using (auth.uid() = user_id);

-- recipes: full user-own
drop policy if exists recipes_select_own on recipes;
create policy recipes_select_own on recipes
  for select using (auth.uid() = user_id);
drop policy if exists recipes_insert_own on recipes;
create policy recipes_insert_own on recipes
  for insert with check (auth.uid() = user_id);
drop policy if exists recipes_update_own on recipes;
create policy recipes_update_own on recipes
  for update using (auth.uid() = user_id);
drop policy if exists recipes_delete_own on recipes;
create policy recipes_delete_own on recipes
  for delete using (auth.uid() = user_id);

-- recipe_items: accessibili se il recipe padre è dell'utente
drop policy if exists recipe_items_select on recipe_items;
create policy recipe_items_select on recipe_items
  for select using (
    exists (select 1 from recipes r where r.id = recipe_items.recipe_id and r.user_id = auth.uid())
  );
drop policy if exists recipe_items_insert on recipe_items;
create policy recipe_items_insert on recipe_items
  for insert with check (
    exists (select 1 from recipes r where r.id = recipe_items.recipe_id and r.user_id = auth.uid())
  );
drop policy if exists recipe_items_update on recipe_items;
create policy recipe_items_update on recipe_items
  for update using (
    exists (select 1 from recipes r where r.id = recipe_items.recipe_id and r.user_id = auth.uid())
  );
drop policy if exists recipe_items_delete on recipe_items;
create policy recipe_items_delete on recipe_items
  for delete using (
    exists (select 1 from recipes r where r.id = recipe_items.recipe_id and r.user_id = auth.uid())
  );

-- meal_entries: full user-own
drop policy if exists meal_entries_select_own on meal_entries;
create policy meal_entries_select_own on meal_entries
  for select using (auth.uid() = user_id);
drop policy if exists meal_entries_insert_own on meal_entries;
create policy meal_entries_insert_own on meal_entries
  for insert with check (auth.uid() = user_id);
drop policy if exists meal_entries_update_own on meal_entries;
create policy meal_entries_update_own on meal_entries
  for update using (auth.uid() = user_id);
drop policy if exists meal_entries_delete_own on meal_entries;
create policy meal_entries_delete_own on meal_entries
  for delete using (auth.uid() = user_id);

-- dietary_rules: full user-own
drop policy if exists dietary_rules_select_own on dietary_rules;
create policy dietary_rules_select_own on dietary_rules
  for select using (auth.uid() = user_id);
drop policy if exists dietary_rules_insert_own on dietary_rules;
create policy dietary_rules_insert_own on dietary_rules
  for insert with check (auth.uid() = user_id);
drop policy if exists dietary_rules_update_own on dietary_rules;
create policy dietary_rules_update_own on dietary_rules
  for update using (auth.uid() = user_id);
drop policy if exists dietary_rules_delete_own on dietary_rules;
create policy dietary_rules_delete_own on dietary_rules
  for delete using (auth.uid() = user_id);

-- ============================================================
-- FINE v3. Prossime migration:
--   0004_chat_memory.sql  — chat_messages, learned_corrections
--   0005_knowledge_rag.sql — pgvector, knowledge_docs, knowledge_chunks
--   0006_phases.sql — phases, phase_reviews
-- ============================================================
