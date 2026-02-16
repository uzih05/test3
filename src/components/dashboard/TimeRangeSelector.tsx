'use client';

import { useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const PRESETS = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 180, label: '3h' },
  { value: 360, label: '6h' },
  { value: 720, label: '12h' },
  { value: 1440, label: '24h' },
  { value: 4320, label: '3d' },
  { value: 10080, label: '7d' },
];

export function TimeRangeSelector() {
  const { t } = useTranslation();
  const { timeRange, timeRangeLabel, setPreset, setCustomRange } = useDashboardStore();
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      setCustomRange(customStart, customEnd);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-[12px] text-sm',
          'bg-bg-card border border-border-default hover:border-border-hover transition-colors',
          'text-text-secondary'
        )}
      >
        <Clock size={14} />
        <span>{timeRangeLabel}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-bg-card border border-border-default rounded-[14px] p-3 card-shadow min-w-[220px]">
            {/* Presets */}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setPreset(p.value); setOpen(false); }}
                  className={cn(
                    'py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                    timeRange.preset === p.value
                      ? 'bg-neon-lime text-text-inverse'
                      : 'bg-bg-elevated text-text-muted hover:text-text-primary'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <div className="border-t border-border-default pt-3">
              <p className="text-xs text-text-muted mb-2">{t('dashboard.customRange')}</p>
              <input
                type="datetime-local"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-2 py-1.5 bg-bg-input border border-border-default rounded-[8px] text-xs text-text-primary mb-1.5 outline-none focus:border-neon-lime"
              />
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-2 py-1.5 bg-bg-input border border-border-default rounded-[8px] text-xs text-text-primary mb-2 outline-none focus:border-neon-lime"
              />
              <button
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd}
                className="w-full py-1.5 bg-neon-lime text-text-inverse rounded-[8px] text-xs font-medium disabled:opacity-40"
              >
                {t('dashboard.apply')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
