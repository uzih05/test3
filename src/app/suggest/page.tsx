'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Lightbulb,
  AlertTriangle,
  Clock,
  Database,
  Zap,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { suggestService } from '@/services/suggest';
import { useDashboardStore } from '@/stores/dashboardStore';
import { usePagePreferencesStore } from '@/stores/pagePreferencesStore';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Suggestion, SuggestionPriority, SuggestionType } from '@/types';

const PRIORITY_STYLES: Record<SuggestionPriority, { bg: string; text: string }> = {
  critical: { bg: 'bg-status-error-dim', text: 'text-status-error' },
  high: { bg: 'bg-status-warning-dim', text: 'text-status-warning' },
  medium: { bg: 'bg-accent-primary-dim', text: 'text-accent-primary' },
  low: { bg: 'bg-bg-elevated', text: 'text-text-muted' },
};

const TYPE_ICONS: Record<SuggestionType, React.ComponentType<{ size: number; className?: string }>> = {
  unused_function: Database,
  high_error_rate: AlertTriangle,
  slow_function: Clock,
  cache_optimization: Zap,
  no_golden_data: Database,
  performance_degradation: TrendingDown,
};

const TYPE_I18N: Record<SuggestionType, string> = {
  unused_function: 'suggest.unusedFunction',
  high_error_rate: 'suggest.highErrorRate',
  slow_function: 'suggest.slowFunction',
  cache_optimization: 'suggest.cacheOptimization',
  no_golden_data: 'suggest.noGoldenData',
  performance_degradation: 'suggest.performanceDegradation',
};

const PRIORITY_I18N: Record<SuggestionPriority, string> = {
  critical: 'suggest.critical',
  high: 'suggest.high',
  medium: 'suggest.medium',
  low: 'suggest.low',
};

const ALL_PRIORITIES: SuggestionPriority[] = ['critical', 'high', 'medium', 'low'];

const ALL_TYPES: SuggestionType[] = [
  'high_error_rate',
  'slow_function',
  'performance_degradation',
  'cache_optimization',
  'no_golden_data',
  'unused_function',
];

export default function SuggestPage() {
  const { t } = useTranslation();
  const { timeRangeMinutes } = useDashboardStore();
  const priorityFilter = usePagePreferencesStore((s) => s.suggestPriorityFilter) as SuggestionPriority | 'all';
  const setPriorityFilter = usePagePreferencesStore((s) => s.setSuggestPriorityFilter);
  const [typeFilter, setTypeFilter] = useState<SuggestionType | 'all'>('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['suggestions', timeRangeMinutes],
    queryFn: () => suggestService.list(timeRangeMinutes),
    refetchInterval: 30_000,
  });

  const suggestions = data?.suggestions || [];
  const summary = data?.summary || { critical: 0, high: 0, medium: 0, low: 0 };

  const filtered = suggestions.filter((s) => {
    if (priorityFilter !== 'all' && s.priority !== priorityFilter) return false;
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('suggest.title')}</h1>
          <p className="text-xs text-text-muted mt-0.5">{t('suggest.subtitle')}</p>
        </div>
        <TimeRangeSelector />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {ALL_PRIORITIES.map((p) => {
          const style = PRIORITY_STYLES[p];
          const count = summary[p];
          return (
            <button
              key={p}
              onClick={() => setPriorityFilter(priorityFilter === p ? 'all' : p)}
              className={cn(
                'bg-bg-card border rounded-[14px] p-4 text-left transition-colors',
                priorityFilter === p ? 'border-accent-primary' : 'border-border-default hover:border-border-hover'
              )}
            >
              <p className="text-xs text-text-muted mb-1">{t(PRIORITY_I18N[p])}</p>
              <p className={cn('text-2xl font-bold tabular-nums', count > 0 ? style.text : 'text-text-muted')}>
                {isLoading ? '-' : count}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
          <button
            onClick={() => setPriorityFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
              priorityFilter === 'all' ? 'bg-accent-primary text-text-inverse' : 'text-text-muted hover:text-text-primary'
            )}
          >
            {t('suggest.filterAll')}
          </button>
          {ALL_PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(priorityFilter === p ? 'all' : p)}
              className={cn(
                'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                priorityFilter === p ? 'bg-accent-primary text-text-inverse' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {t(PRIORITY_I18N[p])}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as SuggestionType | 'all')}
          aria-label={t('suggest.filterByType')}
          className={cn(
            'px-3 py-2 bg-bg-card border border-border-default rounded-[12px]',
            'text-xs text-text-secondary outline-none cursor-pointer',
            'focus-visible:border-accent-primary focus-visible:ring-1 focus-visible:ring-accent-primary/30 transition-colors'
          )}
        >
          <option value="all">{t('suggest.filterAll')}</option>
          {ALL_TYPES.map((type) => (
            <option key={type} value={type}>{t(TYPE_I18N[type])}</option>
          ))}
        </select>
      </div>

      {/* Suggestion list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card border border-border-default rounded-[16px] p-5 animate-pulse card-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-5 bg-bg-elevated rounded" />
                <div className="w-24 h-4 bg-bg-elevated rounded" />
              </div>
              <div className="w-40 h-4 bg-bg-elevated rounded mb-2" />
              <div className="w-full h-3 bg-bg-elevated rounded" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-bg-card border border-dashed border-status-error/30 rounded-[20px] p-12 text-center card-shadow">
          <AlertTriangle size={28} className="mx-auto mb-3 text-status-error opacity-60" />
          <p className="text-sm text-text-muted">{t('suggest.fetchError')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
          <Lightbulb size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
          <p className="text-sm text-text-muted">{t('suggest.noSuggestions')}</p>
        </div>
      ) : priorityFilter !== 'all' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((s, i) => (
            <SuggestionCard key={`${s.function_name}-${s.type}-${i}`} suggestion={s} />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {ALL_PRIORITIES.map((priority) => {
            const group = filtered.filter((s) => s.priority === priority);
            if (group.length === 0) return null;
            const style = PRIORITY_STYLES[priority];
            return (
              <div key={priority}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={cn('text-[11px] font-semibold uppercase px-2.5 py-1 rounded-[8px]', style.bg, style.text)}>
                    {t(PRIORITY_I18N[priority])}
                  </span>
                  <span className="text-xs text-text-muted">{group.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.map((s, i) => (
                    <SuggestionCard key={`${s.function_name}-${s.type}-${i}`} suggestion={s} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion: s }: { suggestion: Suggestion }) {
  const { t } = useTranslation();
  const style = PRIORITY_STYLES[s.priority];
  const Icon = TYPE_ICONS[s.type];

  const actionLink = s.type === 'high_error_rate'
    ? '/errors'
    : s.type === 'unused_function' || s.type === 'slow_function'
    ? '/functions'
    : s.type === 'no_golden_data'
    ? '/golden'
    : s.type === 'cache_optimization'
    ? '/golden'
    : '/functions';

  const actionLabel = s.type === 'high_error_rate'
    ? t('suggest.viewErrors')
    : s.type === 'cache_optimization'
    ? t('suggest.setupCaching') || 'Set up Caching'
    : s.type === 'no_golden_data'
    ? t('suggest.viewGolden')
    : t('suggest.viewFunction');

  return (
    <div className="bg-bg-card border border-border-default rounded-[16px] p-5 card-shadow hover:border-border-hover transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0', style.bg)}>
          <Icon size={16} className={style.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-[6px]', style.bg, style.text)}>
              {t(PRIORITY_I18N[s.priority])}
            </span>
            <span className="text-[10px] text-text-muted">{t(TYPE_I18N[s.type])}</span>
          </div>
          <p className="text-sm font-semibold text-text-primary truncate">{s.function_name}</p>
          <p className="text-xs text-text-secondary mt-1">{s.message}</p>

          {/* Metrics */}
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(s.metrics).map(([key, val]) => (
              <span key={key} className="text-[10px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded-md">
                {key.replace(/_/g, ' ')}: <span className="text-text-secondary font-medium">{formatMetric(key, val)}</span>
              </span>
            ))}
          </div>

          {/* Action link */}
          <Link
            href={actionLink}
            className="inline-flex items-center gap-1 mt-3 text-xs text-accent-primary hover:underline"
          >
            {actionLabel}
            <ExternalLink size={10} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatMetric(key: string, value: number): string {
  if (key.includes('rate')) {
    return `${value}%`;
  }
  if (key.includes('duration')) {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
    return `${Math.round(value)}ms`;
  }
  if (key.includes('ratio')) {
    return `${value}x`;
  }
  return String(value);
}
