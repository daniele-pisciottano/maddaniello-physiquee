import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type FoodSource = 'custom' | 'ai' | 'off_import'

export type Food = {
  id: string
  user_id: string
  source: FoodSource
  barcode: string | null
  name: string
  brand: string | null
  serving_g: number | null
  kcal_100g: number
  protein_100g: number
  carb_100g: number
  fat_100g: number
  fiber_100g: number | null
  extra: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type FoodInput = Omit<Food, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export function useFoods(search?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['foods', user?.id, search ?? ''],
    queryFn: async () => {
      let q = supabase.from('foods').select('*').eq('user_id', user!.id)
      if (search && search.trim()) {
        q = q.ilike('name', `%${search.trim()}%`)
      }
      q = q.order('updated_at', { ascending: false }).limit(50)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Food[]
    },
    enabled: !!user,
  })
}

export function useAddFood() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<FoodInput> & { name: string }) => {
      const payload = {
        user_id: user!.id,
        source: (input.source ?? 'custom') as FoodSource,
        barcode: input.barcode ?? null,
        name: input.name,
        brand: input.brand ?? null,
        serving_g: input.serving_g ?? null,
        kcal_100g: input.kcal_100g ?? 0,
        protein_100g: input.protein_100g ?? 0,
        carb_100g: input.carb_100g ?? 0,
        fat_100g: input.fat_100g ?? 0,
        fiber_100g: input.fiber_100g ?? null,
        extra: input.extra ?? {},
      }
      const { data, error } = await supabase
        .from('foods')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as Food
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foods'] }),
  })
}

export function useDeleteFood() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('foods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foods'] })
      qc.invalidateQueries({ queryKey: ['meals'] })
      qc.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}
