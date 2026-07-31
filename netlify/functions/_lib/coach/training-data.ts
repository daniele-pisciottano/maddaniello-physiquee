// Caricamento del log di forza per l'analisi lato server.
// Usato dal contesto chat, dal coach allenamento e dalla review di fase.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SetRecord } from './training-rules'

export type SessionSummary = {
  id: string
  name: string
  started_at: string
  duration_sec: number | null
  total_volume_kg: number
  total_sets: number
  session_rpe: number | null
  routine_id: string | null
}

/**
 * Serie allenanti delle ultime `weeks` settimane, già appiattite con i
 * metadati dell'esercizio. Una sola query annidata invece della catena
 * sessioni → esercizi → serie.
 */
export async function loadTrainingSets(
  supabase: SupabaseClient,
  userId: string,
  weeks: number,
): Promise<{ sets: SetRecord[]; sessions: SessionSummary[] }> {
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      `id, name, started_at, duration_sec, total_volume_kg, total_sets, session_rpe, routine_id,
       session_exercises (
         exercise_id,
         exercise:exercise_catalog ( name, primary_muscle, secondary_muscles, movement_pattern, discouraged, discouraged_reason ),
         session_sets ( set_type, weight_kg, reps, rpe, completed )
       )`,
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false })

  if (error) {
    console.error('loadTrainingSets:', error.message)
    return { sets: [], sessions: [] }
  }

  const sets: SetRecord[] = []
  const sessions: SessionSummary[] = []

  for (const s of (data ?? []) as unknown as Array<
    SessionSummary & {
      session_exercises: Array<{
        exercise_id: string
        exercise: {
          name: string
          primary_muscle: string
          secondary_muscles: string[]
          movement_pattern: string | null
          discouraged: boolean
          discouraged_reason: string | null
        } | null
        session_sets: Array<{
          set_type: string
          weight_kg: number | null
          reps: number | null
          rpe: number | null
          completed: boolean
        }>
      }>
    }
  >) {
    sessions.push({
      id: s.id,
      name: s.name,
      started_at: s.started_at,
      duration_sec: s.duration_sec,
      total_volume_kg: Number(s.total_volume_kg ?? 0),
      total_sets: s.total_sets,
      session_rpe: s.session_rpe,
      routine_id: s.routine_id,
    })

    for (const se of s.session_exercises ?? []) {
      const ex = se.exercise
      if (!ex) continue
      for (const ss of se.session_sets ?? []) {
        if (!ss.completed) continue
        sets.push({
          exerciseId: se.exercise_id,
          exerciseName: ex.name,
          primaryMuscle: ex.primary_muscle,
          secondaryMuscles: ex.secondary_muscles ?? [],
          movementPattern: ex.movement_pattern,
          discouraged: ex.discouraged,
          discouragedReason: ex.discouraged_reason,
          weightKg: ss.weight_kg,
          reps: ss.reps,
          rpe: ss.rpe,
          setType: ss.set_type,
          performedAt: s.started_at,
        })
      }
    }
  }

  return { sets, sessions }
}

/** Righe compatte "cosa ha fatto nelle ultime sedute" per il prompt. */
export function formatRecentSessions(
  sessions: SessionSummary[],
  sets: SetRecord[],
  limit = 6,
): string[] {
  const bySession = new Map<string, Map<string, { sets: number; top: number }>>()
  for (const s of sets) {
    // Raggruppo per giorno: le SetRecord non portano l'id sessione.
    const key = s.performedAt
    if (!bySession.has(key)) bySession.set(key, new Map())
    const m = bySession.get(key)!
    const cur = m.get(s.exerciseName) ?? { sets: 0, top: 0 }
    cur.sets += 1
    if (s.weightKg) cur.top = Math.max(cur.top, Number(s.weightKg))
    m.set(s.exerciseName, cur)
  }

  const lines: string[] = []
  for (const s of sessions.slice(0, limit)) {
    const day = s.started_at.slice(0, 10)
    const exercises = bySession.get(s.started_at)
    const detail = exercises
      ? [...exercises.entries()]
          .map(([name, v]) => `${name} ${v.sets}×${v.top ? `${v.top}kg` : '—'}`)
          .join(', ')
      : '—'
    const min = s.duration_sec ? Math.round(s.duration_sec / 60) : null
    lines.push(
      `- ${day} · ${s.name}${min ? ` · ${min}min` : ''} · ${Math.round(s.total_volume_kg)} kg di volume${s.session_rpe ? ` · RPE ${s.session_rpe}` : ''}: ${detail}`,
    )
  }
  return lines
}
