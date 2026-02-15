import { api } from '@/lib/api';
import type { Execution, ErrorSummary, ErrorTrend } from '@/types';

export const errorsService = {
  list: (params?: {
    limit?: number;
    function_name?: string;
    error_code?: string;
    team?: string;
    time_range?: number;
  }) => api.get<{ items: Execution[]; total: number; filters_applied: Record<string, unknown> }>(
    '/api/v1/errors', params
  ),

  search: (q: string) =>
    api.get<{ items: Execution[] }>('/api/v1/errors/search', { q }),

  summary: (time_range?: number) =>
    api.get<ErrorSummary>('/api/v1/errors/summary', { time_range }),

  trends: (time_range?: number, bucket?: number) =>
    api.get<ErrorTrend[]>('/api/v1/errors/trends', { time_range, bucket }),
};
