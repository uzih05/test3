'use client';

import { useDashboardStore } from '@/stores/dashboardStore';
import { cn } from '@/lib/utils';

const MODES = [
  { value: 'stroke-only' as const, label: 'Line' },
  { value: 'gradient' as const, label: 'Gradient' },
  { value: 'solid' as const, label: 'Solid' },
];

export function FillModeSelector() {
  const { fillMode, setFillMode } = useDashboardStore();

  return (
    <div className="flex gap-1 bg-bg-elevated rounded-[10px] p-1">
      {MODES.map((m) => (
        <button
          key={m.value}
          onClick={() => setFillMode(m.value)}
          className={cn(
            'px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors',
            fillMode === m.value
              ? 'bg-neon-lime text-text-inverse'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
