import { useMutation } from '@tanstack/react-query'
import { callApi } from '@/lib/api'
import type { MealType } from '@/features/meals/useMeals'

export type ParsedMealItem = {
  name: string
  grams: number
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  confidence: number
  matched_food_id: string | null
}

export type ParseMealResponse = {
  items: ParsedMealItem[]
  provider: 'openai' | 'gemini'
  model: string
  tokens_in: number
  tokens_out: number
  cost_cents: number
  budget_remaining_cents: number
}

export function useParseMeal() {
  return useMutation({
    mutationFn: async (input: {
      meal_text: string
      meal_type: MealType
    }) => {
      return await callApi<ParseMealResponse>('ai-parse-meal', input)
    },
  })
}
