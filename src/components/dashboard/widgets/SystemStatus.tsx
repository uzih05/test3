'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Code2 } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { timeAgo, cn } from '@/lib/utils';

export function SystemStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['status'],
    queryFn: () => analyticsService.status(),
  });

  if (isLoading || !data) {
    return <div className="h-[120px] flex items-center justify-center animate-pulse text-text-muted text-sm">Loading...</div>;
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
          <p className="text-sm text-text-primary">Database</p>
          <p className={cn('text-xs', data.db_connected ? 'text-neon-cyan' : 'text-neon-red')}>
            {data.db_connected ? 'Connected' : 'Disconnected'}
          </p>
        </div>
      </div>

      {/* Functions */}
      <div className="flex items-center gap-3">
        <Code2 size={20} className="text-neon-lime shrink-0" />
        <div>
          <p className="text-sm text-text-primary">Registered Functions</p>
          <p className="text-xs text-neon-lime">{data.registered_functions_count}</p>
        </div>
      </div>

      {/* Last check */}
      <p className="text-xs text-text-muted">
        Last checked: {timeAgo(data.last_checked)}
      </p>
    </div>
  );
}
