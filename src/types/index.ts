// === Auth ===
export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  has_openai_key: boolean;
  plan: 'free' | 'pro';
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// === Connection ===
export interface WeaviateConnection {
  id: string;
  name: string;
  connection_type: 'self_hosted' | 'wcs_cloud';
  host: string;
  port: number;
  grpc_port: number;
  api_key: string | null;
  is_active: boolean;
  vectorizer_type: 'openai' | 'huggingface' | null;
  vectorizer_model: string | null;
  created_at: string;
  has_openai_key: boolean;
}

// === Execution ===
export interface Execution {
  span_id: string;
  trace_id: string;
  function_name: string;
  status: 'SUCCESS' | 'ERROR' | 'CACHE_HIT';
  duration_ms: number;
  timestamp_utc: string;
  team?: string;
  error_code?: string;
  error_message?: string;
  input_preview?: string;
  output_preview?: string;
  return_value?: Record<string, unknown>;
  uuid: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// === Trace ===
export interface TraceListItem {
  trace_id: string;
  root_function: string;
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  total_duration_ms: number;
  span_count: number;
  start_time: string;
}

export interface Span {
  span_id: string;
  parent_span_id: string | null;
  function_name: string;
  status: 'SUCCESS' | 'ERROR' | 'CACHE_HIT';
  duration_ms: number;
  timestamp_utc: string;
  error_code?: string;
  error_message?: string;
  attributes?: Record<string, unknown>;
  children?: Span[];
}

export interface TraceDetail {
  trace_id: string;
  spans: Span[];
  span_count: number;
  total_duration_ms: number;
  start_time: string;
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
}

export interface TraceTree {
  trace_id: string;
  tree: Span[];
  total_duration_ms: number;
  status: string;
}

// === Function ===
export interface FunctionInfo {
  function_name: string;
  module?: string;
  file_path?: string;
  description?: string;
  docstring?: string;
  source_code?: string;
  team?: string;
  execution_count?: number;
  avg_duration_ms?: number;
  error_rate?: number;
}

// === Cache ===
export interface CacheAnalytics {
  total_executions: number;
  cache_hit_count: number;
  cache_hit_rate: number;
  golden_hit_count: number;
  standard_hit_count: number;
  golden_ratio: number;
  time_saved_ms: number;
  avg_cached_duration_ms: number;
  time_range_minutes: number;
  has_data: boolean;
}

export interface DriftItem {
  function_name: string;
  status: 'ANOMALY' | 'NORMAL' | 'INSUFFICIENT_DATA' | 'NO_VECTOR';
  avg_distance: number;
  sample_count: number;
  threshold: number;
}

export interface DriftSimulationResult {
  is_drift: boolean;
  avg_distance: number;
  function_name: string;
  threshold: number;
  neighbors: {
    span_id: string;
    distance: number;
    return_value: Record<string, unknown>;
    timestamp_utc: string;
  }[];
}

export interface GoldenRecord {
  uuid: string;
  execution_uuid: string;
  function_name: string;
  note: string;
  tags: string[];
  created_at: string;
  input_preview?: string;
  output_preview?: string;
}

// === Healer ===
export interface HealableFunction {
  function_name: string;
  error_count: number;
  last_error: string;
  error_codes: string[];
}

export interface DiagnosisResult {
  function_name: string;
  diagnosis: string;
  suggested_fix: string | null;
  lookback_minutes: number;
  status: 'success' | 'error' | 'no_errors';
  saved_id?: string;
}

// === GitHub ===
export interface GitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  draft: boolean;
  author: string;
  author_avatar: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  labels: { name: string; color: string }[];
  reviewers: string[];
  html_url: string;
  body?: string;
}

export interface GitHubPRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
}

export interface GitHubPRDetail extends GitHubPR {
  changed_files: number;
  additions: number;
  deletions: number;
  files?: GitHubPRFile[];
}

export interface GitHubRepo {
  full_name: string;
  name: string;
  owner: string;
  private: boolean;
  description: string;
  language: string;
  updated_at: string;
}

// === Widget ===
export interface Widget {
  id: string;
  widget_type: string;
  position_order: number;
  size: 'S' | 'M' | 'L';
}

export interface WidgetCatalogItem {
  type: string;
  name: string;
  sizes: string[];
  default_size: string;
}

// === Analytics ===
export interface KpiData {
  total_executions: number;
  success_count: number;
  error_count: number;
  cache_hit_count: number;
  success_rate: number;
  avg_duration_ms: number;
  time_range_minutes: number;
}

export interface TokenUsage {
  total_tokens: number;
  by_category: Record<string, number>;
}

export interface TimelineEntry {
  timestamp: string;
  success: number;
  error: number;
  cache_hit: number;
  avg_duration_ms: number;
}

export interface KpiCompareData {
  current: KpiData;
  previous: KpiData;
}

export interface SystemStatus {
  db_connected: boolean;
  registered_functions_count: number;
  last_checked: string;
}

export interface ErrorSummary {
  total_errors: number;
  unique_error_codes: number;
  most_common_errors: {
    error_code: string;
    count: number;
    percentage: number;
  }[];
  time_range_minutes: number;
}

export interface ErrorTrend {
  timestamp: string;
  error_count: number;
  unique_error_codes: number;
}

// === Semantic Analysis ===
export interface ScatterPoint {
  x: number;
  y: number;
  uuid?: string;
  span_id: string;
  function_name: string;
  status: string;
  duration_ms: number;
  is_golden?: boolean;
}

export interface BottleneckCluster {
  cluster_id: number;
  avg_duration_ms: number;
  count: number;
  representative_input: string;
  is_bottleneck: boolean;
}

export interface CoverageResult {
  coverage_score: number;
  total_executions: number;
  golden_count: number;
  scatter: ScatterPoint[];
}

export interface HallucinationCandidate {
  span_id: string;
  function_name: string;
  distance: number;
  duration_ms: number;
  timestamp_utc: string;
  input_preview: string;
  output_preview: string;
}

export interface ErrorCluster {
  cluster_id: number;
  count: number;
  representative_error: string;
  error_codes: string[];
  functions: string[];
}

// === Plan ===
export interface PlanInfo {
  plan: 'free' | 'pro';
  daily_limit: number | null;
  usage_today: number;
  can_use_ai: boolean;
}

// === Ask AI ===
export interface AskAiResponse {
  question: string;
  answer: string;
  function_name: string | null;
  source_type: 'ask_ai';
  status: 'success' | 'error';
}

// === Saved Responses ===
export interface SavedResponse {
  id: string;
  question: string;
  answer: string;
  source_type: string;
  function_name: string | null;
  is_bookmarked: boolean;
  created_at: string;
  locked: boolean;
}

// === Suggest ===
export type SuggestionType =
  | 'unused_function'
  | 'high_error_rate'
  | 'slow_function'
  | 'cache_optimization'
  | 'no_golden_data'
  | 'performance_degradation';

export type SuggestionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Suggestion {
  type: SuggestionType;
  priority: SuggestionPriority;
  function_name: string;
  message: string;
  metrics: Record<string, number>;
}

export interface SuggestResponse {
  suggestions: Suggestion[];
  total: number;
  time_range_minutes: number;
  summary: { critical: number; high: number; medium: number; low: number };
}
