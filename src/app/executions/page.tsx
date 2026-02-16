'use client';

import { useState } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { executionsService } from '@/services/executions';
import { useTranslation } from '@/lib/i18n';
import { StatusBadge } from '@/components/StatusBadge';
import { ExecutionDetail } from '@/components/ExecutionDetail';
import { formatDuration, timeAgo, cn } from '@/lib/utils';

const PAGE_SIZE = 20;

const STATUS_TABS = [
  { value: '', label: 'all' },
  { value: 'SUCCESS', label: 'success' },
  { value: 'ERROR', label: 'error' },
  { value: 'CACHE_HIT', label: 'cacheHit' },
];

export default function ExecutionsPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialFn = searchParams.get('function_name') || '';

  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState(initialFn);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSpan, setSelectedSpan] = useState<string | null>(null);
  const [showSlowest, setShowSlowest] = useState(true);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['executions', page, debouncedSearchQuery, statusFilter],
    queryFn: () =>
      executionsService.list({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        function_name: debouncedSearchQuery || undefined,
        status: statusFilter || undefined,
      }),
    refetchInterval: 30_000,
  });

  const { data: slowestData } = useQuery({
    queryKey: ['slowest'],
    queryFn: () => executionsService.slowest(),
    staleTime: 5 * 60_000,
    refetchInterval: 30_000,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const slowest = slowestData?.items || [];

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary mb-6">{t('executions.title')}</h1>

      {/* Slowest Executions */}
      {slowest.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowSlowest(!showSlowest)}
            className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary mb-3 transition-colors"
          >
            <Clock size={14} />
            {t('executions.slowest')}
            {showSlowest ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showSlowest && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {slowest.slice(0, 4).map((exec) => (
                <button
                  key={exec.span_id}
                  onClick={() => setSelectedSpan(exec.span_id)}
                  className="bg-bg-card border border-border-default rounded-[14px] p-4 text-left hover:border-border-hover transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-text-primary truncate mr-2">
                      {exec.function_name}
                    </span>
                    <StatusBadge status={exec.status} />
                  </div>
                  <p className="text-lg font-bold text-neon-orange">
                    {formatDuration(exec.duration_ms)}
                  </p>
                  <p className="text-[10px] text-text-muted mt-1">{timeAgo(exec.timestamp_utc)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            placeholder={t('executions.search')}
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
              onClick={() => { setStatusFilter(tab.value); setPage(0); }}
              className={cn(
                'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-neon-lime text-text-inverse'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {t(`executions.${tab.label}`)}
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
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('executions.columnFunction')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('executions.columnStatus')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('executions.columnDuration')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted hidden sm:table-cell">{t('executions.columnError')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('executions.columnTime')}</th>
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
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-text-muted">
                    {t('executions.noData')}
                  </td>
                </tr>
              ) : (
                items.map((exec) => (
                  <tr
                    key={exec.span_id}
                    onClick={() => setSelectedSpan(exec.span_id)}
                    className="border-b border-border-default hover:bg-bg-card-hover cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-primary font-medium">{exec.function_name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={exec.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-secondary">{formatDuration(exec.duration_ms)}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      {exec.error_code ? (
                        <span className="text-xs text-neon-red">{exec.error_code}</span>
                      ) : (
                        <span className="text-xs text-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-text-muted">{timeAgo(exec.timestamp_utc)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border-default">
            <span className="text-xs text-text-muted">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-bg-elevated transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-bg-elevated transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedSpan && (
        <ExecutionDetail
          spanId={selectedSpan}
          onClose={() => setSelectedSpan(null)}
        />
      )}
    </div>
  );
}
