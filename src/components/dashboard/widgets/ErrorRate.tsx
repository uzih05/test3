'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { formatPercentage, cn } from '@/lib/utils';

export function ErrorRate() {
  const { t } = useTranslation();
  const { timeRangeMinutes } = useDashboardStore();

  const { data, isLoading } = useQuery({
    queryKey: ['kpi', timeRangeMinutes],
    queryFn: () => analyticsService.kpi(timeRangeMinutes),
    refetchInterval: 15_000,
  });

  if (isLoading || !data) {
    return <div className="h-[120px] flex items-center justify-center animate-pulse text-text-muted text-sm">{t('common.loading')}</div>;
  }

  const rate = data.total_executions > 0
    ? (data.error_count / data.total_executions) * 100
    : 0;

  const isHigh = rate > 10;
  const isMedium = rate > 5;

  return (
    <div className="flex flex-col items-center">
      <p className={cn(
        'text-4xl font-bold',
        isHigh ? 'text-neon-red' : isMedium ? 'text-neon-orange' : 'text-neon-cyan'
      )}>
        {formatPercentage(rate)}
      </p>
      <p className="text-xs text-text-muted mt-2">{data.error_count} {t('dashboard.errorsCount')}</p>
      <div className="w-full mt-4 h-2 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700',
            isHigh ? 'bg-neon-red' : isMedium ? 'bg-neon-orange' : 'bg-neon-cyan'
          )}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
    </div>
  );
}
