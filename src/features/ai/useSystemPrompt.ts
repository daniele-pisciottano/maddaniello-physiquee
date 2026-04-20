import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { DEFAULT_SYSTEM_PROMPT } from './defaultPrompt'

export type SystemPrompt = {
  id: string
  user_id: string
  version: number
  content: string
  active: boolean
  created_at: string
}

export function useSystemPrompts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['system-prompts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .eq('user_id', user!.id)
        .order('version', { ascending: false })
      if (error) throw error
      return (data ?? []) as SystemPrompt[]
    },
    enabled: !!user,
  })
}

export function useActiveSystemPrompt() {
  const q = useSystemPrompts()
  return { ...q, data: q.data?.find((p) => p.active) ?? null }
}

export function useSaveSystemPrompt() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Non autenticato')
      // Nuova versione = max(version)+1. Una sola attiva per utente.
      const { data: latest } = await supabase
        .from('system_prompts')
        .select('version')
        .eq('user_id', user.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextVersion = (latest?.version ?? 0) + 1

      // Disattiva tutte le precedenti
      await supabase
        .from('system_prompts')
        .update({ active: false })
        .eq('user_id', user.id)
        .eq('active', true)

      // Inserisci nuova attiva
      const { error } = await supabase.from('system_prompts').insert({
        user_id: user.id,
        version: nextVersion,
        content,
        active: true,
      })
      if (error) throw error
      return nextVersion
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-prompts'] }),
  })
}

export function useActivateSystemPrompt() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Non autenticato')
      // Disattiva tutte, poi attiva quella scelta
      await supabase
        .from('system_prompts')
        .update({ active: false })
        .eq('user_id', user.id)
        .eq('active', true)
      const { error } = await supabase
        .from('system_prompts')
        .update({ active: true })
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-prompts'] }),
  })
}

export { DEFAULT_SYSTEM_PROMPT }
