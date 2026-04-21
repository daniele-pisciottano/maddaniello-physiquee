import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type DietaryRuleType =
  | 'max_per_week'
  | 'max_per_day'
  | 'min_per_day'
  | 'exclude'
  | 'prefer'

// rule_value standard: { target: string, value?: number }
// Accettiamo anche vecchie chiavi (food_tag, ingredient) per retrocompat.
export type RuleValue = {
  target?: string
  value?: number
  food_tag?: string
  ingredient?: string
  count?: number
  [k: string]: unknown
}

export type DietaryRule = {
  id: string
  user_id: string
  rule_type: DietaryRuleType
  rule_value: RuleValue
  notes: string | null
  active: boolean
  created_at: string
}

export type DietaryRuleInput = {
  rule_type: DietaryRuleType
  rule_value: RuleValue
  notes?: string | null
  active?: boolean
}

export function useDietaryRules() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dietary-rules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dietary_rules')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DietaryRule[]
    },
    enabled: !!user,
  })
}

export function useAddDietaryRule() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DietaryRuleInput) => {
      const { data, error } = await supabase
        .from('dietary_rules')
        .insert({
          user_id: user!.id,
          rule_type: input.rule_type,
          rule_value: input.rule_value,
          notes: input.notes ?? null,
          active: input.active ?? true,
        })
        .select()
        .single()
      if (error) throw error
      return data as DietaryRule
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dietary-rules'] }),
  })
}

export function useUpdateDietaryRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      patch: Partial<Pick<DietaryRule, 'active' | 'notes' | 'rule_value'>>
    }) => {
      const { error } = await supabase
        .from('dietary_rules')
        .update(input.patch)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dietary-rules'] }),
  })
}

export function useDeleteDietaryRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dietary_rules')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dietary-rules'] }),
  })
}

export const RULE_TYPE_LABELS: Record<DietaryRuleType, string> = {
  max_per_week: 'Max per settimana',
  max_per_day: 'Max per giorno',
  min_per_day: 'Min per giorno',
  exclude: 'Escludi',
  prefer: 'Preferisci',
}

export function ruleRequiresValue(t: DietaryRuleType): boolean {
  return t === 'max_per_week' || t === 'max_per_day' || t === 'min_per_day'
}

export function formatRuleHumanReadable(r: DietaryRule): string {
  const target =
    r.rule_value.target ||
    r.rule_value.food_tag ||
    r.rule_value.ingredient ||
    '?'
  const value = r.rule_value.value ?? r.rule_value.count
  switch (r.rule_type) {
    case 'max_per_week':
      return `Max ${value ?? '?'}× a settimana: ${target}`
    case 'max_per_day':
      return `Max ${value ?? '?'}× al giorno: ${target}`
    case 'min_per_day':
      return `Min ${value ?? '?'}× al giorno: ${target}`
    case 'exclude':
      return `Escludi: ${target}`
    case 'prefer':
      return `Preferisci: ${target}`
  }
}
