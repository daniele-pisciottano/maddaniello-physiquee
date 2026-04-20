import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type RecipeItem = {
  id: string
  recipe_id: string
  food_id: string | null
  food_name_snapshot: string
  grams: number
  kcal_snapshot: number
  protein_snapshot: number
  carb_snapshot: number
  fat_snapshot: number
  position: number
  created_at: string
}

export type Recipe = {
  id: string
  user_id: string
  name: string
  servings: number
  notes: string | null
  created_at: string
  updated_at: string
  recipe_items?: RecipeItem[]
}

export type RecipeItemInput = {
  food_id: string | null
  food_name_snapshot: string
  grams: number
  kcal_snapshot: number
  protein_snapshot: number
  carb_snapshot: number
  fat_snapshot: number
}

export function useRecipes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['recipes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, recipe_items(*)')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as Recipe[]).map((r) => ({
        ...r,
        recipe_items: (r.recipe_items ?? []).slice().sort(
          (a, b) => a.position - b.position,
        ),
      }))
    },
    enabled: !!user,
  })
}

export function useSaveRecipe() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      name: string
      servings: number
      notes?: string | null
      items: RecipeItemInput[]
    }) => {
      let recipeId = input.id

      if (recipeId) {
        const { error } = await supabase
          .from('recipes')
          .update({
            name: input.name,
            servings: input.servings,
            notes: input.notes ?? null,
          })
          .eq('id', recipeId)
        if (error) throw error
        await supabase.from('recipe_items').delete().eq('recipe_id', recipeId)
      } else {
        const { data, error } = await supabase
          .from('recipes')
          .insert({
            user_id: user!.id,
            name: input.name,
            servings: input.servings,
            notes: input.notes ?? null,
          })
          .select()
          .single()
        if (error) throw error
        recipeId = data.id
      }

      if (input.items.length > 0) {
        const rows = input.items.map((it, idx) => ({
          recipe_id: recipeId!,
          food_id: it.food_id,
          food_name_snapshot: it.food_name_snapshot,
          grams: it.grams,
          kcal_snapshot: it.kcal_snapshot,
          protein_snapshot: it.protein_snapshot,
          carb_snapshot: it.carb_snapshot,
          fat_snapshot: it.fat_snapshot,
          position: idx,
        }))
        const { error } = await supabase.from('recipe_items').insert(rows)
        if (error) throw error
      }

      return recipeId
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}

export function recipeTotals(items: RecipeItem[]) {
  return items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + Number(it.kcal_snapshot),
      protein: acc.protein + Number(it.protein_snapshot),
      carb: acc.carb + Number(it.carb_snapshot),
      fat: acc.fat + Number(it.fat_snapshot),
    }),
    { kcal: 0, protein: 0, carb: 0, fat: 0 },
  )
}

export function recipePerServing(r: Recipe) {
  const items = r.recipe_items ?? []
  const t = recipeTotals(items)
  return {
    kcal: t.kcal / r.servings,
    protein: t.protein / r.servings,
    carb: t.carb / r.servings,
    fat: t.fat / r.servings,
  }
}
