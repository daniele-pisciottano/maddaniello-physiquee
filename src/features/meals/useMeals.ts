import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type EntrySource = 'manual' | 'barcode' | 'ai_chat' | 'recipe'

export type MealEntry = {
  id: string
  user_id: string
  eaten_at: string
  meal_type: MealType
  food_id: string | null
  recipe_id: string | null
  food_name: string
  grams: number | null
  servings: number | null
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  source: EntrySource
  raw_ai_text: string | null
  confidence: number | null
  notes: string | null
  created_at: string
}

export type MealEntryInput = {
  eaten_at?: string
  meal_type: MealType
  food_id?: string | null
  recipe_id?: string | null
  food_name: string
  grams?: number | null
  servings?: number | null
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  source: EntrySource
  raw_ai_text?: string | null
  confidence?: number | null
  notes?: string | null
}

function startOfLocalDay(d: Date = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfLocalDay(d: Date = new Date()): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function useMealsForDate(date: Date) {
  const { user } = useAuth()
  const dayKey = date.toISOString().slice(0, 10)
  return useQuery({
    queryKey: ['meals', user?.id, dayKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_entries')
        .select('*')
        .eq('user_id', user!.id)
        .gte('eaten_at', startOfLocalDay(date).toISOString())
        .lte('eaten_at', endOfLocalDay(date).toISOString())
        .order('eaten_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MealEntry[]
    },
    enabled: !!user,
  })
}

export function useMealsForWeek() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['meals-week', user?.id],
    queryFn: async () => {
      const end = endOfLocalDay()
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from('meal_entries')
        .select('*')
        .eq('user_id', user!.id)
        .gte('eaten_at', start.toISOString())
        .lte('eaten_at', end.toISOString())
        .order('eaten_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as MealEntry[]
    },
    enabled: !!user,
  })
}

export function useAddMealEntry() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MealEntryInput) => {
      const payload = {
        user_id: user!.id,
        eaten_at: input.eaten_at ?? new Date().toISOString(),
        meal_type: input.meal_type,
        food_id: input.food_id ?? null,
        recipe_id: input.recipe_id ?? null,
        food_name: input.food_name,
        grams: input.grams ?? null,
        servings: input.servings ?? null,
        kcal: input.kcal,
        protein_g: input.protein_g,
        carb_g: input.carb_g,
        fat_g: input.fat_g,
        source: input.source,
        raw_ai_text: input.raw_ai_text ?? null,
        confidence: input.confidence ?? null,
        notes: input.notes ?? null,
      }
      const { data, error } = await supabase
        .from('meal_entries')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as MealEntry
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals'] })
      qc.invalidateQueries({ queryKey: ['meals-week'] })
    },
  })
}

export function useDeleteMealEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meal_entries')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals'] })
      qc.invalidateQueries({ queryKey: ['meals-week'] })
    },
  })
}

export function useUpdateMealEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      patch: Partial<
        Pick<
          MealEntry,
          | 'eaten_at'
          | 'meal_type'
          | 'food_name'
          | 'grams'
          | 'kcal'
          | 'protein_g'
          | 'carb_g'
          | 'fat_g'
          | 'notes'
        >
      >
    }) => {
      const { error } = await supabase
        .from('meal_entries')
        .update(input.patch)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals'] })
      qc.invalidateQueries({ queryKey: ['meals-week'] })
    },
  })
}

// Aggregate helpers
export function sumMealTotals(entries: MealEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + Number(e.kcal),
      protein_g: acc.protein_g + Number(e.protein_g),
      carb_g: acc.carb_g + Number(e.carb_g),
      fat_g: acc.fat_g + Number(e.fat_g),
    }),
    { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
  )
}
