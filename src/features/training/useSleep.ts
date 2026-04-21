import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type SleepEntry = {
  id: string
  user_id: string
  sleep_date: string
  hours: number
  quality: number | null
  bedtime: string | null
  wake_time: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type SleepInput = {
  sleep_date: string
  hours: number
  quality?: number | null
  bedtime?: string | null
  wake_time?: string | null
  notes?: string | null
}

export function useSleepEntries(limit: number = 30) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['sleep-entries', user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sleep_entries')
        .select('*')
        .eq('user_id', user!.id)
        .order('sleep_date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as SleepEntry[]
    },
    enabled: !!user,
  })
}

// Upsert: un record per (user, sleep_date). Salva o aggiorna.
export function useUpsertSleep() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SleepInput) => {
      const { data, error } = await supabase
        .from('sleep_entries')
        .upsert(
          {
            user_id: user!.id,
            sleep_date: input.sleep_date,
            hours: input.hours,
            quality: input.quality ?? null,
            bedtime: input.bedtime ?? null,
            wake_time: input.wake_time ?? null,
            notes: input.notes ?? null,
          },
          { onConflict: 'user_id,sleep_date' },
        )
        .select()
        .single()
      if (error) throw error
      return data as SleepEntry
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sleep-entries'] }),
  })
}

export function useDeleteSleep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sleep_entries')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sleep-entries'] }),
  })
}
