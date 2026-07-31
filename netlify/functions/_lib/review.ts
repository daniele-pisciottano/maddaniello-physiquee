// Compute metriche per una review bisettimanale:
// - avg kcal/macro giornalieri sui giorni con dati
// - adherence % (giorni entro ±10% del target)
// - delta peso + body fat
// - snapshot dei target correnti

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadTrainingSets } from './coach/training-data'
import { analyzeTraining } from './coach/training-rules'

export type ReviewMetrics = {
  period_start: string
  period_end: string
  days_with_data: number
  avg_kcal: number | null
  avg_protein_g: number | null
  avg_carb_g: number | null
  avg_fat_g: number | null
  adherence_pct_kcal: number | null
  adherence_pct_protein: number | null
  weight_start: number | null
  weight_end: number | null
  weight_delta: number | null
  body_fat_start: number | null
  body_fat_end: number | null
  target_kcal_at_review: number | null
  target_protein_at_review: number | null
  target_carb_at_review: number | null
  target_fat_at_review: number | null
  goal_type_at_review: string | null
  goal_weight_kg: number | null
  daily_samples: Array<{
    date: string
    kcal: number
    protein_g: number
    carb_g: number
    fat_g: number
  }>
  // Allenamento nel periodo: senza questo la review non può distinguere
  // uno stallo da deficit sbagliato da uno stallo da stimolo insufficiente.
  training: {
    sessions: number
    sessions_per_week: number
    total_volume_kg: number
    weekly_sets_by_muscle: Array<{ muscle: string; setsPerWeek: number }>
    findings: string[]
  } | null
}

export async function computeReviewMetrics(
  supabase: SupabaseClient,
  userId: string,
  daysBack: number = 14,
): Promise<ReviewMetrics> {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (daysBack - 1))
  start.setHours(0, 0, 0, 0)

  const startIso = start.toISOString()
  const endIsoEnd = new Date(end)
  endIsoEnd.setHours(23, 59, 59, 999)

  // Meals nel periodo
  const { data: meals } = await supabase
    .from('meal_entries')
    .select('eaten_at, kcal, protein_g, carb_g, fat_g')
    .eq('user_id', userId)
    .gte('eaten_at', startIso)
    .lte('eaten_at', endIsoEnd.toISOString())

  // Aggrega per giorno
  const dayMap = new Map<
    string,
    { kcal: number; p: number; c: number; f: number }
  >()
  for (const m of (meals ?? []) as Array<{
    eaten_at: string
    kcal: number
    protein_g: number
    carb_g: number
    fat_g: number
  }>) {
    const day = m.eaten_at.slice(0, 10)
    if (!dayMap.has(day)) dayMap.set(day, { kcal: 0, p: 0, c: 0, f: 0 })
    const agg = dayMap.get(day)!
    agg.kcal += Number(m.kcal) || 0
    agg.p += Number(m.protein_g) || 0
    agg.c += Number(m.carb_g) || 0
    agg.f += Number(m.fat_g) || 0
  }

  const daysWithData = dayMap.size
  const totals = Array.from(dayMap.values()).reduce(
    (a, d) => ({
      kcal: a.kcal + d.kcal,
      p: a.p + d.p,
      c: a.c + d.c,
      f: a.f + d.f,
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  )
  const divBy = daysWithData || 1
  const avgKcal = daysWithData > 0 ? round2(totals.kcal / divBy) : null
  const avgP = daysWithData > 0 ? round2(totals.p / divBy) : null
  const avgC = daysWithData > 0 ? round2(totals.c / divBy) : null
  const avgF = daysWithData > 0 ? round2(totals.f / divBy) : null

  // Profilo (target + goal)
  const { data: profile } = await supabase
    .from('profile')
    .select(
      'target_kcal, target_protein_g, target_carb_g, target_fat_g, goal_type, goal_weight_kg',
    )
    .eq('user_id', userId)
    .maybeSingle()

  const targetKcal = profile?.target_kcal ?? null
  const targetP = profile?.target_protein_g ?? null
  const targetC = profile?.target_carb_g ?? null
  const targetF = profile?.target_fat_g ?? null

  // Adherence: % giorni entro ±10% del target
  const adherenceKcal = targetKcal
    ? round2(adherence(dayMap, 'kcal', targetKcal))
    : null
  const adherenceP = targetP ? round2(adherence(dayMap, 'p', targetP)) : null

  // Weight: prima misura >= period_start, ultima misura totale
  const periodStartDate = start.toISOString().slice(0, 10)
  const { data: startMeas } = await supabase
    .from('measurements')
    .select('measured_at, weight_kg, body_fat_pct')
    .eq('user_id', userId)
    .gte('measured_at', periodStartDate)
    .order('measured_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Se non c'è misura dentro il periodo, prendi la più recente PRIMA del periodo
  const { data: prePeriodMeas } = !startMeas
    ? await supabase
        .from('measurements')
        .select('measured_at, weight_kg, body_fat_pct')
        .eq('user_id', userId)
        .lt('measured_at', periodStartDate)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const { data: endMeas } = await supabase
    .from('measurements')
    .select('measured_at, weight_kg, body_fat_pct')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const effectiveStartMeas = startMeas ?? prePeriodMeas
  const weightStart =
    effectiveStartMeas?.weight_kg != null
      ? Number(effectiveStartMeas.weight_kg)
      : null
  const weightEnd =
    endMeas?.weight_kg != null ? Number(endMeas.weight_kg) : null
  const weightDelta =
    weightStart != null && weightEnd != null
      ? round2(weightEnd - weightStart)
      : null
  const bfStart =
    effectiveStartMeas?.body_fat_pct != null
      ? Number(effectiveStartMeas.body_fat_pct)
      : null
  const bfEnd =
    endMeas?.body_fat_pct != null ? Number(endMeas.body_fat_pct) : null

  const dailySamples = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      kcal: round2(d.kcal),
      protein_g: round2(d.p),
      carb_g: round2(d.c),
      fat_g: round2(d.f),
    }))

  return {
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
    days_with_data: daysWithData,
    avg_kcal: avgKcal,
    avg_protein_g: avgP,
    avg_carb_g: avgC,
    avg_fat_g: avgF,
    adherence_pct_kcal: adherenceKcal,
    adherence_pct_protein: adherenceP,
    weight_start: weightStart,
    weight_end: weightEnd,
    weight_delta: weightDelta,
    body_fat_start: bfStart,
    body_fat_end: bfEnd,
    target_kcal_at_review: targetKcal,
    target_protein_at_review: targetP,
    target_carb_at_review: targetC,
    target_fat_at_review: targetF,
    goal_type_at_review: profile?.goal_type ?? null,
    goal_weight_kg:
      profile?.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null,
    daily_samples: dailySamples,
    training: await computeTrainingMetrics(supabase, userId, daysBack),
  }
}

async function computeTrainingMetrics(
  supabase: SupabaseClient,
  userId: string,
  daysBack: number,
): Promise<ReviewMetrics['training']> {
  const weeks = Math.max(1, daysBack / 7)
  const { sets, sessions } = await loadTrainingSets(supabase, userId, weeks)
  if (sessions.length === 0) return null

  const analysis = analyzeTraining(sets, weeks, sessions.length)
  return {
    sessions: sessions.length,
    sessions_per_week: analysis.sessionsPerWeek,
    total_volume_kg: round2(
      sessions.reduce((s, x) => s + Number(x.total_volume_kg ?? 0), 0),
    ),
    weekly_sets_by_muscle: analysis.weeklySetsByMuscle,
    findings: analysis.findings.map((f) => f.message),
  }
}

function adherence(
  dayMap: Map<string, { kcal: number; p: number; c: number; f: number }>,
  key: 'kcal' | 'p' | 'c' | 'f',
  target: number,
): number {
  if (!target || dayMap.size === 0) return 0
  let hits = 0
  for (const day of dayMap.values()) {
    const diff = Math.abs(day[key] - target) / target
    if (diff <= 0.1) hits++
  }
  return (hits / dayMap.size) * 100
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
