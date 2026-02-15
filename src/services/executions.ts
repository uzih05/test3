import { api } from '@/lib/api';
import type { Execution, PaginatedResponse } from '@/types';

export const executionsService = {
  list: (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    function_name?: string;
    team?: string;
    error_code?: string;
    time_range?: number;
    sort_by?: string;
    sort_asc?: boolean;
  }) => api.get<PaginatedResponse<Execution>>('/api/v1/executions', params),

  get: (spanId: string) =>
    api.get<Execution>(`/api/v1/executions/${spanId}`),

  slowest: () =>
    api.get<{ items: Execution[]; total: number }>('/api/v1/executions/slowest'),

  recentErrors: (minutes?: number, limit?: number) =>
    api.get<{ items: Execution[] }>('/api/v1/executions/recent-errors', { minutes, limit }),
};
