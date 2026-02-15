import { api } from '@/lib/api';
import type { AskAiResponse } from '@/types';

export const askAiService = {
  ask: (question: string, function_name?: string) =>
    api.post<AskAiResponse>('/api/v1/ask-ai/ask', {
      question,
      function_name: function_name || null,
    }),
};
