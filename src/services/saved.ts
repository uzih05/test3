import { api } from '@/lib/api';
import type { SavedResponse, PaginatedResponse } from '@/types';

export const savedService = {
  list: (params?: {
    source_type?: string;
    function_name?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get<PaginatedResponse<SavedResponse>>('/api/v1/saved', params),

  save: (data: {
    question: string;
    answer: string;
    source_type: string;
    function_name?: string;
  }) => api.post<{ id: string; status: string }>('/api/v1/saved', data),

  delete: (id: string) =>
    api.delete<{ status: string }>(`/api/v1/saved/${id}`),
};
