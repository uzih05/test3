'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics';
import { useDashboardStore } from '@/stores/dashboardStore';
import { SurferChart } from '@/components/charts/SurferChart';

export function ExecutionTimeline() {
  const { timeRangeMinutes } = useDashboardStore();

  const bucket = timeRangeMinutes <= 60 ? 5 : timeRangeMinutes <= 360 ? 15 : timeRangeMinutes <= 1440 ? 60 : 360;

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', timeRangeMinutes, bucket],
    queryFn: () => analyticsService.timeline(timeRangeMinutes, bucket),
  });

  if (isLoading || !data) {
    return <div className="h-[220px] flex items-center justify-center animate-pulse text-text-muted text-sm">Loading...</div>;
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
        { key: 'value', label: 'Success', color: '#DFFF00' },
        { key: 'value2', label: 'Error', color: '#FF4D6A' },
        { key: 'value3', label: 'Cache Hit', color: '#00FFCC' },
      ]}
    />
  );
}
