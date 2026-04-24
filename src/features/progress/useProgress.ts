import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { callApi } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthProvider'
import { deleteProgressPhoto } from '@/lib/imageUpload'

export type ProgressSession = {
  id: string
  user_id: string
  taken_at: string
  front_path: string | null
  back_path: string | null
  side_path: string | null
  ai_bf_estimate: number | null
  ai_bf_confidence: 'low' | 'medium' | 'high' | null
  ai_lean_mass_kg: number | null
  ai_analysis: string | null
  ai_model: string | null
  ai_tokens_in: number | null
  ai_tokens_out: number | null
  ai_cost_usd_cents: number | null
  ai_analyzed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export function useProgressSessions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['progress-sessions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_sessions')
        .select('*')
        .eq('user_id', user!.id)
        .order('taken_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ProgressSession[]
    },
    enabled: !!user,
  })
}

export function useCreateProgressSession() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      taken_at?: string
      notes?: string | null
    }) => {
      const { data, error } = await supabase
        .from('progress_sessions')
        .insert({
          user_id: user!.id,
          taken_at: input.taken_at ?? new Date().toISOString().slice(0, 10),
          notes: input.notes ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as ProgressSession
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['progress-sessions'] }),
  })
}

export function useUpdateSessionPhotoPath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      orientation: 'front' | 'back' | 'side'
      path: string | null
    }) => {
      const col =
        input.orientation === 'front'
          ? 'front_path'
          : input.orientation === 'back'
            ? 'back_path'
            : 'side_path'
      const { error } = await supabase
        .from('progress_sessions')
        .update({ [col]: input.path })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['progress-sessions'] }),
  })
}

export function useUpdateSessionNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; notes: string | null }) => {
      const { error } = await supabase
        .from('progress_sessions')
        .update({ notes: input.notes })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['progress-sessions'] }),
  })
}

export function useAnalyzeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      return await callApi<{
        session: ProgressSession
        cost_cents: number
      }>('ai-analyze-physique', { session_id: sessionId })
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['progress-sessions'] }),
  })
}

export function useDeleteProgressSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (session: ProgressSession) => {
      // Cancella prima le foto dal bucket, poi il record
      const paths = [session.front_path, session.back_path, session.side_path]
        .filter(Boolean) as string[]
      for (const p of paths) {
        try {
          await deleteProgressPhoto(p)
        } catch {
          /* ignora errori singoli di delete storage */
        }
      }
      const { error } = await supabase
        .from('progress_sessions')
        .delete()
        .eq('id', session.id)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['progress-sessions'] }),
  })
}
