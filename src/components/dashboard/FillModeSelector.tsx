'use client';

import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const MODES = [
  { value: 'stroke-only' as const, labelKey: 'dashboard.fillLine' },
  { value: 'gradient' as const, labelKey: 'dashboard.fillGradient' },
  { value: 'solid' as const, labelKey: 'dashboard.fillSolid' },
];

export function FillModeSelector() {
  const { fillMode, setFillMode } = useDashboardStore();
  const { t } = useTranslation();

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
          {t(m.labelKey)}
        </button>
      ))}
    </div>
  );
}
