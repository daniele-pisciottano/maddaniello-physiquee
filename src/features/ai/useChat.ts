import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { callApi } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthProvider'

export type ChatMessageRow = {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  model: string | null
  tokens_in: number | null
  tokens_out: number | null
  cost_usd_cents: number | null
}

export type SendChatResponse = {
  id: string
  role: 'assistant'
  content: string
  model: string
  tokens_in: number
  tokens_out: number
  cost_cents: number
  budget_remaining_cents: number
  created_at: string
}

export function useChatMessages() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['chat-messages', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as ChatMessageRow[]
    },
    enabled: !!user,
  })
}

export function useSendChatMessage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (content: string) => {
      return await callApi<SendChatResponse>('ai-chat', { content })
    },
    // Ottimistico: aggiungi subito il messaggio utente alla lista
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: ['chat-messages', user?.id] })
      const prev =
        qc.getQueryData<ChatMessageRow[]>(['chat-messages', user?.id]) ?? []
      const optimistic: ChatMessageRow = {
        id: `optimistic-${Date.now()}`,
        user_id: user?.id ?? '',
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        model: null,
        tokens_in: null,
        tokens_out: null,
        cost_usd_cents: null,
      }
      qc.setQueryData<ChatMessageRow[]>(
        ['chat-messages', user?.id],
        [...prev, optimistic],
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['chat-messages', user?.id], ctx.prev)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['chat-messages'] })
    },
  })
}

export function useClearChat() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non autenticato')
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-messages'] }),
  })
}
