import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type CorrectionScope = 'food' | 'behavior' | 'rule'

export type LearnedCorrection = {
  id: string
  user_id: string
  scope: CorrectionScope
  content: string
  source_message_id: string | null
  active: boolean
  created_at: string
}

export type CorrectionInput = {
  scope: CorrectionScope
  content: string
  source_message_id?: string | null
  active?: boolean
}

export function useLearnedCorrections() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['learned-corrections', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('learned_corrections')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as LearnedCorrection[]
    },
    enabled: !!user,
  })
}

export function useAddLearnedCorrection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CorrectionInput) => {
      const { data, error } = await supabase
        .from('learned_corrections')
        .insert({
          user_id: user!.id,
          scope: input.scope,
          content: input.content.trim(),
          source_message_id: input.source_message_id ?? null,
          active: input.active ?? true,
        })
        .select()
        .single()
      if (error) throw error
      return data as LearnedCorrection
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['learned-corrections'] }),
  })
}

export function useUpdateLearnedCorrection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      patch: Partial<Pick<LearnedCorrection, 'active' | 'content' | 'scope'>>
    }) => {
      const { error } = await supabase
        .from('learned_corrections')
        .update(input.patch)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['learned-corrections'] }),
  })
}

export function useDeleteLearnedCorrection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('learned_corrections')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['learned-corrections'] }),
  })
}

export const SCOPE_LABELS: Record<CorrectionScope, string> = {
  food: 'Cibo',
  behavior: 'Comportamento',
  rule: 'Regola',
}

export const SCOPE_HINTS: Record<CorrectionScope, string> = {
  food: "Correzione su un alimento (es. \"il riso basmati ha 350 kcal/100g, non 400\")",
  behavior: "Come l'AI deve rispondere (es. \"non suggerire mai pollo 3 giorni di fila\")",
  rule: "Regola nutrizionale (es. \"preferisci grassi insaturi agli insaturi\")",
}
