import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type Sex = 'male' | 'female' | 'other'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete'
export type GoalType = 'cut' | 'bulk' | 'recomp' | 'maintain'

export type Profile = {
  user_id: string
  sex: Sex | null
  birth_date: string | null
  height_cm: number | null
  activity_level: ActivityLevel | null
  goal_type: GoalType | null
  goal_weight_kg: number | null
  goal_body_fat_pct: number | null
  goal_deadline: string | null
  dietary_prefs: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ProfilePatch = Partial<
  Omit<Profile, 'user_id' | 'created_at' | 'updated_at'>
>

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile')
        .select('*')
        .eq('user_id', user!.id)
        .single()
      if (error) throw error
      return data as Profile
    },
    enabled: !!user,
  })
}

export function useUpdateProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const { error } = await supabase
        .from('profile')
        .update(patch)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
