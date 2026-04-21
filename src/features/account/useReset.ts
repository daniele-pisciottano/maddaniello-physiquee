import { useMutation, useQueryClient } from '@tanstack/react-query'
import { callApi } from '@/lib/api'

export function useResetAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return await callApi<{ reset: true; tables_cleared: number }>(
        'reset-account',
        {},
      )
    },
    onSuccess: () => {
      // Invalida tutto
      qc.invalidateQueries()
    },
  })
}
