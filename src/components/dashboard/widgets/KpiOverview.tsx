'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, AlertTriangle, Database, Clock } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { formatNumber, formatDuration, formatPercentage, cn } from '@/lib/utils';

export function KpiOverview() {
  const { timeRangeMinutes } = useDashboardStore();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['kpi', timeRangeMinutes],
    queryFn: () => analyticsService.kpi(timeRangeMinutes),
    refetchInterval: 15_000,
  });

  if (isLoading || !data) {
    return <KpiSkeleton />;
  }

  const cards = [
    {
      label: t('dashboard.kpi.total'),
      value: formatNumber(data.total_executions),
      icon: Activity,
      color: 'text-neon-lime',
      bg: 'bg-neon-lime-dim',
    },
    {
      label: t('dashboard.kpi.successRate'),
      value: formatPercentage(data.success_rate),
      icon: CheckCircle2,
      color: 'text-neon-cyan',
      bg: 'bg-neon-cyan-dim',
    },
    {
      label: t('dashboard.kpi.errors'),
      value: formatNumber(data.error_count),
      icon: AlertTriangle,
      color: 'text-neon-red',
      bg: 'bg-neon-red-dim',
    },
    {
      label: t('dashboard.kpi.cacheHit'),
      value: data.total_executions > 0
        ? formatPercentage((data.cache_hit_count / data.total_executions) * 100)
        : '0%',
      icon: Database,
      color: 'text-neon-cyan',
      bg: 'bg-neon-cyan-dim',
    },
    {
      label: t('dashboard.kpi.avgDuration'),
      value: formatDuration(data.avg_duration_ms),
      icon: Clock,
      color: 'text-neon-orange',
      bg: 'bg-[rgba(255,159,67,0.15)]',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-bg-elevated rounded-[14px] p-4">
            <div className={cn('w-8 h-8 rounded-[10px] flex items-center justify-center mb-3', card.bg)}>
              <Icon size={16} className={card.color} />
            </div>
            <p className="text-xs text-text-muted mb-1">{card.label}</p>
            <p className={cn('text-xl font-bold', card.color)}>{card.value}</p>
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
