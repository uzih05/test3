import { api } from '@/lib/api';
import type { WeaviateConnection } from '@/types';

export const connectionsService = {
  list: () =>
    api.get<{ items: WeaviateConnection[]; total: number }>('/api/v1/connections'),

  create: (data: {
    name?: string;
    connection_type?: string;
    host?: string;
    port?: number;
    grpc_port?: number;
    api_key?: string;
    vectorizer_type?: string;
    vectorizer_model?: string;
  }) => api.post<WeaviateConnection>('/api/v1/connections', data),

  update: (id: string, data: Partial<WeaviateConnection>) =>
    api.put<WeaviateConnection>(`/api/v1/connections/${id}`, data),

  delete: (id: string) => api.delete(`/api/v1/connections/${id}`),

  activate: (id: string) =>
    api.post(`/api/v1/connections/${id}/activate`),

  test: (data: { host: string; port: number; grpc_port?: number; api_key?: string }) =>
    api.post<{ success: boolean; message: string }>('/api/v1/connections/test', data),

  updateApiKey: (id: string, key: string) =>
    api.put(`/api/v1/connections/${id}/api-key`, { openai_api_key: key }),

  deleteApiKey: (id: string) =>
    api.delete(`/api/v1/connections/${id}/api-key`),
};
