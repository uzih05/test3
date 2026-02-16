import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendIndicatorProps {
  current: number;
  previous: number;
  /** If true, an increase is bad (e.g. error rate). Default false. */
  invertColor?: boolean;
  className?: string;
}

export function TrendIndicator({ current, previous, invertColor = false, className }: TrendIndicatorProps) {
  if (previous === 0 && current === 0) return null;

  const diff = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
  const absDiff = Math.abs(diff);

  if (absDiff < 1) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] text-text-muted ${className || ''}`}>
        <Minus size={12} />
        <span>0%</span>
      </span>
    );
  }

  const isUp = diff > 0;
  const isGood = invertColor ? !isUp : isUp;
  const colorClass = isGood ? 'text-neon-cyan' : 'text-neon-red';
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] ${colorClass} ${className || ''}`}>
      <Icon size={12} />
      <span>{absDiff.toFixed(1)}%</span>
    </span>
  );
}
