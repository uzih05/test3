import { api } from '@/lib/api';
import type { TraceListItem, TraceDetail, TraceTree } from '@/types';

export const tracesService = {
  list: (limit?: number) =>
    api.get<TraceListItem[]>('/api/v1/traces', { limit }),

  get: (traceId: string) =>
    api.get<TraceDetail>(`/api/v1/traces/${traceId}`),

  tree: (traceId: string) =>
    api.get<TraceTree>(`/api/v1/traces/${traceId}/tree`),

  analyze: (traceId: string, language?: string) =>
    api.get<{ trace_id: string; analysis: string; language: string }>(
      `/api/v1/traces/${traceId}/analyze`, { language }
    ),
};
