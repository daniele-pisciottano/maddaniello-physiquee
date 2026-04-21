import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { MealType } from '@/features/meals/useMeals'

export type MealPlanSlot = {
  id: string
  user_id: string
  meal_type: MealType
  slot_label: string
  options: string[]
  portion_hint: string | null
  notes: string | null
  position: number
  active: boolean
  created_at: string
  updated_at: string
}

export type MealPlanSlotInput = {
  meal_type: MealType
  slot_label: string
  options: string[]
  portion_hint?: string | null
  notes?: string | null
  position?: number
  active?: boolean
}

export function useMealPlanSlots() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['meal-plan-slots', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plan_slots')
        .select('*')
        .eq('user_id', user!.id)
        .order('meal_type')
        .order('position')
      if (error) throw error
      return (data ?? []) as MealPlanSlot[]
    },
    enabled: !!user,
  })
}

export function useAddMealPlanSlot() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MealPlanSlotInput) => {
      const { data, error } = await supabase
        .from('meal_plan_slots')
        .insert({
          user_id: user!.id,
          meal_type: input.meal_type,
          slot_label: input.slot_label,
          options: input.options,
          portion_hint: input.portion_hint ?? null,
          notes: input.notes ?? null,
          position: input.position ?? 0,
          active: input.active ?? true,
        })
        .select()
        .single()
      if (error) throw error
      return data as MealPlanSlot
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan-slots'] }),
  })
}

export function useUpdateMealPlanSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      patch: Partial<Omit<MealPlanSlot, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
    }) => {
      const { error } = await supabase
        .from('meal_plan_slots')
        .update(input.patch)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan-slots'] }),
  })
}

export function useDeleteMealPlanSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meal_plan_slots')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan-slots'] }),
  })
}
