import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '../services/api'
import type { ResearchRequest } from '../types/api'

export function useStartResearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ResearchRequest) => api.startResearch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', 'list'] })
    },
  })
}
