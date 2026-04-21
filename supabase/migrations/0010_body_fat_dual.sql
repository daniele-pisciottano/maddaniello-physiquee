-- ============================================================
-- Maddaniello's Physique — Schema v10 (body fat bilancia + visuale)
-- Richiede 0001..0009 già applicate.
-- ============================================================

-- Aggiungiamo due colonne distinte per tracciare la differenza tra
-- il BF letto dalla bilancia bioimpedenziometrica (oscilla con
-- idratazione) e il BF stimato visualmente/da foto (più stabile).
-- Manteniamo body_fat_pct esistente come valore "canonico" che
-- viene aggiornato automaticamente dal client: preferisce il visuale,
-- fallback sullo scale se il visuale manca.

alter table measurements
  add column if not exists body_fat_scale_pct numeric(4, 2),
  add column if not exists body_fat_visual_pct numeric(4, 2);

-- ============================================================
-- FINE v10.
-- ============================================================
