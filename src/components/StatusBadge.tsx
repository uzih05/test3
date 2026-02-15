'use client';

import { cn } from '@/lib/utils';

const STYLES: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: 'bg-neon-cyan-dim', text: 'text-neon-cyan' },
  ERROR: { bg: 'bg-neon-red-dim', text: 'text-neon-red' },
  CACHE_HIT: { bg: 'bg-neon-lime-dim', text: 'text-neon-lime' },
  PARTIAL: { bg: 'bg-[rgba(255,159,67,0.15)]', text: 'text-neon-orange' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STYLES[status] || { bg: 'bg-bg-elevated', text: 'text-text-muted' };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-[8px] text-[11px] font-semibold',
        style.bg,
        style.text,
        className
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
