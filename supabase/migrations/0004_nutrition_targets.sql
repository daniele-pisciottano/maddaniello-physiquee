-- ============================================================
-- Maddaniello's Physique — Schema v4 (target kcal/macro sul profilo)
-- Richiede 0001..0003 già applicate.
-- ============================================================

alter table profile
  add column if not exists target_kcal integer,
  add column if not exists target_protein_g integer,
  add column if not exists target_carb_g integer,
  add column if not exists target_fat_g integer;
