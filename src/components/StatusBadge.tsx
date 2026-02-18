'use client';

import { cn } from '@/lib/utils';

const STYLES: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: 'bg-accent-secondary-dim', text: 'text-accent-secondary' },
  ERROR: { bg: 'bg-status-error-dim', text: 'text-status-error' },
  CACHE_HIT: { bg: 'bg-accent-primary-dim', text: 'text-accent-primary' },
  PARTIAL: { bg: 'bg-status-warning-dim', text: 'text-status-warning' },
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
