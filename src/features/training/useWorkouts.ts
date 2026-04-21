import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type WorkoutIntensity = 'low' | 'moderate' | 'high'

export type Workout = {
  id: string
  user_id: string
  started_at: string
  duration_min: number
  workout_type: string
  intensity: WorkoutIntensity | null
  kcal_burned: number | null
  notes: string | null
  created_at: string
}

export type WorkoutInput = {
  started_at?: string
  duration_min: number
  workout_type: string
  intensity?: WorkoutIntensity | null
  kcal_burned?: number | null
  notes?: string | null
}

export function useWorkouts(limit: number = 30) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user!.id)
        .order('started_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as Workout[]
    },
    enabled: !!user,
  })
}

export function useAddWorkout() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: WorkoutInput) => {
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: user!.id,
          started_at: input.started_at ?? new Date().toISOString(),
          duration_min: input.duration_min,
          workout_type: input.workout_type,
          intensity: input.intensity ?? null,
          kcal_burned: input.kcal_burned ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as Workout
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })
}

export function useDeleteWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })
}
