import { api } from '@/lib/api';
import type { User } from '@/types';

export const authService = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; user: User }>('/api/v1/auth/login', { email, password }),

  signup: (email: string, password: string, display_name?: string) =>
    api.post<{ access_token: string; user: User }>('/api/v1/auth/signup', { email, password, display_name }),

  me: () => api.get<User>('/api/v1/auth/me'),

  updateApiKey: (key: string | null) =>
    api.put('/api/v1/auth/api-key', { openai_api_key: key }),
};
