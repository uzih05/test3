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

  // previous=0 → current>0: 이전 데이터 없이 새로 발생한 값
  if (previous === 0) {
    const isUp = current > 0;
    const isGood = invertColor ? !isUp : isUp;
    const colorClass = isGood ? 'text-accent-secondary' : 'text-status-error';
    const Icon = isUp ? TrendingUp : TrendingDown;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] ${colorClass} ${className || ''}`}>
        <Icon size={12} />
        <span>New</span>
      </span>
    );
  }

  const diff = ((current - previous) / previous) * 100;
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
  const colorClass = isGood ? 'text-accent-secondary' : 'text-status-error';
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] ${colorClass} ${className || ''}`}>
      <Icon size={12} />
      <span>{absDiff.toFixed(1)}%</span>
    </span>
  );
}
