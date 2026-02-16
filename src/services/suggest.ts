import { api } from '@/lib/api';
import type { SuggestResponse } from '@/types';

export const suggestService = {
  list: (range?: number) =>
    api.get<SuggestResponse>('/api/v1/suggest/', { range }),
};
