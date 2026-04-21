-- ============================================================
-- Maddaniello's Physique — Schema v9 (piano alimentare per pasto)
-- Richiede 0001..0008 già applicate.
-- ============================================================

-- meal_plan_slots --------------------------------------------
-- Un "slot" è una posizione in un pasto con N alternative
-- intercambiabili. Es. colazione > Carbo > [avena, biscottate, cereali].
create table if not exists meal_plan_slots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_type meal_type not null,
  slot_label text not null,
  options text[] not null default '{}',
  portion_hint text,
  notes text,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meal_plan_slots_user_idx
  on meal_plan_slots(user_id, meal_type, position);

drop trigger if exists meal_plan_slots_touch on meal_plan_slots;
create trigger meal_plan_slots_touch before update on meal_plan_slots
  for each row execute function public.touch_updated_at();

-- RLS --------------------------------------------------------
alter table meal_plan_slots enable row level security;

drop policy if exists meal_plan_slots_select_own on meal_plan_slots;
create policy meal_plan_slots_select_own on meal_plan_slots
  for select using (auth.uid() = user_id);
drop policy if exists meal_plan_slots_insert_own on meal_plan_slots;
create policy meal_plan_slots_insert_own on meal_plan_slots
  for insert with check (auth.uid() = user_id);
drop policy if exists meal_plan_slots_update_own on meal_plan_slots;
create policy meal_plan_slots_update_own on meal_plan_slots
  for update using (auth.uid() = user_id);
drop policy if exists meal_plan_slots_delete_own on meal_plan_slots;
create policy meal_plan_slots_delete_own on meal_plan_slots
  for delete using (auth.uid() = user_id);

-- ============================================================
-- FINE v9.
-- ============================================================
