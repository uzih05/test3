'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { SurferChart } from '@/components/charts/SurferChart';

export function ExecutionTimeline() {
  const { t } = useTranslation();
  const { timeRangeMinutes } = useDashboardStore();

  const bucket = timeRangeMinutes <= 60 ? 5 : timeRangeMinutes <= 360 ? 15 : timeRangeMinutes <= 1440 ? 60 : 360;

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', timeRangeMinutes, bucket],
    queryFn: () => analyticsService.timeline(timeRangeMinutes, bucket),
    refetchInterval: 15_000,
  });

  if (isLoading || !data) {
    return <div className="h-[220px] flex items-center justify-center animate-pulse text-text-muted text-sm">{t('common.loading')}</div>;
  }

  const chartData = data.map((entry) => ({
    label: new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: entry.success,
    value2: entry.error,
    value3: entry.cache_hit,
  }));

  return (
    <SurferChart
      data={chartData}
      color="#DFFF00"
      color2="#FF4D6A"
      color3="#00FFCC"
      height={220}
      legend={[
        { key: 'value', label: t('executions.success'), color: '#DFFF00' },
        { key: 'value2', label: t('executions.error'), color: '#FF4D6A' },
        { key: 'value3', label: t('executions.cacheHit'), color: '#00FFCC' },
      ]}
    />
  );
}
