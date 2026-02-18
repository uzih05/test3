'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, AlertTriangle, Database, Clock } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { formatNumber, formatDuration, formatPercentage, cn } from '@/lib/utils';
import { Sparkline } from '@/components/Sparkline';
import { TrendIndicator } from '@/components/TrendIndicator';
import { useChartColors } from '@/lib/hooks/useChartColors';

export function KpiOverview() {
  const { timeRangeMinutes } = useDashboardStore();
  const { t } = useTranslation();
  const chartColors = useChartColors();

  const { data: compareData, isLoading } = useQuery({
    queryKey: ['kpi-compare', timeRangeMinutes],
    queryFn: () => analyticsService.kpiCompare(timeRangeMinutes),
    refetchInterval: 15_000,
  });

  const bucket = timeRangeMinutes <= 60 ? 5 : timeRangeMinutes <= 360 ? 15 : timeRangeMinutes <= 1440 ? 60 : 360;
  const { data: timeline } = useQuery({
    queryKey: ['kpi-timeline', timeRangeMinutes, bucket],
    queryFn: () => analyticsService.timeline(timeRangeMinutes, bucket),
    refetchInterval: 15_000,
  });

  const data = compareData?.current;
  const prev = compareData?.previous;

  const sparkTotal = useMemo(
    () => (timeline || []).map(e => e.success + e.error),
    [timeline]
  );
  const sparkSuccess = useMemo(
    () => (timeline || []).map(e => {
      const total = e.success + e.error;
      return total > 0 ? (e.success / total) * 100 : 100;
    }),
    [timeline]
  );
  const sparkErrors = useMemo(
    () => (timeline || []).map(e => e.error),
    [timeline]
  );
  const sparkCache = useMemo(
    () => (timeline || []).map(e => e.cache_hit),
    [timeline]
  );
  const sparkAvgDuration = useMemo(
    () => (timeline || []).map(e => e.avg_duration_ms),
    [timeline]
  );

  if (isLoading || !data) {
    return <KpiSkeleton />;
  }

  const cards = [
    {
      label: t('dashboard.kpi.total'),
      value: formatNumber(data.total_executions),
      icon: Activity,
      color: 'text-accent-primary',
      bg: 'bg-accent-primary-dim',
      sparkColor: chartColors.accentPrimary,
      spark: sparkTotal,
      current: data.total_executions,
      previous: prev?.total_executions ?? 0,
      invertColor: false,
      ariaLabel: 'Total executions trend',
    },
    {
      label: t('dashboard.kpi.successRate'),
      value: formatPercentage(data.success_rate),
      icon: CheckCircle2,
      color: 'text-accent-secondary',
      bg: 'bg-accent-secondary-dim',
      sparkColor: chartColors.accentSecondary,
      spark: sparkSuccess,
      current: data.success_rate,
      previous: prev?.success_rate ?? 0,
      invertColor: false,
      ariaLabel: 'Success rate trend',
    },
    {
      label: t('dashboard.kpi.errors'),
      value: formatNumber(data.error_count),
      icon: AlertTriangle,
      color: 'text-status-error',
      bg: 'bg-status-error-dim',
      sparkColor: chartColors.statusError,
      spark: sparkErrors,
      current: data.error_count,
      previous: prev?.error_count ?? 0,
      invertColor: true,
      ariaLabel: 'Error count trend',
    },
    {
      label: t('dashboard.kpi.cacheHit'),
      value: data.total_executions > 0
        ? formatPercentage((data.cache_hit_count / data.total_executions) * 100)
        : '0%',
      icon: Database,
      color: 'text-accent-secondary',
      bg: 'bg-accent-secondary-dim',
      sparkColor: chartColors.accentSecondary,
      spark: sparkCache,
      current: data.cache_hit_count,
      previous: prev?.cache_hit_count ?? 0,
      invertColor: false,
      ariaLabel: 'Cache hit trend',
    },
    {
      label: t('dashboard.kpi.avgDuration'),
      value: formatDuration(data.avg_duration_ms),
      icon: Clock,
      color: 'text-status-warning',
      bg: 'bg-status-warning-dim',
      sparkColor: chartColors.statusWarning,
      spark: sparkAvgDuration,
      current: data.avg_duration_ms,
      previous: prev?.avg_duration_ms ?? 0,
      invertColor: true,
      ariaLabel: 'Average duration trend',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-bg-elevated rounded-[14px] p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={cn('w-8 h-8 rounded-[10px] flex items-center justify-center', card.bg)}>
                <Icon size={16} className={card.color} />
              </div>
              {card.spark.length >= 2 && (
                <Sparkline
                  data={card.spark}
                  color={card.sparkColor}
                  width={64}
                  height={20}
                  className="opacity-60"
                  ariaLabel={card.ariaLabel}
                />
              )}
            </div>
            <p className="text-xs text-text-muted mb-1">{card.label}</p>
            <div className="flex items-baseline gap-2">
              <p className={cn('text-xl font-bold', card.color)}>{card.value}</p>
              <TrendIndicator
                current={card.current}
                previous={card.previous}
                invertColor={card.invertColor}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-bg-elevated rounded-[14px] p-4 animate-pulse">
          <div className="w-8 h-8 rounded-[10px] bg-bg-card mb-3" />
          <div className="w-16 h-3 bg-bg-card rounded mb-2" />
          <div className="w-12 h-6 bg-bg-card rounded" />
        </div>
      ))}
    </div>
  );
}
