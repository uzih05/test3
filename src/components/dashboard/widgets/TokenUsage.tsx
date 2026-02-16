'use client';

import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { analyticsService } from '@/services/analytics';
import { useTranslation } from '@/lib/i18n';
import { formatNumber } from '@/lib/utils';

const COLORS = ['#DFFF00', '#00FFCC', '#3B82F6', '#FF9F43', '#FF4D6A'];

export function TokenUsage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => analyticsService.tokens(),
  });

  if (isLoading || !data) {
    return <div className="h-[200px] flex items-center justify-center text-text-muted text-sm animate-pulse">{t('common.loading')}</div>;
  }

  const chartData = Object.entries(data.by_category || {}).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div>
      <div className="text-center mb-2">
        <p className="text-2xl font-bold text-neon-lime">{formatNumber(data.total_tokens)}</p>
        <p className="text-xs text-text-muted">{t('dashboard.totalTokens')}</p>
      </div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'var(--color-text-primary)',
              }}
              formatter={(value) => formatNumber(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[160px] flex items-center justify-center text-text-muted text-sm">{t('common.noData')}</div>
      )}
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {chartData.map((item, i) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-xs text-text-muted capitalize">{item.name.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
