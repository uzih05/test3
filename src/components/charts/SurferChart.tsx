'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useDashboardStore } from '@/stores/dashboardStore';

interface SurferChartProps {
  data: { label: string; value: number; value2?: number; value3?: number }[];
  color?: string;
  color2?: string;
  color3?: string;
  height?: number;
  showGrid?: boolean;
  legend?: { key: string; label: string; color: string }[];
}

export function SurferChart({
  data,
  color = '#DFFF00',
  color2 = '#FF4D6A',
  color3 = '#00FFCC',
  height = 200,
  showGrid = true,
  legend,
}: SurferChartProps) {
  const { fillMode } = useDashboardStore();

  const getFill = (c: string) => {
    if (fillMode === 'stroke-only') return 'transparent';
    if (fillMode === 'solid') return c + '40';
    return `url(#grad-${c.replace('#', '')})`;
  };

  const hasMulti = data.some((d) => d.value2 !== undefined);
  const hasTriple = data.some((d) => d.value3 !== undefined);

  return (
    <div>
      {legend && (
        <div className="flex items-center gap-4 mb-3 px-1">
          {legend.map((l) => (
            <div key={l.key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              <span className="text-xs text-text-muted">{l.label}</span>
            </div>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            {[color, color2, color3].map((c) => (
              <linearGradient key={c} id={`grad-${c.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.3} />
                <stop offset="100%" stopColor={c} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          )}
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#666' }}
            axisLine={{ stroke: '#222' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#666' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--color-text-primary)',
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={getFill(color)}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
          {hasMulti && (
            <Area
              type="monotone"
              dataKey="value2"
              stroke={color2}
              strokeWidth={2}
              fill={getFill(color2)}
              dot={false}
              activeDot={{ r: 4, fill: color2 }}
            />
          )}
          {hasTriple && (
            <Area
              type="monotone"
              dataKey="value3"
              stroke={color3}
              strokeWidth={2}
              fill={getFill(color3)}
              dot={false}
              activeDot={{ r: 4, fill: color3 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
