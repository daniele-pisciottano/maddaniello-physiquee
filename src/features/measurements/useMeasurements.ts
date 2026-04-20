import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type Circumferences = {
  waist_cm?: number | null
  chest_cm?: number | null
  hips_cm?: number | null
  arm_cm?: number | null
  thigh_cm?: number | null
  neck_cm?: number | null
}

export type Measurement = {
  id: string
  user_id: string
  measured_at: string // YYYY-MM-DD
  weight_kg: number | null
  body_fat_pct: number | null
  circumferences: Circumferences
  notes: string | null
  created_at: string
}

export type MeasurementInput = {
  measured_at: string
  weight_kg?: number | null
  body_fat_pct?: number | null
  circumferences?: Circumferences
  notes?: string | null
}

export function useMeasurements() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['measurements', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', user!.id)
        .order('measured_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Measurement[]
    },
    enabled: !!user,
  })
}

export function useLatestMeasurement() {
  const q = useMeasurements()
  return { ...q, data: q.data?.[0] }
}

export function useAddMeasurement() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MeasurementInput) => {
      const { error } = await supabase.from('measurements').insert({
        ...input,
        user_id: user!.id,
        circumferences: input.circumferences ?? {},
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['measurements'] })
    },
  })
}

export function useDeleteMeasurement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('measurements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['measurements'] })
    },
  })
}
