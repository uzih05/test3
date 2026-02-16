'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { executionsService } from '@/services/executions';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { timeAgo, cn } from '@/lib/utils';

export function RecentErrors() {
  const { t } = useTranslation();
  const { timeRangeMinutes } = useDashboardStore();

  const { data, isLoading } = useQuery({
    queryKey: ['recentErrors', timeRangeMinutes],
    queryFn: () => executionsService.recentErrors(timeRangeMinutes, 10),
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <div className="h-[200px] flex items-center justify-center animate-pulse text-text-muted text-sm">{t('common.loading')}</div>;
  }

  const items = data?.items || [];

  if (items.length === 0) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center text-text-muted">
        <AlertTriangle size={24} className="mb-2 opacity-40" />
        <p className="text-sm">{t('dashboard.noRecentErrors')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[260px] overflow-y-auto">
      {items.map((err) => (
        <div
          key={err.span_id}
          className="bg-bg-elevated rounded-[12px] px-3.5 py-2.5 border border-border-default"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-primary truncate max-w-[60%]">
              {err.function_name}
            </span>
            <span className="text-[10px] text-text-muted">{timeAgo(err.timestamp_utc)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 bg-neon-red-dim text-neon-red rounded-md font-medium">
              {err.error_code || 'ERROR'}
            </span>
            <span className="text-xs text-text-muted truncate">{err.error_message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
