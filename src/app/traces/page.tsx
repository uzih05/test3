'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search, GitBranch, Loader2 } from 'lucide-react';
import { tracesService } from '@/services/traces';
import { useTranslation } from '@/lib/i18n';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDuration, timeAgo, cn } from '@/lib/utils';

const LIMIT_OPTIONS = [20, 50, 100];

const STATUS_TABS = [
  { value: '', labelKey: 'allFilter' },
  { value: 'SUCCESS', labelKey: 'successFilter' },
  { value: 'ERROR', labelKey: 'errorFilter' },
  { value: 'PARTIAL', labelKey: 'partialFilter' },
];

export default function TracesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['traces', limit],
    queryFn: () => tracesService.list(limit),
  });

  const traces = (data || [])
    .filter((tr) => !statusFilter || tr.status === statusFilter)
    .filter(
      (tr) =>
        !searchQuery ||
        (tr.root_function || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tr.trace_id || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary mb-6">{t('traces.title')}</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('traces.searchPlaceholder')}
            className={cn(
              'w-full pl-9 pr-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
              'text-sm text-text-primary placeholder:text-text-muted',
              'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
            )}
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-neon-lime text-text-inverse'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {t(`traces.${tab.labelKey}`)}
            </button>
          ))}
        </div>

        {/* Limit */}
        <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
          {LIMIT_OPTIONS.map((l) => (
            <button
              key={l}
              onClick={() => setLimit(l)}
              className={cn(
                'px-2.5 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                limit === l
                  ? 'bg-neon-lime text-text-inverse'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('traces.columnFunction')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('traces.columnStatus')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('traces.columnDuration')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted hidden sm:table-cell">{t('traces.columnSpans')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('traces.columnTime')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border-default">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-bg-elevated rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : traces.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-text-muted">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                traces.map((trace) => (
                  <tr
                    key={trace.trace_id}
                    onClick={() => router.push(`/traces/${trace.trace_id}`)}
                    className="border-b border-border-default hover:bg-bg-card-hover cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <GitBranch size={14} className="text-text-muted shrink-0" />
                        <span className="text-sm text-text-primary font-medium">{trace.root_function}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={trace.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-secondary">{formatDuration(trace.total_duration_ms)}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-sm text-text-muted">{trace.span_count} {t('traces.spans')}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-text-muted">{timeAgo(trace.start_time)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
