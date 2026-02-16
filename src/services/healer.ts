import { api } from '@/lib/api';
import type { HealableFunction, DiagnosisResult } from '@/types';

export const healerService = {
  functions: (time_range?: number) =>
    api.get<{ items: HealableFunction[]; total: number }>(
      '/api/v1/healer/functions', { time_range }
    ),

  diagnose: (function_name: string, lookback_minutes?: number) =>
    api.post<DiagnosisResult>('/api/v1/healer/diagnose', {
      function_name,
      lookback_minutes: lookback_minutes || 60,
    }),

  diagnoseBatch: (function_names: string[], lookback_minutes?: number) =>
    api.post<{ results: DiagnosisResult[]; total: number; succeeded: number; failed: number }>(
      '/api/v1/healer/diagnose/batch', {
        function_names,
        lookback_minutes: lookback_minutes || 60,
      },
    ),
};
