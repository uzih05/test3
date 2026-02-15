'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics';
import { cn } from '@/lib/utils';

const BAR_COLORS = ['#DFFF00', '#00FFCC', '#3B82F6', '#FF9F43', '#FF4D6A', '#A855F7', '#EF4444', '#14B8A6', '#F59E0B', '#6366F1'];

export function FunctionDistribution() {
  const { data, isLoading } = useQuery({
    queryKey: ['functionDist'],
    queryFn: () => analyticsService.functionDistribution(10),
  });

  if (isLoading || !data) {
    return <div className="h-[200px] flex items-center justify-center animate-pulse text-text-muted text-sm">Loading...</div>;
  }

  if (data.length === 0) {
    return <div className="h-[200px] flex items-center justify-center text-text-muted text-sm">No data</div>;
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="space-y-2.5">
      {data.map((item, i) => (
        <div key={item.function_name} className="group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary truncate max-w-[60%]">{item.function_name}</span>
            <span className="text-xs text-text-muted">{item.count}</span>
          </div>
          <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.count / maxCount) * 100}%`,
                background: BAR_COLORS[i % BAR_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
