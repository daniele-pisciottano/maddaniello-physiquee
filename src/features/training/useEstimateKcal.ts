import { useMutation } from '@tanstack/react-query'
import { callApi } from '@/lib/api'
import type { WorkoutIntensity } from './useWorkouts'

export type EstimateKcalResponse = {
  kcal_burned: number
  reasoning: string
  weight_used_kg: number
  cost_cents: number
}

export function useEstimateWorkoutKcal() {
  return useMutation({
    mutationFn: async (input: {
      workout_type: string
      duration_min: number
      intensity?: WorkoutIntensity | null
      notes?: string | null
    }) => {
      return await callApi<EstimateKcalResponse>(
        'ai-estimate-workout-kcal',
        input,
      )
    },
  })
}
