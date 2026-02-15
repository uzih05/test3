import { api } from '@/lib/api';
import type { PlanInfo } from '@/types';

export const planService = {
  info: () => api.get<PlanInfo>('/api/v1/auth/plan'),

  update: (plan: 'free' | 'pro') =>
    api.put<{ status: string; plan: string }>('/api/v1/auth/plan', { plan }),
};
