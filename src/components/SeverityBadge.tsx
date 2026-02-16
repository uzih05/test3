import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/utils';
import { SEVERITY_COLORS } from '@/lib/utils';

interface SeverityBadgeProps {
  severity: Severity;
  children: React.ReactNode;
  className?: string;
}

export function SeverityBadge({ severity, children, className }: SeverityBadgeProps) {
  const style = SEVERITY_COLORS[severity];
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-[8px] text-[11px] font-semibold',
      style.bg, style.text, className
    )}>
      {children}
    </span>
  );
}
