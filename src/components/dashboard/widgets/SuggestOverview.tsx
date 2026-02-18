'use client';

import { useQuery } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { suggestService } from '@/services/suggest';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { SuggestionPriority } from '@/types';

const PRIORITY_STYLES: Record<SuggestionPriority, { bg: string; text: string }> = {
  critical: { bg: 'bg-neon-red-dim', text: 'text-neon-red' },
  high: { bg: 'bg-[rgba(255,159,67,0.15)]', text: 'text-neon-orange' },
  medium: { bg: 'bg-neon-lime-dim', text: 'text-neon-lime' },
  low: { bg: 'bg-bg-elevated', text: 'text-text-muted' },
};

const PRIORITY_ORDER: SuggestionPriority[] = ['critical', 'high', 'medium', 'low'];

export function SuggestOverview() {
  const { t } = useTranslation();
  const { timeRangeMinutes } = useDashboardStore();

  const { data, isLoading } = useQuery({
    queryKey: ['suggestions', timeRangeMinutes],
    queryFn: () => suggestService.list(timeRangeMinutes),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <div className="h-[200px] flex items-center justify-center animate-pulse text-text-muted text-sm">{t('common.loading')}</div>;
  }

  const suggestions = data?.suggestions || [];
  const summary = data?.summary || { critical: 0, high: 0, medium: 0, low: 0 };

  if (suggestions.length === 0) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center text-text-muted">
        <Lightbulb size={24} className="mb-2 opacity-40" />
        <p className="text-sm">{t('suggest.noSuggestions')}</p>
      </div>
    );
  }

  // Sort by priority order and take top 5
  const sorted = [...suggestions].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  );
  const top5 = sorted.slice(0, 5);

  return (
    <div>
      {/* Summary badges */}
      <div className="flex gap-2 mb-3">
        {PRIORITY_ORDER.map((p) => {
          const count = summary[p];
          if (!count) return null;
          const style = PRIORITY_STYLES[p];
          return (
            <span key={p} className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase', style.bg, style.text)}>
              {p}: {count}
            </span>
          );
        })}
      </div>

      {/* Top suggestions */}
      <div className="space-y-2 max-h-[260px] overflow-y-auto">
        {top5.map((s, i) => {
          const style = PRIORITY_STYLES[s.priority];
          return (
            <div
              key={`${s.function_name}-${s.type}-${i}`}
              className="bg-bg-elevated rounded-[12px] px-3.5 py-2.5 border border-border-default"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-text-primary truncate max-w-[60%]">
                  {s.function_name}
                </span>
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase', style.bg, style.text)}>
                  {s.priority}
                </span>
              </div>
              <p className="text-xs text-text-muted truncate">{s.message}</p>
            </div>
          );
        })}
      </div>

      {/* View all link */}
      <Link
        href="/suggest"
        className="block text-center text-xs text-neon-lime hover:underline mt-3"
      >
        {t('dashboard.viewAll') || 'View All'}
      </Link>
    </div>
  );
}
