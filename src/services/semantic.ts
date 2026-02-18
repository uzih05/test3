import { api } from '@/lib/api';
import type {
  ScatterPoint,
  BottleneckCluster,
  CoverageResult,
  HallucinationCandidate,
  ErrorCluster,
} from '@/types';

export const semanticService = {
  scatter: (functionName?: string, limit?: number) =>
    api.get<ScatterPoint[]>('/api/v1/semantic/scatter', {
      function_name: functionName,
      limit,
    }),

  bottleneck: (functionName?: string, nClusters?: number, limit?: number) =>
    api.get<BottleneckCluster[]>('/api/v1/semantic/bottleneck', {
      function_name: functionName,
      n_clusters: nClusters,
      limit,
    }),

  coverage: (functionName?: string, limit?: number) =>
    api.get<CoverageResult>('/api/v1/semantic/coverage', {
      function_name: functionName,
      limit,
    }),

  hallucinations: (functionName?: string, threshold?: number, limit?: number) =>
    api.get<HallucinationCandidate[]>('/api/v1/semantic/hallucinations', {
      function_name: functionName,
      threshold,
      limit,
    }),

  errorClusters: (nClusters?: number, limit?: number) =>
    api.get<ErrorCluster[]>('/api/v1/semantic/error-clusters', {
      n_clusters: nClusters,
      limit,
    }),

  recommend: (functionName: string, limit?: number) =>
    api.get<{
      function_name: string;
      candidates: {
        uuid: string;
        span_id: string;
        function_name: string;
        status: string;
        duration_ms: number;
        timestamp_utc: string;
        input_preview?: string;
        output_preview?: string;
        trace_id?: string;
        error_code?: string;
        error_message?: string;
        score: number;
        candidate_type: 'DISCOVERY' | 'STEADY';
        distance_to_nearest_golden: number;
      }[];
      total: number;
      golden_count: number;
    }>(`/api/v1/semantic/recommend/${functionName}`, { limit }),
};
