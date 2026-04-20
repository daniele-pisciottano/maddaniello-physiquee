-- ============================================================
-- Maddaniello's Physique — Schema v2 (Fase 4: AI settings)
-- Esegui in: Supabase → SQL Editor → New query → incolla → Run
-- Richiede che 0001 sia già stata applicata.
-- ============================================================

-- ai_credentials ----------------------------------------------
-- Una riga per (user, provider). encrypted_key è base64 di:
--   iv (12B) || auth_tag (16B) || ciphertext   (AES-256-GCM)
-- La master key è SOLO lato server (Netlify env MASTER_ENCRYPTION_KEY).
-- Writes passano da Netlify Functions con service_role (RLS bypassata).
create table if not exists ai_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'gemini')),
  encrypted_key text not null,
  key_last4 text not null,
  default_model text,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- ai_settings -------------------------------------------------
create table if not exists ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_provider text check (active_provider in ('openai', 'gemini')),
  monthly_budget_usd numeric(6, 2) not null default 5.00,
  updated_at timestamptz not null default now()
);

-- system_prompts ----------------------------------------------
-- Versionati. Esattamente uno attivo per utente.
create table if not exists system_prompts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version int not null,
  content text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists system_prompts_user_idx
  on system_prompts(user_id, version desc);
create unique index if not exists system_prompts_one_active
  on system_prompts(user_id) where active;

-- ai_usage_daily ----------------------------------------------
-- Scritta solo da Netlify Functions (service_role).
create table if not exists ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  provider text not null,
  model text not null,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  cost_usd_cents integer not null default 0,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date, provider, model)
);

-- Trigger: auto-crea ai_settings al signup -------------------
create or replace function public.handle_new_user_ai_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_settings(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_ai on auth.users;
create trigger on_auth_user_created_ai
  after insert on auth.users
  for each row execute function public.handle_new_user_ai_settings();

-- Backfill ai_settings per utenti già registrati
insert into ai_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Trigger touch updated_at -----------------------------------
drop trigger if exists ai_credentials_touch on ai_credentials;
create trigger ai_credentials_touch
  before update on ai_credentials
  for each row execute function public.touch_updated_at();

drop trigger if exists ai_settings_touch on ai_settings;
create trigger ai_settings_touch
  before update on ai_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists ai_usage_daily_touch on ai_usage_daily;
create trigger ai_usage_daily_touch
  before update on ai_usage_daily
  for each row execute function public.touch_updated_at();

-- RLS --------------------------------------------------------
alter table ai_credentials enable row level security;
alter table ai_settings enable row level security;
alter table system_prompts enable row level security;
alter table ai_usage_daily enable row level security;

-- ai_credentials: client può SELEZIONARE le proprie righe (blob
-- è cifrato, senza master key non si decifra). INSERT/UPDATE/DELETE
-- non hanno policy → client bloccato. Server bypassa RLS via service_role.
drop policy if exists ai_credentials_select_own on ai_credentials;
create policy ai_credentials_select_own on ai_credentials
  for select using (auth.uid() = user_id);

-- ai_settings: full user-own
drop policy if exists ai_settings_select_own on ai_settings;
create policy ai_settings_select_own on ai_settings
  for select using (auth.uid() = user_id);
drop policy if exists ai_settings_insert_own on ai_settings;
create policy ai_settings_insert_own on ai_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists ai_settings_update_own on ai_settings;
create policy ai_settings_update_own on ai_settings
  for update using (auth.uid() = user_id);

-- system_prompts: full user-own
drop policy if exists system_prompts_select_own on system_prompts;
create policy system_prompts_select_own on system_prompts
  for select using (auth.uid() = user_id);
drop policy if exists system_prompts_insert_own on system_prompts;
create policy system_prompts_insert_own on system_prompts
  for insert with check (auth.uid() = user_id);
drop policy if exists system_prompts_update_own on system_prompts;
create policy system_prompts_update_own on system_prompts
  for update using (auth.uid() = user_id);
drop policy if exists system_prompts_delete_own on system_prompts;
create policy system_prompts_delete_own on system_prompts
  for delete using (auth.uid() = user_id);

-- ai_usage_daily: solo read lato client. Server scrive via service_role.
drop policy if exists ai_usage_daily_select_own on ai_usage_daily;
create policy ai_usage_daily_select_own on ai_usage_daily
  for select using (auth.uid() = user_id);

-- ============================================================
-- FINE v2. Prossima migration:
--   0003_foods_meals.sql  — foods, recipes, meal_entries, dietary_rules
-- ============================================================
