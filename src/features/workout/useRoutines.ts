import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type {
  Routine,
  RoutineFolder,
  RoutineWithExercises,
  SetType,
} from './types'

const EXERCISE_COLS =
  'id, user_id, name, aliases, primary_muscle, secondary_muscles, equipment, movement_pattern, plane, joint_type, is_unilateral, tracking_type, biomech_notes, cues, common_errors, contraindications, tier, discouraged, discouraged_reason, default_rest_sec, video_url, archived'

// Una sola query annidata per l'intera scheda: PostgREST fa il join,
// evitando la sequenza scheda → esercizi → set (N+1).
const ROUTINE_DEEP_SELECT = `
  *,
  routine_exercises (
    *,
    exercise:exercise_catalog ( ${EXERCISE_COLS} ),
    routine_sets ( * )
  )
`

export function useRoutineFolders() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['routine-folders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routine_folders')
        .select('*')
        .eq('archived', false)
        .order('position')
      if (error) throw error
      return (data ?? []) as RoutineFolder[]
    },
    enabled: !!user,
  })
}

export function useRoutines() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['routines', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('archived', false)
        .order('position')
      if (error) throw error
      return (data ?? []) as Routine[]
    },
    enabled: !!user,
  })
}

export function useRoutine(routineId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['routine', routineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routines')
        .select(ROUTINE_DEEP_SELECT)
        .eq('id', routineId!)
        .single()
      if (error) throw error
      const routine = data as unknown as RoutineWithExercises
      routine.routine_exercises.sort((a, b) => a.position - b.position)
      for (const re of routine.routine_exercises) {
        re.routine_sets?.sort((a, b) => a.position - b.position)
      }
      return routine
    },
    enabled: !!user && !!routineId,
  })
}

export type RoutineExerciseInput = {
  exercise_id: string
  position: number
  superset_group?: number | null
  target_sets: number
  rep_min?: number | null
  rep_max?: number | null
  target_rpe?: number | null
  rest_sec?: number | null
  notes?: string | null
  sets?: Array<{
    position: number
    set_type: SetType
    target_reps?: number | null
    target_weight_kg?: number | null
    target_rpe?: number | null
  }>
}

export type RoutineInput = {
  name: string
  folder_id?: string | null
  description?: string | null
  notes?: string | null
  weekday?: number | null
  source?: string
  ai_rationale?: string | null
  exercises: RoutineExerciseInput[]
}

export function useCreateRoutine() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RoutineInput) => {
      const { data: routine, error } = await supabase
        .from('routines')
        .insert({
          user_id: user!.id,
          folder_id: input.folder_id ?? null,
          name: input.name,
          description: input.description ?? null,
          notes: input.notes ?? null,
          weekday: input.weekday ?? null,
          source: input.source ?? 'user',
          ai_rationale: input.ai_rationale ?? null,
        })
        .select('*')
        .single()
      if (error) throw error

      await insertRoutineExercises(routine.id, input.exercises)
      return routine as Routine
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routines'] })
      qc.invalidateQueries({ queryKey: ['routine-folders'] })
    },
  })
}

export function useUpdateRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      exercises,
    }: {
      id: string
      patch?: Partial<
        Pick<
          Routine,
          'name' | 'description' | 'notes' | 'weekday' | 'folder_id' | 'position'
        >
      >
      exercises?: RoutineExerciseInput[]
    }) => {
      if (patch) {
        const { error } = await supabase
          .from('routines')
          .update(patch)
          .eq('id', id)
        if (error) throw error
      }
      if (exercises) {
        // Rimpiazzo completo: la cascade elimina anche i routine_sets.
        const { error: delErr } = await supabase
          .from('routine_exercises')
          .delete()
          .eq('routine_id', id)
        if (delErr) throw delErr
        await insertRoutineExercises(id, exercises)
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['routine', vars.id] })
      qc.invalidateQueries({ queryKey: ['routines'] })
    },
  })
}

async function insertRoutineExercises(
  routineId: string,
  exercises: RoutineExerciseInput[],
) {
  if (exercises.length === 0) return
  const { data: inserted, error } = await supabase
    .from('routine_exercises')
    .insert(
      exercises.map((e) => ({
        routine_id: routineId,
        exercise_id: e.exercise_id,
        position: e.position,
        superset_group: e.superset_group ?? null,
        target_sets: e.target_sets,
        rep_min: e.rep_min ?? null,
        rep_max: e.rep_max ?? null,
        target_rpe: e.target_rpe ?? null,
        rest_sec: e.rest_sec ?? null,
        notes: e.notes ?? null,
      })),
    )
    .select('id, position')
  if (error) throw error

  // Target per singola serie: solo per gli esercizi che li specificano.
  const byPosition = new Map((inserted ?? []).map((r) => [r.position, r.id]))
  const setRows = exercises.flatMap((e) => {
    const reId = byPosition.get(e.position)
    if (!reId || !e.sets?.length) return []
    return e.sets.map((s) => ({
      routine_exercise_id: reId,
      position: s.position,
      set_type: s.set_type,
      target_reps: s.target_reps ?? null,
      target_weight_kg: s.target_weight_kg ?? null,
      target_rpe: s.target_rpe ?? null,
    }))
  })
  if (setRows.length > 0) {
    const { error: setErr } = await supabase.from('routine_sets').insert(setRows)
    if (setErr) throw setErr
  }
}

export function useDeleteRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('routines')
        .update({ archived: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routines'] }),
  })
}

export function useCreateFolder() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      description?: string | null
      goal?: string | null
      days_per_week?: number | null
      weeks_planned?: number | null
      source?: string
      ai_rationale?: string | null
    }) => {
      const { data, error } = await supabase
        .from('routine_folders')
        .insert({
          user_id: user!.id,
          name: input.name,
          description: input.description ?? null,
          goal: input.goal ?? null,
          days_per_week: input.days_per_week ?? null,
          weeks_planned: input.weeks_planned ?? null,
          source: input.source ?? 'user',
          ai_rationale: input.ai_rationale ?? null,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as RoutineFolder
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routine-folders'] }),
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('routine_folders')
        .update({ archived: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routine-folders'] })
      qc.invalidateQueries({ queryKey: ['routines'] })
    },
  })
}
