'use client';

import { useState, memo, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Database,
  Zap,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Send,
  TrendingUp,
  Star,
  DollarSign,
  ScatterChart,
  Timer,
  Layers,
} from 'lucide-react';
import { cacheService } from '@/services/cache';
import { analyticsService } from '@/services/analytics';
import { semanticService } from '@/services/semantic';
import { useDashboardStore } from '@/stores/dashboardStore';
import { usePagePreferencesStore } from '@/stores/pagePreferencesStore';
import { useTranslation } from '@/lib/i18n';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { formatNumber, formatDuration, formatPercentage, formatCost, cn } from '@/lib/utils';
import { TruncatedText } from '@/components/TruncatedText';
import { useChartColors } from '@/lib/hooks/useChartColors';
import type { CacheAnalytics, DriftItem, DriftSimulationResult, ScatterPoint, BottleneckCluster, ErrorCluster } from '@/types';

type TabKey = 'overview' | 'cacheReport' | 'costSavings' | 'inputScatter' | 'bottleneck' | 'errorClusters' | 'drift';

const DRIFT_COLORS: Record<string, { bg: string; text: string }> = {
  ANOMALY: { bg: 'bg-status-error-dim', text: 'text-status-error' },
  NORMAL: { bg: 'bg-accent-secondary-dim', text: 'text-accent-secondary' },
  INSUFFICIENT_DATA: { bg: 'bg-status-warning-dim', text: 'text-status-warning' },
  NO_VECTOR: { bg: 'bg-bg-elevated', text: 'text-text-muted' },
};

// OpenAI GPT-4o pricing (2026)
const BLENDED_RATE = 5.0; // $ per 1M tokens (input:output ~ 60:40)

// STATUS_COLORS moved inside InputScatterTab to use dynamic theme colors

// ========================
// Prop Interfaces
// ========================

interface CacheReportTabProps {
  analytics: CacheAnalytics | undefined;
  loading: boolean;
}

interface CostSavingsTabProps {
  analytics: { has_data: boolean; cache_hit_rate: number; time_saved_ms: number; cache_hit_count: number; total_executions: number } | undefined;
  costCalc: { tokensSaved: number; costSaved: number; avgTokensPerExec: number } | null;
  loading: boolean;
}

interface InputScatterTabProps {
  data: ScatterPoint[];
  allFunctions: string[];
  loading: boolean;
  fnFilter: string;
  setFnFilter: (v: string) => void;
}

interface BottleneckTabProps {
  data: BottleneckCluster[];
  loading: boolean;
  fnFilter: string;
  setFnFilter: (v: string) => void;
}

interface ErrorClustersTabProps {
  data: ErrorCluster[];
  loading: boolean;
}

interface DriftTabProps {
  driftItems: DriftItem[];
  loadingDrift: boolean;
  simFn: string;
  setSimFn: (v: string) => void;
  simText: string;
  setSimText: (v: string) => void;
  simResult: DriftSimulationResult | null;
  simulateMutation: { mutate: () => void; isPending: boolean };
}

// ========================
// Cache Report Tab
// ========================
const CacheReportTab = memo(function CacheReportTab({
  analytics,
  loading,
}: CacheReportTabProps) {
  const { t } = useTranslation();
  const chartColors = useChartColors();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-accent-primary" />
      </div>
    );
  }

  if (!analytics || !analytics.has_data) {
    return (
      <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
        <Database size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
        <p className="text-sm text-text-muted">{t('analysis.noData')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={TrendingUp}
          label={t('analysis.hitRate')}
          value={formatPercentage(analytics.cache_hit_rate)}
          sub={`${analytics.cache_hit_count} / ${analytics.total_executions}`}
          color="text-accent-secondary"
          bg="bg-accent-secondary-dim"
        />
        <StatCard
          icon={Clock}
          label={t('analysis.timeSaved')}
          value={formatDuration(analytics.time_saved_ms)}
          sub={`Avg: ${formatDuration(analytics.avg_cached_duration_ms)}`}
          color="text-accent-primary"
          bg="bg-accent-primary-dim"
        />
        <StatCard
          icon={Star}
          label={t('analysis.goldenHits')}
          value={formatNumber(analytics.golden_hit_count)}
          sub={`${formatPercentage(analytics.golden_ratio)} of hits`}
          color="text-status-warning"
          bg="bg-status-warning-dim"
        />
        <StatCard
          icon={Database}
          label={t('analysis.standardHits')}
          value={formatNumber(analytics.standard_hit_count)}
          sub={`${analytics.total_executions} total`}
          color="text-text-secondary"
          bg="bg-bg-elevated"
        />
      </div>

      {/* Hit rate gauge */}
      <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
        <h3 className="text-sm font-medium text-text-secondary mb-4">{t('analysis.cacheHitBreakdown')}</h3>
        <div className="flex items-center gap-4">
          <div className="relative w-32 h-32 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke={chartColors.bgElevated} strokeWidth="10" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke={chartColors.accentSecondary} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - analytics.cache_hit_rate / 100)}`}
                className="transition-[stroke-dashoffset] duration-700"
              />
              {analytics.golden_ratio > 0 && (
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke={chartColors.accentPrimary} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - (analytics.golden_ratio * analytics.cache_hit_rate / 10000))}`}
                  className="transition-[stroke-dashoffset] duration-700"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-accent-secondary">{formatPercentage(analytics.cache_hit_rate)}</span>
            </div>
          </div>
          <div className="space-y-3 flex-1">
            <LegendItem color={chartColors.accentSecondary} label={t('analysis.standardCache')} value={analytics.standard_hit_count} />
            <LegendItem color={chartColors.accentPrimary} label={t('analysis.goldenCache')} value={analytics.golden_hit_count} />
            <LegendItem color={chartColors.borderDefault} label={t('analysis.cacheMiss')} value={analytics.total_executions - analytics.cache_hit_count} />
          </div>
        </div>
      </div>
    </div>
  );
});

// ========================
// Cost Savings Tab
// ========================
const CostSavingsTab = memo(function CostSavingsTab({
  analytics,
  costCalc,
  loading,
}: CostSavingsTabProps) {
  const { t } = useTranslation();
  const chartColors = useChartColors();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-accent-primary" />
      </div>
    );
  }

  if (!analytics?.has_data || !costCalc) {
    return (
      <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
        <DollarSign size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
        <p className="text-sm text-text-muted">{t('analysis.noData')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Zap}
          label={t('analysis.tokensSaved')}
          value={formatNumber(Math.round(costCalc.tokensSaved))}
          sub={`~${formatNumber(Math.round(costCalc.avgTokensPerExec))} tokens/exec`}
          color="text-accent-secondary"
          bg="bg-accent-secondary-dim"
        />
        <StatCard
          icon={DollarSign}
          label={t('analysis.costSaved')}
          value={formatCost(costCalc.costSaved)}
          sub={`${t('analysis.blendedRate')}: $${BLENDED_RATE}/1M`}
          color="text-accent-primary"
          bg="bg-accent-primary-dim"
        />
        <StatCard
          icon={Clock}
          label={t('analysis.timeSaved')}
          value={formatDuration(analytics.time_saved_ms)}
          sub={`${analytics.cache_hit_count} cache hits`}
          color="text-status-warning"
          bg="bg-status-warning-dim"
        />
        <StatCard
          icon={TrendingUp}
          label={t('analysis.hitRate')}
          value={formatPercentage(analytics.cache_hit_rate)}
          sub={`${analytics.cache_hit_count} / ${analytics.total_executions}`}
          color="text-text-secondary"
          bg="bg-bg-elevated"
        />
      </div>

      {/* Hit rate ring */}
      <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
        <h3 className="text-sm font-medium text-text-secondary mb-4">{t('analysis.hitRate')}</h3>
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke={chartColors.bgElevated} strokeWidth="10" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke={chartColors.accentSecondary} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - analytics.cache_hit_rate / 100)}`}
                className="transition-[stroke-dashoffset] duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-accent-secondary">{formatPercentage(analytics.cache_hit_rate)}</span>
            </div>
          </div>
          <div className="text-xs text-text-muted">
            <p>{t('analysis.basedOn')}</p>
            <p className="mt-1">{t('analysis.pricingDetail')}</p>
            <p>{t('analysis.blendedRate')}: ${BLENDED_RATE.toFixed(2)}/1M tokens</p>
          </div>
        </div>
      </div>
    </div>
  );
});

// ========================
// Input Scatter Tab (D12)
// ========================
const InputScatterTab = memo(function InputScatterTab({
  data,
  allFunctions,
  loading,
  fnFilter,
  setFnFilter,
}: InputScatterTabProps) {
  const { t } = useTranslation();
  const chartColors = useChartColors();
  const STATUS_COLORS: Record<string, string> = useMemo(() => ({
    SUCCESS: chartColors.accentSecondary,
    ERROR: chartColors.statusError,
    CACHE_HIT: chartColors.accentPrimary,
  }), [chartColors]);
  const [hovered, setHovered] = useState<ScatterPoint | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-accent-primary" />
      </div>
    );
  }

  if (data.length === 0 && !fnFilter) {
    return (
      <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
        <ScatterChart size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
        <p className="text-sm text-text-muted">{t('analysis.noData')}</p>
      </div>
    );
  }

  // Normalize coords to SVG space
  const xVals = data.map((d) => d.x);
  const yVals = data.map((d) => d.y);
  const xMin = Math.min(...xVals, 0);
  const xMax = Math.max(...xVals, 0);
  const yMin = Math.min(...yVals, 0);
  const yMax = Math.max(...yVals, 0);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const pad = 30;
  const w = 600;
  const h = 400;

  const toSvg = (pt: ScatterPoint) => ({
    cx: pad + ((pt.x - xMin) / xRange) * (w - 2 * pad),
    cy: pad + ((pt.y - yMin) / yRange) * (h - 2 * pad),
  });

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="bg-bg-card border border-border-default rounded-[14px] px-4 py-3 card-shadow">
        <p className="text-xs text-text-secondary leading-relaxed">
          {t('analysis.inputScatterDesc')}
        </p>
      </div>

      {/* Function filter (dropdown) */}
      {allFunctions.length > 0 && (
        <select
          value={fnFilter}
          onChange={(e) => setFnFilter(e.target.value)}
          className={cn(
            'w-full max-w-sm px-4 py-2 bg-bg-input border border-border-default rounded-[10px]',
            'text-xs text-text-primary',
            'focus:border-accent-primary focus-visible:ring-2 focus-visible:ring-accent-primary/50 outline-none transition-colors'
          )}
        >
          <option value="">{t('analysis.allFunctions')} ({allFunctions.length})</option>
          {allFunctions.map((fn) => (
            <option key={fn} value={fn}>{fn}</option>
          ))}
        </select>
      )}

      <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
        <h3 className="text-sm font-medium text-text-secondary mb-4">{t('analysis.inputScatter')}</h3>
        <div className="relative">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 420 }}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((pct) => (
              <line
                key={`h-${pct}`}
                x1={pad} y1={pad + pct * (h - 2 * pad)}
                x2={w - pad} y2={pad + pct * (h - 2 * pad)}
                stroke={chartColors.borderDefault} strokeWidth="0.5"
              />
            ))}
            {[0.25, 0.5, 0.75].map((pct) => (
              <line
                key={`v-${pct}`}
                x1={pad + pct * (w - 2 * pad)} y1={pad}
                x2={pad + pct * (w - 2 * pad)} y2={h - pad}
                stroke={chartColors.borderDefault} strokeWidth="0.5"
              />
            ))}
            {/* Points */}
            {data.map((pt, i) => {
              const { cx, cy } = toSvg(pt);
              const color = STATUS_COLORS[pt.status] || '#666';
              return (
                <circle
                  key={i}
                  cx={cx} cy={cy} r={4}
                  fill={color} fillOpacity={0.7}
                  stroke={hovered?.span_id === pt.span_id ? '#fff' : 'none'}
                  strokeWidth={1.5}
                  className="cursor-pointer transition-[fill-opacity,stroke] duration-150"
                  onMouseEnter={() => setHovered(pt)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
          </svg>
          {/* Tooltip */}
          {hovered && (
            <div className="absolute top-2 right-2 bg-bg-elevated border border-border-default rounded-[12px] px-4 py-3 text-xs space-y-1 pointer-events-none">
              <p className="font-medium text-text-primary">{hovered.function_name}</p>
              <p className="text-text-muted"><TruncatedText text={hovered.span_id} maxLength={16} prefix="Span: " /></p>
              <p className="text-text-muted">Status: <span className="font-semibold" style={{ color: STATUS_COLORS[hovered.status] || '#666' }}>{hovered.status}</span></p>
              <p className="text-text-muted">Duration: {formatDuration(hovered.duration_ms)}</p>
            </div>
          )}
        </div>
        {/* Legend */}
        <div className="flex gap-4 mt-4 justify-center">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-text-muted">{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ========================
// Bottleneck Tab (D13)
// ========================
const BottleneckTab = memo(function BottleneckTab({
  data,
  loading,
  fnFilter,
  setFnFilter,
}: BottleneckTabProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-accent-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
        <Timer size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
        <p className="text-sm text-text-muted">{t('analysis.noData')}</p>
        <p className="text-xs text-text-muted/60 mt-2">{t('analysis.bottleneckEmptyHint')}</p>
      </div>
    );
  }

  const maxDur = Math.max(...data.map((c) => c.avg_duration_ms), 1);

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="bg-bg-card border border-border-default rounded-[14px] px-4 py-3 card-shadow">
        <p className="text-xs text-text-secondary leading-relaxed">
          {t('analysis.bottleneckDesc')}
        </p>
      </div>

      {/* Filter input */}
      <div>
        <input
          type="text"
          value={fnFilter}
          onChange={(e) => setFnFilter(e.target.value)}
          placeholder={t('analysis.functionNamePlaceholder')}
          className={cn(
            'w-full max-w-sm px-4 py-2 bg-bg-input border border-border-default rounded-[10px]',
            'text-xs text-text-primary placeholder:text-text-muted',
            'focus:border-accent-primary focus-visible:ring-2 focus-visible:ring-accent-primary/50 outline-none transition-colors'
          )}
        />
      </div>

      {/* Bar chart */}
      <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
        <h3 className="text-sm font-medium text-text-secondary mb-4">{t('analysis.bottleneck')}</h3>
        <div className="space-y-3">
          {data.map((cluster) => (
            <div key={cluster.cluster_id} className="flex items-center gap-3">
              <div className="w-20 text-xs text-text-muted shrink-0">
                {t('analysis.cluster')} {cluster.cluster_id}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-7 bg-bg-elevated rounded-[6px] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-[6px] transition-[width] duration-500',
                      cluster.is_bottleneck ? 'bg-status-error' : 'bg-accent-secondary'
                    )}
                    style={{ width: `${(cluster.avg_duration_ms / maxDur) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-text-secondary font-mono whitespace-nowrap shrink-0">
                  {formatDuration(cluster.avg_duration_ms)}
                </span>
              </div>
              <div className="w-14 text-xs text-text-muted text-right shrink-0">
                {cluster.count} {t('analysis.executionsLabel')}
              </div>
              {cluster.is_bottleneck && (
                <span className="text-[10px] px-2 py-0.5 rounded-[8px] font-semibold bg-status-error-dim text-status-error shrink-0">
                  {t('analysis.isBottleneck')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cluster details table */}
      <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
        <div className="px-5 py-3 border-b border-border-default">
          <h3 className="text-sm font-medium text-text-secondary">{t('analysis.clusterCount')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.columnCluster')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.columnAvgDuration')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.columnCount')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.columnRepresentative')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.columnStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((cluster) => (
                <tr key={cluster.cluster_id} className="border-b border-border-default hover:bg-bg-card-hover transition-colors">
                  <td className="px-5 py-3.5 text-sm text-text-primary font-mono">#{cluster.cluster_id}</td>
                  <td className="px-5 py-3.5 text-sm text-text-secondary font-mono">{formatDuration(cluster.avg_duration_ms)}</td>
                  <td className="px-5 py-3.5 text-sm text-text-secondary">{cluster.count}</td>
                  <td className="px-5 py-3.5 text-sm text-text-muted truncate max-w-[200px]" title={cluster.representative_input}>{cluster.representative_input}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      'text-[11px] px-2 py-0.5 rounded-[8px] font-semibold',
                      cluster.is_bottleneck ? 'bg-status-error-dim text-status-error' : 'bg-accent-secondary-dim text-accent-secondary'
                    )}>
                      {cluster.is_bottleneck ? t('analysis.bottleneckLabel') : t('analysis.normalLabel')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

// ========================
// Error Clusters Tab (C9)
// ========================
const ErrorClustersTab = memo(function ErrorClustersTab({
  data,
  loading,
}: ErrorClustersTabProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-accent-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
        <Layers size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
        <p className="text-sm text-text-muted">{t('analysis.noData')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Description */}
      <div className="bg-bg-card border border-border-default rounded-[14px] px-4 py-3 card-shadow">
        <p className="text-xs text-text-secondary leading-relaxed">
          {t('analysis.errorClustersDesc')}
        </p>
      </div>
      {data.map((cluster) => (
        <div key={cluster.cluster_id} className="bg-bg-card border border-border-default rounded-[16px] p-5 card-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-[8px] font-semibold bg-status-error-dim text-status-error">
                {t('analysis.cluster')} #{cluster.cluster_id}
              </span>
              <span className="text-xs text-text-muted">{cluster.count} {t('analysis.errors')}</span>
            </div>
          </div>

          {/* Representative error */}
          <div className="mb-3">
            <p className="text-[10px] text-text-muted mb-1">{t('analysis.representativeError')}</p>
            <p className="text-xs text-status-error bg-status-error-dim/50 rounded-[8px] px-3 py-2 font-mono break-all">
              {cluster.representative_error}
            </p>
          </div>

          {/* Error codes */}
          {cluster.error_codes.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] text-text-muted mb-1">{t('analysis.errorCodes')}</p>
              <div className="flex gap-1 flex-wrap">
                {cluster.error_codes.map((code) => (
                  <span key={code} className="text-[10px] px-2 py-0.5 bg-bg-elevated rounded-md text-text-secondary font-mono">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Functions */}
          {cluster.functions.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted mb-1">{t('analysis.functions')}</p>
              <div className="flex gap-1 flex-wrap">
                {cluster.functions.map((fn) => (
                  <span key={fn} className="text-[10px] px-2 py-0.5 bg-accent-secondary-dim rounded-md text-accent-secondary">
                    {fn}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

// ========================
// Drift Tab
// ========================
const DriftTab = memo(function DriftTab({
  driftItems,
  loadingDrift,
  simFn,
  setSimFn,
  simText,
  setSimText,
  simResult,
  simulateMutation,
}: DriftTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
        <div className="px-5 py-3 border-b border-border-default">
          <h3 className="text-sm font-medium text-text-secondary">{t('analysis.driftSummary')}</h3>
        </div>
        {loadingDrift ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-accent-primary" /></div>
        ) : driftItems.length === 0 ? (
          <div className="text-center py-12 text-sm text-text-muted">{t('analysis.noDriftData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.columnFunction')}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.columnStatus')}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.avgDistance')}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.columnThreshold')}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.columnSamples')}</th>
                </tr>
              </thead>
              <tbody>
                {driftItems.map((item) => {
                  const style = DRIFT_COLORS[item.status] || DRIFT_COLORS.NO_VECTOR;
                  return (
                    <tr key={item.function_name} className="border-b border-border-default hover:bg-bg-card-hover transition-colors">
                      <td className="px-5 py-3.5 text-sm text-text-primary font-medium">{item.function_name}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-[8px] font-semibold', style.bg, style.text)}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary font-mono">{(item.avg_distance ?? 0).toFixed(4)}</td>
                      <td className="px-5 py-3.5 text-sm text-text-muted font-mono">{(item.threshold ?? 0).toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-sm text-text-muted">{item.sample_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drift simulator */}
      <div className="bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
        <h3 className="text-sm font-medium text-text-secondary mb-4">{t('analysis.driftSimulator')}</h3>
        <div className="space-y-3">
          <select
            value={simFn}
            onChange={(e) => setSimFn(e.target.value)}
            className={cn(
              'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
              'text-sm text-text-primary',
              'focus:border-accent-primary focus-visible:ring-2 focus-visible:ring-accent-primary/50 outline-none transition-colors'
            )}
          >
            <option value="">{t('analysis.functionNamePlaceholder')}</option>
            {driftItems.map((item) => (
              <option key={item.function_name} value={item.function_name}>
                {item.function_name} ({item.status})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={simText}
              onChange={(e) => setSimText(e.target.value)}
              placeholder={t('analysis.inputTextPlaceholder')}
              className={cn(
                'flex-1 px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-accent-primary focus-visible:ring-2 focus-visible:ring-accent-primary/50 outline-none transition-colors'
              )}
            />
            <button
              onClick={() => simulateMutation.mutate()}
              disabled={!simFn || !simText || simulateMutation.isPending}
              aria-label="Simulate drift"
              className="px-4 py-2.5 bg-accent-primary text-text-inverse rounded-[12px] text-sm font-medium hover:brightness-110 disabled:opacity-40 transition-[opacity,filter] focus-visible:ring-2 focus-visible:ring-accent-primary/50"
            >
              {simulateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>

          {simResult && (
            <div className={cn(
              'rounded-[14px] p-4 border',
              simResult.is_drift
                ? 'bg-status-error-dim border-status-error/20'
                : 'bg-accent-secondary-dim border-accent-secondary/20'
            )}>
              <div className="flex items-center gap-2 mb-2">
                {simResult.is_drift ? (
                  <AlertTriangle size={16} className="text-status-error" />
                ) : (
                  <CheckCircle2 size={16} className="text-accent-secondary" />
                )}
                <span className={cn('text-sm font-semibold', simResult.is_drift ? 'text-status-error' : 'text-accent-secondary')}>
                  {simResult.is_drift ? t('analysis.driftDetected') : t('analysis.normal')}
                </span>
                <span className="text-xs text-text-muted ml-auto">
                  Distance: {(simResult.avg_distance ?? 0).toFixed(4)} / Threshold: {(simResult.threshold ?? 0).toFixed(2)}
                </span>
              </div>
              {simResult.is_drift && (
                <p className="text-xs text-text-muted mt-2">
                  {t('analysis.driftRecommendation', 'Consider reviewing golden responses for this function. Input patterns may have shifted significantly.')}
                </p>
              )}
              {(simResult.neighbors || []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs text-text-muted">Nearest Neighbors:</p>
                  {(simResult.neighbors || []).map((n) => (
                    <div key={n.span_id} className="flex items-center justify-between text-xs bg-bg-primary/30 rounded-[8px] px-3 py-2">
                      <TruncatedText text={n.span_id || ''} maxLength={12} mono className="text-text-secondary" />
                      <span className="text-text-muted">dist: {(n.distance ?? 0).toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ========================
// Shared components
// ========================
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-bg-card border border-border-default rounded-[16px] p-4 card-shadow">
      <div className={cn('w-8 h-8 rounded-[10px] flex items-center justify-center mb-2', bg)}>
        <Icon size={16} className={color} />
      </div>
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <p className={cn('text-xl font-bold', color)}>{value}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs text-text-secondary flex-1">{label}</span>
      <span className="text-xs text-text-primary font-medium">{formatNumber(value)}</span>
    </div>
  );
}

// ========================
// Main Page Component
// ========================
export default function AnalysisPage() {
  const { t } = useTranslation();
  const { timeRangeMinutes } = useDashboardStore();

  const activeTab = usePagePreferencesStore((s) => s.analysisActiveTab) as TabKey;
  const setActiveTab = usePagePreferencesStore((s) => s.setAnalysisActiveTab);
  const [simFn, setSimFn] = useState('');
  const [simText, setSimText] = useState('');
  const [simResult, setSimResult] = useState<DriftSimulationResult | null>(null);
  const [scatterFnFilter, setScatterFnFilter] = useState<string>('');
  const [bottleneckFnFilter, setBottleneckFnFilter] = useState<string>('');

  // Debounce text inputs that trigger API queries
  const debouncedBottleneckFnFilter = useDebounce(bottleneckFnFilter, 300);
  const debouncedScatterFnFilter = useDebounce(scatterFnFilter, 300);

  // Cache analytics
  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['cacheAnalytics', timeRangeMinutes],
    queryFn: () => cacheService.analytics(timeRangeMinutes),
    refetchInterval: 60_000,
  });

  // Token usage
  const { data: tokenData } = useQuery({
    queryKey: ['tokenUsage'],
    queryFn: () => analyticsService.tokens(),
    enabled: activeTab === 'costSavings' || activeTab === 'overview',
    refetchInterval: 60_000,
  });

  // KPI
  const { data: kpiData } = useQuery({
    queryKey: ['kpi', timeRangeMinutes],
    queryFn: () => analyticsService.kpi(timeRangeMinutes),
    enabled: activeTab === 'costSavings' || activeTab === 'overview',
    refetchInterval: 60_000,
  });

  // Drift
  const { data: driftData, isLoading: loadingDrift } = useQuery({
    queryKey: ['driftSummary'],
    queryFn: () => cacheService.driftSummary(),
    enabled: activeTab === 'drift' || activeTab === 'overview',
    refetchInterval: 60_000,
  });

  const simulateMutation = useMutation({
    mutationFn: () => cacheService.driftSimulate({ text: simText, function_name: simFn }),
    onSuccess: (result) => setSimResult(result),
  });

  // Semantic: Input Scatter (always fetch all, filter client-side)
  const { data: scatterDataRaw, isLoading: loadingScatter } = useQuery({
    queryKey: ['semanticScatter'],
    queryFn: () => semanticService.scatter(undefined, 500),
    enabled: activeTab === 'inputScatter',
    refetchInterval: 60_000,
  });

  const scatterData = useMemo(
    () =>
      debouncedScatterFnFilter
        ? (scatterDataRaw || []).filter((d) => d.function_name === debouncedScatterFnFilter)
        : scatterDataRaw || [],
    [scatterDataRaw, debouncedScatterFnFilter]
  );

  const allScatterFunctions = useMemo(
    () => [...new Set((scatterDataRaw || []).map((d) => d.function_name))].filter(Boolean),
    [scatterDataRaw]
  );

  // Semantic: Bottleneck (debounced filter triggers API query)
  const { data: bottleneckData, isLoading: loadingBottleneck } = useQuery({
    queryKey: ['semanticBottleneck', debouncedBottleneckFnFilter],
    queryFn: () => semanticService.bottleneck(debouncedBottleneckFnFilter || undefined, 5),
    enabled: activeTab === 'bottleneck',
    refetchInterval: 60_000,
  });

  // Semantic: Error Clusters
  const { data: errorClusterData, isLoading: loadingErrorClusters } = useQuery({
    queryKey: ['semanticErrorClusters'],
    queryFn: () => semanticService.errorClusters(5),
    enabled: activeTab === 'errorClusters',
    refetchInterval: 60_000,
  });

  const driftItems = driftData?.items || [];

  // Cost savings calculations
  const costCalc = useMemo(() => {
    if (!analytics?.has_data) return null;
    const totalTokens = tokenData?.total_tokens ?? 0;
    const totalExec = kpiData?.total_executions ?? analytics.total_executions;
    const avgTokensPerExec = totalExec > 0 ? totalTokens / totalExec : 0;
    const tokensSaved = analytics.cache_hit_count * avgTokensPerExec;
    const costSaved = (tokensSaved * BLENDED_RATE) / 1_000_000;
    return { tokensSaved, costSaved, avgTokensPerExec };
  }, [analytics, tokenData, kpiData]);

  const tabs: { key: TabKey; labelKey: string; icon?: React.ComponentType<{ size: number; className?: string }> }[] = [
    { key: 'overview', labelKey: 'analysis.overview', icon: Layers },
    { key: 'cacheReport', labelKey: 'analysis.cacheReport', icon: Database },
    { key: 'costSavings', labelKey: 'analysis.costSavings', icon: DollarSign },
    { key: 'inputScatter', labelKey: 'analysis.inputScatter', icon: ScatterChart },
    { key: 'bottleneck', labelKey: 'analysis.bottleneck', icon: Timer },
    { key: 'errorClusters', labelKey: 'analysis.errorClusters', icon: AlertTriangle },
    { key: 'drift', labelKey: 'analysis.drift', icon: TrendingUp },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">{t('analysis.title')}</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                  activeTab === tab.key ? 'bg-accent-primary text-text-inverse' : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* === Overview Tab === */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tabs.filter(t => t.key !== 'overview').map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow hover:border-accent-primary/40 transition-colors text-left group"
              >
                <div className="flex items-center gap-3 mb-3">
                  {Icon && <Icon size={18} className="text-accent-primary" />}
                  <h3 className="text-sm font-semibold text-text-primary">{t(tab.labelKey)}</h3>
                </div>
                <p className="text-xs text-text-muted mb-3">
                  {tab.key === 'cacheReport' && (analytics?.has_data
                    ? `${formatPercentage(analytics.cache_hit_rate)} hit rate, ${formatNumber(analytics.total_executions)} executions`
                    : t('analysis.noDataYet') || 'No data yet')}
                  {tab.key === 'costSavings' && (costCalc
                    ? `~$${costCalc.costSaved.toFixed(2)} saved, ${formatNumber(Math.round(costCalc.tokensSaved))} tokens`
                    : t('analysis.noDataYet') || 'No data yet')}
                  {tab.key === 'inputScatter' && (t('analysis.inputScatterDesc') || 'Visualize input vector distribution')}
                  {tab.key === 'bottleneck' && (t('analysis.bottleneckDesc') || 'Identify slow execution clusters')}
                  {tab.key === 'errorClusters' && (t('analysis.errorClustersDesc') || 'Group similar errors by pattern')}
                  {tab.key === 'drift' && `${driftItems.length} functions monitored`}
                </p>
                <span className="text-[11px] text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('analysis.viewDetail') || 'View detail →'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* === Cache Report Tab === */}
      {activeTab === 'cacheReport' && (
        <CacheReportTab analytics={analytics} loading={loadingAnalytics} />
      )}

      {/* === Cost Savings Tab === */}
      {activeTab === 'costSavings' && (
        <CostSavingsTab
          analytics={analytics}
          costCalc={costCalc}
          loading={loadingAnalytics}
        />
      )}

      {/* === Input Scatter Tab === */}
      {activeTab === 'inputScatter' && (
        <InputScatterTab
          data={scatterData}
          allFunctions={allScatterFunctions}
          loading={loadingScatter}
          fnFilter={scatterFnFilter}
          setFnFilter={setScatterFnFilter}
        />
      )}

      {/* === Bottleneck Tab === */}
      {activeTab === 'bottleneck' && (
        <BottleneckTab
          data={bottleneckData || []}
          loading={loadingBottleneck}
          fnFilter={bottleneckFnFilter}
          setFnFilter={setBottleneckFnFilter}
        />
      )}

      {/* === Error Clusters Tab === */}
      {activeTab === 'errorClusters' && (
        <ErrorClustersTab
          data={errorClusterData || []}
          loading={loadingErrorClusters}
        />
      )}

      {/* === Drift Tab === */}
      {activeTab === 'drift' && (
        <DriftTab
          driftItems={driftItems}
          loadingDrift={loadingDrift}
          simFn={simFn}
          setSimFn={setSimFn}
          simText={simText}
          setSimText={setSimText}
          simResult={simResult}
          simulateMutation={simulateMutation}
        />
      )}
    </div>
  );
}
