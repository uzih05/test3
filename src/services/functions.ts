import { api } from '@/lib/api';
import type { FunctionInfo } from '@/types';

export const functionsService = {
  list: () =>
    api.get<{ items: FunctionInfo[]; total: number }>('/api/v1/functions'),

  get: (name: string) =>
    api.get<FunctionInfo>(`/api/v1/functions/${name}`),

  search: (q: string, limit?: number) =>
    api.get<{ items: FunctionInfo[] }>('/api/v1/functions/search', { q, limit }),

  hybridSearch: (q: string, alpha?: number) =>
    api.get<{ items: FunctionInfo[] }>('/api/v1/functions/search/hybrid', { q, alpha }),

  ask: (q: string, language?: string) =>
    api.get<{ query: string; answer: string; language: string }>(
      '/api/v1/functions/ask', { q, language }
    ),

  byTeam: (team: string) =>
    api.get<{ items: FunctionInfo[] }>(`/api/v1/functions/by-team/${team}`),
};
