'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { cacheService } from '@/services/cache';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import { formatNumber, formatDuration, formatPercentage, cn } from '@/lib/utils';
import type { DriftSimulationResult } from '@/types';

const DRIFT_COLORS: Record<string, { bg: string; text: string }> = {
  ANOMALY: { bg: 'bg-neon-red-dim', text: 'text-neon-red' },
  NORMAL: { bg: 'bg-neon-cyan-dim', text: 'text-neon-cyan' },
  INSUFFICIENT_DATA: { bg: 'bg-[rgba(255,159,67,0.15)]', text: 'text-neon-orange' },
  NO_VECTOR: { bg: 'bg-bg-elevated', text: 'text-text-muted' },
};

export default function CachePage() {
  const { t } = useTranslation();
  const { timeRangeMinutes } = useDashboardStore();

  const [activeTab, setActiveTab] = useState<'analytics' | 'drift'>('analytics');
  const [simFn, setSimFn] = useState('');
  const [simText, setSimText] = useState('');
  const [simResult, setSimResult] = useState<DriftSimulationResult | null>(null);

  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['cacheAnalytics', timeRangeMinutes],
    queryFn: () => cacheService.analytics(timeRangeMinutes),
  });

  const { data: driftData, isLoading: loadingDrift } = useQuery({
    queryKey: ['driftSummary'],
    queryFn: () => cacheService.driftSummary(),
    enabled: activeTab === 'drift',
  });

  const simulateMutation = useMutation({
    mutationFn: () => cacheService.driftSimulate({ text: simText, function_name: simFn }),
    onSuccess: (result) => setSimResult(result),
  });

  const driftItems = driftData?.items || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">{t('cache.title')}</h1>
        <div className="flex items-center gap-2">
          <TimeRangeSelector />
          <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
            {(['analytics', 'drift'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors capitalize',
                  activeTab === tab ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t(`cache.${tab}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'analytics' ? (
        /* === Analytics Tab === */
        <div>
          {loadingAnalytics ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-neon-lime" /></div>
          ) : !analytics || !analytics.has_data ? (
            <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
              <Database size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
              <p className="text-sm text-text-muted">No cache data in this time range</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  icon={TrendingUp}
                  label={t('cache.hitRate')}
                  value={formatPercentage(analytics.cache_hit_rate)}
                  sub={`${analytics.cache_hit_count} / ${analytics.total_executions}`}
                  color="text-neon-cyan"
                  bg="bg-neon-cyan-dim"
                />
                <StatCard
                  icon={Clock}
                  label={t('cache.timeSaved')}
                  value={formatDuration(analytics.time_saved_ms)}
                  sub={`Avg: ${formatDuration(analytics.avg_cached_duration_ms)}`}
                  color="text-neon-lime"
                  bg="bg-neon-lime-dim"
                />
                <StatCard
                  icon={Star}
                  label="Golden Hits"
                  value={formatNumber(analytics.golden_hit_count)}
                  sub={`${formatPercentage(analytics.golden_ratio)} of hits`}
                  color="text-neon-orange"
                  bg="bg-[rgba(255,159,67,0.15)]"
                />
                <StatCard
                  icon={Database}
                  label="Standard Hits"
                  value={formatNumber(analytics.standard_hit_count)}
                  sub={`${analytics.total_executions} total`}
                  color="text-text-secondary"
                  bg="bg-bg-elevated"
                />
              </div>

              {/* Hit rate gauge */}
              <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
                <h3 className="text-sm font-medium text-text-secondary mb-4">Cache Hit Breakdown</h3>
                <div className="flex items-center gap-4">
                  {/* Ring */}
                  <div className="relative w-32 h-32 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#1e1e1e" strokeWidth="10" />
                      {/* Standard hits */}
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="#00FFCC" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - analytics.cache_hit_rate / 100)}`}
                        className="transition-all duration-700"
                      />
                      {/* Golden portion */}
                      {analytics.golden_ratio > 0 && (
                        <circle
                          cx="50" cy="50" r="42" fill="none" stroke="#DFFF00" strokeWidth="10" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 42}`}
                          strokeDashoffset={`${2 * Math.PI * 42 * (1 - (analytics.golden_ratio * analytics.cache_hit_rate / 10000))}`}
                          className="transition-all duration-700"
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-neon-cyan">{formatPercentage(analytics.cache_hit_rate)}</span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-3 flex-1">
                    <LegendItem color="#00FFCC" label="Standard Cache" value={analytics.standard_hit_count} />
                    <LegendItem color="#DFFF00" label="Golden Cache" value={analytics.golden_hit_count} />
                    <LegendItem color="#333" label="Cache Miss" value={analytics.total_executions - analytics.cache_hit_count} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* === Drift Tab === */
        <div className="space-y-4">
          {/* Drift table */}
          <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
            <div className="px-5 py-3 border-b border-border-default">
              <h3 className="text-sm font-medium text-text-secondary">Drift Summary</h3>
            </div>
            {loadingDrift ? (
              <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-neon-lime" /></div>
            ) : driftItems.length === 0 ? (
              <div className="text-center py-12 text-sm text-text-muted">No drift data</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Function</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Avg Distance</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Threshold</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Samples</th>
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
                          <td className="px-5 py-3.5 text-sm text-text-secondary font-mono">{item.avg_distance.toFixed(4)}</td>
                          <td className="px-5 py-3.5 text-sm text-text-muted font-mono">{item.threshold.toFixed(2)}</td>
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
            <h3 className="text-sm font-medium text-text-secondary mb-4">Drift Simulator</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={simFn}
                onChange={(e) => setSimFn(e.target.value)}
                placeholder="Function name..."
                className={cn(
                  'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                  'text-sm text-text-primary placeholder:text-text-muted',
                  'focus:border-neon-lime outline-none transition-colors'
                )}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="Input text to simulate..."
                  className={cn(
                    'flex-1 px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                    'text-sm text-text-primary placeholder:text-text-muted',
                    'focus:border-neon-lime outline-none transition-colors'
                  )}
                />
                <button
                  onClick={() => simulateMutation.mutate()}
                  disabled={!simFn || !simText || simulateMutation.isPending}
                  className="px-4 py-2.5 bg-neon-lime text-text-inverse rounded-[12px] text-sm font-medium hover:brightness-110 disabled:opacity-40 transition-all"
                >
                  {simulateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>

              {/* Simulation result */}
              {simResult && (
                <div className={cn(
                  'rounded-[14px] p-4 border',
                  simResult.is_drift
                    ? 'bg-neon-red-dim border-neon-red/20'
                    : 'bg-neon-cyan-dim border-neon-cyan/20'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {simResult.is_drift ? (
                      <AlertTriangle size={16} className="text-neon-red" />
                    ) : (
                      <CheckCircle2 size={16} className="text-neon-cyan" />
                    )}
                    <span className={cn('text-sm font-semibold', simResult.is_drift ? 'text-neon-red' : 'text-neon-cyan')}>
                      {simResult.is_drift ? 'Drift Detected' : 'Normal'}
                    </span>
                    <span className="text-xs text-text-muted ml-auto">
                      Distance: {simResult.avg_distance.toFixed(4)} / Threshold: {simResult.threshold.toFixed(2)}
                    </span>
                  </div>
                  {simResult.neighbors.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs text-text-muted">Nearest Neighbors:</p>
                      {simResult.neighbors.map((n) => (
                        <div key={n.span_id} className="flex items-center justify-between text-xs bg-bg-primary/30 rounded-[8px] px-3 py-2">
                          <span className="text-text-secondary font-mono">{n.span_id.slice(0, 12)}...</span>
                          <span className="text-text-muted">dist: {n.distance.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
