import { api } from '@/lib/api';
import type { KpiData, TokenUsage, SystemStatus, TimelineEntry } from '@/types';

export const analyticsService = {
  kpi: (range?: number) =>
    api.get<KpiData>('/api/v1/analytics/kpi', { range }),

  tokens: () =>
    api.get<TokenUsage>('/api/v1/analytics/tokens'),

  status: () =>
    api.get<SystemStatus>('/api/v1/analytics/status'),

  timeline: (range?: number, bucket?: number) =>
    api.get<TimelineEntry[]>('/api/v1/analytics/timeline', { range, bucket }),

  functionDistribution: (limit?: number) =>
    api.get<{ function_name: string; count: number; percentage: number }[]>(
      '/api/v1/analytics/distribution/functions', { limit }
    ),

  errorDistribution: () =>
    api.get<{ error_code: string; count: number; percentage: number }[]>(
      '/api/v1/analytics/distribution/errors'
    ),
};
