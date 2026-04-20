import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { callApi } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthProvider'

export type Provider = 'openai' | 'gemini'

export type AiCredential = {
  user_id: string
  provider: Provider
  key_last4: string
  default_model: string | null
  validated_at: string | null
  created_at: string
  updated_at: string
  // encrypted_key è presente in SELECT ma non lo usiamo mai sul client
}

export type ModelInfo = {
  id: string
  display?: string
  category?: 'chat' | 'embedding' | 'other'
}

export function useAiCredentials() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['ai-credentials', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_credentials')
        .select('user_id, provider, key_last4, default_model, validated_at, created_at, updated_at')
        .eq('user_id', user!.id)
      if (error) throw error
      return (data ?? []) as AiCredential[]
    },
    enabled: !!user,
  })
}

export function useListModels() {
  return useMutation({
    mutationFn: async (input: { provider: Provider; api_key: string }) => {
      const res = await callApi<{ models: ModelInfo[] }>(
        'ai-list-models',
        input,
      )
      return res.models
    },
  })
}

export function useSaveKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      provider: Provider
      api_key: string
      default_model?: string | null
    }) => {
      return await callApi<{
        provider: Provider
        key_last4: string
        default_model: string | null
        validated_at: string
        models_available: number
      }>('ai-save-key', input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-credentials'] })
      qc.invalidateQueries({ queryKey: ['ai-settings'] })
    },
  })
}

export function useDeleteKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { provider: Provider }) => {
      return await callApi<{ deleted: true; provider: Provider }>(
        'ai-delete-key',
        input,
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-credentials'] })
      qc.invalidateQueries({ queryKey: ['ai-settings'] })
    },
  })
}
