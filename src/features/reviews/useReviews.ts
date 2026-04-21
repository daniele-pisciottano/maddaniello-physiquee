import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { callApi } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthProvider'

export type AiSuggestion = {
  summary: string
  status: 'on_track' | 'adjust_needed' | 'insufficient_data'
  adherence_rating: 'good' | 'ok' | 'poor' | 'n_a'
  weight_trend_rating: 'good' | 'too_fast' | 'too_slow' | 'stable' | 'n_a'
  suggested_changes: {
    target_kcal: number | null
    target_protein_g: number | null
    target_carb_g: number | null
    target_fat_g: number | null
  } | null
  reasoning: string
}

export type PhaseReview = {
  id: string
  user_id: string
  reviewed_at: string
  period_start: string
  period_end: string
  auto: boolean
  days_with_data: number
  avg_kcal: number | null
  avg_protein_g: number | null
  avg_carb_g: number | null
  avg_fat_g: number | null
  adherence_pct_kcal: number | null
  adherence_pct_protein: number | null
  weight_start: number | null
  weight_end: number | null
  weight_delta: number | null
  body_fat_start: number | null
  body_fat_end: number | null
  target_kcal_at_review: number | null
  target_protein_at_review: number | null
  target_carb_at_review: number | null
  target_fat_at_review: number | null
  goal_type_at_review: string | null
  ai_suggestion: AiSuggestion | null
  ai_reasoning: string | null
  model: string | null
  tokens_in: number | null
  tokens_out: number | null
  cost_usd_cents: number | null
  applied: boolean
  applied_at: string | null
  dismissed: boolean
  created_at: string
}

export function useReviews() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['phase-reviews', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phase_reviews')
        .select('*')
        .eq('user_id', user!.id)
        .order('reviewed_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PhaseReview[]
    },
    enabled: !!user,
  })
}

// Review è "dovuta" se:
// - Non esistono review, oppure
// - L'ultima review ha reviewed_at > 14 giorni fa
export function useReviewStatus() {
  const { data: reviews = [], isLoading } = useReviews()
  const latest = reviews[0] ?? null

  const daysSinceLatest = latest
    ? Math.floor(
        (Date.now() - new Date(latest.reviewed_at).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null

  const dueForNewReview =
    latest == null || (daysSinceLatest != null && daysSinceLatest >= 14)

  const hasPendingAction =
    latest != null &&
    !latest.applied &&
    !latest.dismissed &&
    latest.ai_suggestion?.status === 'adjust_needed'

  return {
    isLoading,
    latest,
    daysSinceLatest,
    dueForNewReview,
    hasPendingAction,
  }
}

export function useGenerateReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return await callApi<{
        review: PhaseReview
        cost_cents: number
      }>('ai-phase-review', {})
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phase-reviews'] }),
  })
}

export function useApplyReview() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (review: PhaseReview) => {
      if (!user) throw new Error('Non autenticato')
      const changes = review.ai_suggestion?.suggested_changes
      if (!changes) throw new Error('Nessuna modifica da applicare')

      // 1. Update profile targets se cambiano
      const patch: Record<string, number> = {}
      if (changes.target_kcal != null) patch.target_kcal = changes.target_kcal
      if (changes.target_protein_g != null) patch.target_protein_g = changes.target_protein_g
      if (changes.target_carb_g != null) patch.target_carb_g = changes.target_carb_g
      if (changes.target_fat_g != null) patch.target_fat_g = changes.target_fat_g

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from('profile')
          .update(patch)
          .eq('user_id', user.id)
        if (error) throw error
      }

      // 2. Mark review as applied
      const { error: upErr } = await supabase
        .from('phase_reviews')
        .update({ applied: true, applied_at: new Date().toISOString() })
        .eq('id', review.id)
      if (upErr) throw upErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phase-reviews'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useDismissReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase
        .from('phase_reviews')
        .update({ dismissed: true })
        .eq('id', reviewId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phase-reviews'] }),
  })
}

export function useDeleteReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase
        .from('phase_reviews')
        .delete()
        .eq('id', reviewId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phase-reviews'] }),
  })
}
