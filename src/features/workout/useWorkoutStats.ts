import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type {
  ExerciseHistoryPoint,
  MuscleVolumeRow,
  PersonalRecord,
} from './types'

export function useExerciseHistory(exerciseId: string | null, limit = 50) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['exercise-history', user?.id, exerciseId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exercise_history', {
        p_exercise_id: exerciseId!,
        p_limit: limit,
      })
      if (error) throw error
      // La RPC ordina dal più recente: per il grafico serve cronologico.
      return ((data ?? []) as ExerciseHistoryPoint[]).slice().reverse()
    },
    enabled: !!user && !!exerciseId,
  })
}

export function usePersonalRecords(exerciseId?: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['personal-records', user?.id, exerciseId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('personal_records')
        .select('id, exercise_id, record_type, value, weight_kg, reps, achieved_at')
        .order('achieved_at', { ascending: false })
      if (exerciseId) q = q.eq('exercise_id', exerciseId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as PersonalRecord[]
    },
    enabled: !!user,
  })
}

// Record migliore per (esercizio, tipo): la tabella è append-only, quindi
// il "record attuale" è il massimo storico.
export function useBestRecords() {
  const { data: all = [], ...rest } = usePersonalRecords()
  const best = useMemo(() => {
    const map = new Map<string, PersonalRecord>()
    for (const r of all) {
      const k = `${r.exercise_id}:${r.record_type}`
      const cur = map.get(k)
      if (!cur || Number(r.value) > Number(cur.value)) map.set(k, r)
    }
    return map
  }, [all])
  return { best, ...rest }
}

export function useMuscleVolume(weeks = 8) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['muscle-volume', user?.id, weeks],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('weekly_muscle_volume', {
        p_weeks: weeks,
      })
      if (error) throw error
      return (data ?? []) as MuscleVolumeRow[]
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

// Volume totale sollevato per settimana.
// Non si può derivare da weekly_muscle_volume: quella RPC espande ogni
// serie sul muscolo primario e sui secondari, quindi sommandone le righe
// il volume verrebbe contato due o tre volte. Qui usiamo il totale già
// calcolato sulla sessione.
export function useWeeklyVolume(weeks = 8) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['weekly-volume', user?.id, weeks],
    queryFn: async () => {
      const since = new Date()
      since.setDate(since.getDate() - weeks * 7)
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('started_at, total_volume_kg')
        .eq('status', 'completed')
        .gte('started_at', since.toISOString())
        .order('started_at')
      if (error) throw error

      const byWeek = new Map<string, number>()
      for (const row of data ?? []) {
        const week = startOfIsoWeek(new Date(row.started_at))
        byWeek.set(
          week,
          (byWeek.get(week) ?? 0) + Number(row.total_volume_kg ?? 0),
        )
      }
      return [...byWeek.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([week, volumeKg]) => ({ week, volumeKg }))
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

// Lunedì della settimana, come date_trunc('week') di Postgres.
function startOfIsoWeek(d: Date): string {
  const day = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
}

// Aggregati per l'header della pagina allenamento.
export function useTrainingSummary(weeks = 4) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['training-summary', user?.id, weeks],
    queryFn: async () => {
      const since = new Date()
      since.setDate(since.getDate() - weeks * 7)
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('started_at, duration_sec, total_volume_kg, total_sets')
        .eq('status', 'completed')
        .gte('started_at', since.toISOString())
      if (error) throw error
      const rows = data ?? []
      const totalVolume = rows.reduce(
        (s, r) => s + Number(r.total_volume_kg ?? 0),
        0,
      )
      const totalMin = rows.reduce(
        (s, r) => s + Math.round(Number(r.duration_sec ?? 0) / 60),
        0,
      )
      return {
        sessions: rows.length,
        sessionsPerWeek: Math.round((rows.length / weeks) * 10) / 10,
        totalVolumeKg: totalVolume,
        totalMinutes: totalMin,
        totalSets: rows.reduce((s, r) => s + Number(r.total_sets ?? 0), 0),
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}
