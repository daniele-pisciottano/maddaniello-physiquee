import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Provider } from './useAiCredentials'

export type AiSettings = {
  user_id: string
  active_provider: Provider | null
  monthly_budget_usd: number
  updated_at: string
}

export function useAiSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['ai-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', user!.id)
        .single()
      if (error) throw error
      return data as AiSettings
    },
    enabled: !!user,
  })
}

export function useUpdateAiSettings() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      patch: Partial<Pick<AiSettings, 'active_provider' | 'monthly_budget_usd'>>,
    ) => {
      const { error } = await supabase
        .from('ai_settings')
        .update(patch)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
  })
}
