import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type Supplement = {
  id: string
  user_id: string
  name: string
  dose: number | null
  unit: string | null
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type SupplementLogEntry = {
  id: string
  user_id: string
  supplement_id: string | null
  supplement_name: string
  taken_at: string
  dose: number | null
  unit: string | null
  notes: string | null
  created_at: string
}

export type SupplementInput = {
  name: string
  dose?: number | null
  unit?: string | null
  notes?: string | null
  active?: boolean
}

// Catalog
export function useSupplements() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['supplements', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user!.id)
        .order('name')
      if (error) throw error
      return (data ?? []) as Supplement[]
    },
    enabled: !!user,
  })
}

export function useAddSupplement() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SupplementInput) => {
      const { data, error } = await supabase
        .from('supplements')
        .insert({
          user_id: user!.id,
          name: input.name,
          dose: input.dose ?? null,
          unit: input.unit ?? null,
          notes: input.notes ?? null,
          active: input.active ?? true,
        })
        .select()
        .single()
      if (error) throw error
      return data as Supplement
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })
}

export function useUpdateSupplement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Supplement> }) => {
      const { error } = await supabase
        .from('supplements')
        .update(input.patch)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })
}

export function useDeleteSupplement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('supplements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplements'] })
      qc.invalidateQueries({ queryKey: ['supplement-log'] })
    },
  })
}

// Log (today + history)
function startOfLocalDay(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfLocalDay(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export function useSupplementLogToday() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['supplement-log', user?.id, 'today'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplement_log')
        .select('*')
        .eq('user_id', user!.id)
        .gte('taken_at', startOfLocalDay())
        .lte('taken_at', endOfLocalDay())
        .order('taken_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SupplementLogEntry[]
    },
    enabled: !!user,
  })
}

// Log integratori per una data specifica (Home permette di navigare i giorni)
export function useSupplementLogForDate(date: Date) {
  const { user } = useAuth()
  const dayKey = date.toISOString().slice(0, 10)
  return useQuery({
    queryKey: ['supplement-log', user?.id, 'date', dayKey],
    queryFn: async () => {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      const { data, error } = await supabase
        .from('supplement_log')
        .select('*')
        .eq('user_id', user!.id)
        .gte('taken_at', start.toISOString())
        .lte('taken_at', end.toISOString())
        .order('taken_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SupplementLogEntry[]
    },
    enabled: !!user,
  })
}

export function useSupplementLogRecent(limit: number = 30) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['supplement-log', user?.id, 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplement_log')
        .select('*')
        .eq('user_id', user!.id)
        .order('taken_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as SupplementLogEntry[]
    },
    enabled: !!user,
  })
}

export function useLogSupplement() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      supplement_id?: string | null
      supplement_name: string
      dose?: number | null
      unit?: string | null
      taken_at?: string
    }) => {
      const { data, error } = await supabase
        .from('supplement_log')
        .insert({
          user_id: user!.id,
          supplement_id: input.supplement_id ?? null,
          supplement_name: input.supplement_name,
          dose: input.dose ?? null,
          unit: input.unit ?? null,
          taken_at: input.taken_at ?? new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return data as SupplementLogEntry
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplement-log'] }),
  })
}

export function useDeleteSupplementLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplement_log')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplement-log'] }),
  })
}
