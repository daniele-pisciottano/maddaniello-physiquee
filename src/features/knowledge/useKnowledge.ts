import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { callApi } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthProvider'

export type KnowledgeDoc = {
  id: string
  user_id: string
  title: string
  source_url: string | null
  content_md: string
  char_count: number
  created_at: string
  updated_at: string
}

export type KnowledgeDocSummary = Omit<KnowledgeDoc, 'content_md'> & {
  chunks_count?: number
}

export function useKnowledgeDocs() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['knowledge-docs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_docs')
        .select('id, user_id, title, source_url, char_count, created_at, updated_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as KnowledgeDocSummary[]
    },
    enabled: !!user,
  })
}

export function useAddKnowledgeDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      title: string
      content_md: string
      source_url?: string | null
    }) => {
      return await callApi<{
        doc_id: string
        title: string
        chunks: number
        tokens_in: number
        cost_cents: number
      }>('ai-embed-doc', input)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-docs'] }),
  })
}

export function useDeleteKnowledgeDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_docs')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-docs'] }),
  })
}
