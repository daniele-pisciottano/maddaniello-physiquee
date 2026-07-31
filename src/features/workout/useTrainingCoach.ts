import { useMutation, useQueryClient } from '@tanstack/react-query'
import { callApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type CoachFinding = {
  severity: 'info' | 'warn' | 'block'
  code: string
  message: string
}

export type GeneratedRoutine = {
  name: string
  weekday: number | null
  notes: string | null
  exercises: Array<{
    exercise_id: string
    target_sets: number
    rep_min: number | null
    rep_max: number | null
    target_rpe: number | null
    rest_sec: number | null
    superset_group: number | null
    notes: string | null
  }>
}

export type GeneratedProgram = {
  program_name: string
  goal: string | null
  days_per_week: number | null
  weeks_planned: number | null
  rationale: string | null
  routines: GeneratedRoutine[]
}

export type CoachResponse = {
  action: string
  model: string
  cost_cents: number
  budget_remaining_cents: number
  findings: CoachFinding[]
  weekly_sets: Array<{ muscle: string; setsPerWeek: number }>
  text?: string
  program?: GeneratedProgram
}

// Le call del coach passano dal modello: possono superare i 30s con
// prompt lunghi, quindi alziamo il timeout rispetto al default.
const COACH_TIMEOUT_MS = 90_000

export function useTrainingCoach() {
  return useMutation({
    mutationFn: async (input: {
      action: 'analyze_routine' | 'generate_routine' | 'progression' | 'review'
      routineId?: string
      brief?: string
    }) =>
      callApi<CoachResponse>('ai-training-coach', input, {
        timeoutMs: COACH_TIMEOUT_MS,
      }),
  })
}

// Materializza il programma proposto dall'AI in schede vere.
export function useSaveGeneratedProgram() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (program: GeneratedProgram) => {
      const { data: folder, error: folderErr } = await supabase
        .from('routine_folders')
        .insert({
          user_id: user!.id,
          name: program.program_name,
          goal: program.goal ?? null,
          // Il CHECK del DB accetta 1-7: un programma A/B su più giorni può
          // avere più schede che giorni di allenamento.
          days_per_week: Math.min(
            7,
            Math.max(1, program.days_per_week ?? program.routines.length),
          ),
          weeks_planned: program.weeks_planned ?? null,
          source: 'ai',
          ai_rationale: program.rationale ?? null,
        })
        .select('id')
        .single()
      if (folderErr) throw folderErr

      for (const [i, r] of program.routines.entries()) {
        const { data: routine, error: rErr } = await supabase
          .from('routines')
          .insert({
            user_id: user!.id,
            folder_id: folder.id,
            name: r.name,
            weekday: r.weekday,
            notes: r.notes,
            position: i,
            source: 'ai',
          })
          .select('id')
          .single()
        if (rErr) throw rErr

        if (r.exercises.length > 0) {
          const { error: exErr } = await supabase
            .from('routine_exercises')
            .insert(
              r.exercises.map((e, j) => ({
                routine_id: routine.id,
                exercise_id: e.exercise_id,
                position: j,
                target_sets: e.target_sets,
                rep_min: e.rep_min,
                rep_max: e.rep_max,
                target_rpe: e.target_rpe,
                rest_sec: e.rest_sec,
                superset_group: e.superset_group,
                notes: e.notes,
              })),
            )
          if (exErr) throw exErr
        }
      }
      return folder.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routines'] })
      qc.invalidateQueries({ queryKey: ['routine-folders'] })
    },
  })
}
