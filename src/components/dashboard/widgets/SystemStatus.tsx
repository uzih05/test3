'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Code2 } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { useTranslation } from '@/lib/i18n';
import { timeAgo, cn } from '@/lib/utils';

export function SystemStatus() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['status'],
    queryFn: () => analyticsService.status(),
  });

  if (isLoading || !data) {
    return <div className="h-[120px] flex items-center justify-center animate-pulse text-text-muted text-sm">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* DB Status */}
      <div className="flex items-center gap-3">
        {data.db_connected ? (
          <CheckCircle2 size={20} className="text-neon-cyan shrink-0" />
        ) : (
          <XCircle size={20} className="text-neon-red shrink-0" />
        )}
        <div>
          <p className="text-sm text-text-primary">{t('dashboard.database')}</p>
          <p className={cn('text-xs', data.db_connected ? 'text-neon-cyan' : 'text-neon-red')}>
            {data.db_connected ? t('dashboard.connected') : t('dashboard.disconnected')}
          </p>
        </div>
      </div>

      {/* Functions */}
      <div className="flex items-center gap-3">
        <Code2 size={20} className="text-neon-lime shrink-0" />
        <div>
          <p className="text-sm text-text-primary">{t('dashboard.registeredFunctions')}</p>
          <p className="text-xs text-neon-lime">{data.registered_functions_count}</p>
        </div>
      </div>

      {/* Last check */}
      <p className="text-xs text-text-muted">
        {t('dashboard.lastChecked')}: {timeAgo(data.last_checked)}
      </p>
    </div>
  );
}
