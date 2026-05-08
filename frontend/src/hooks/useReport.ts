import { useQuery } from '@tanstack/react-query'

import { getReportApiResearchJobIdReportGet } from '../types/api'
import type { VerifiedReport } from '../types/api'

export function useReport(jobId: string): {
  data: VerifiedReport | undefined
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['research', jobId, 'report'],
    queryFn: async () => {
      const result = await getReportApiResearchJobIdReportGet({
        path: { job_id: jobId },
      })
      return result.data ?? null
    },
    retry: false,
  })

  return {
    data: data ?? undefined,
    isLoading,
    error: error as Error | null,
  }
}
