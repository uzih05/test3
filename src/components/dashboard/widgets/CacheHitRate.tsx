'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { formatPercentage } from '@/lib/utils';

export function CacheHitRate() {
  const { t } = useTranslation();
  const { timeRangeMinutes } = useDashboardStore();

  const { data, isLoading } = useQuery({
    queryKey: ['kpi', timeRangeMinutes],
    queryFn: () => analyticsService.kpi(timeRangeMinutes),
  });

  if (isLoading || !data) {
    return <div className="h-[120px] flex items-center justify-center animate-pulse text-text-muted text-sm">{t('common.loading')}</div>;
  }

  const rate = data.total_executions > 0
    ? (data.cache_hit_count / data.total_executions) * 100
    : 0;

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#222" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke="#00FFCC"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-neon-cyan">{formatPercentage(rate)}</span>
        </div>
      </div>
      <p className="text-xs text-text-muted mt-2">
        {data.cache_hit_count} / {data.total_executions} {t('dashboard.hits')}
      </p>
    </div>
  );
}
