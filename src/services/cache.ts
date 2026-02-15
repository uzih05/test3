import { api } from '@/lib/api';
import type { CacheAnalytics, DriftItem, DriftSimulationResult, GoldenRecord } from '@/types';

export const cacheService = {
  analytics: (range?: number) =>
    api.get<CacheAnalytics>('/api/v1/cache/analytics', { range }),

  driftSummary: () =>
    api.get<{ items: DriftItem[]; total: number }>('/api/v1/cache/drift/summary'),

  driftSimulate: (data: {
    text: string;
    function_name: string;
    threshold?: number;
    k?: number;
  }) => api.post<DriftSimulationResult>('/api/v1/cache/drift/simulate', data),

  goldenList: (function_name?: string, limit?: number) =>
    api.get<{ items: GoldenRecord[]; total: number }>(
      '/api/v1/cache/golden', { function_name, limit }
    ),

  goldenRegister: (execution_uuid: string, note?: string, tags?: string[]) =>
    api.post<{ status: string; uuid: string; function_name: string }>(
      '/api/v1/cache/golden', { execution_uuid, note, tags }
    ),

  goldenDelete: (uuid: string) =>
    api.delete(`/api/v1/cache/golden/${uuid}`),

  goldenRecommend: (functionName: string, limit?: number) =>
    api.get<{
      function_name: string;
      candidates: {
        span_id: string;
        trace_id: string;
        function_name: string;
        timestamp_utc: string;
        duration_ms: number;
        status: string;
        score: number;
      }[];
      total: number;
    }>(`/api/v1/cache/golden/recommend/${functionName}`, { limit }),

  goldenStats: () =>
    api.get<{
      stats: { function_name: string; count: number }[];
      total: number;
    }>('/api/v1/cache/golden/stats'),
};
