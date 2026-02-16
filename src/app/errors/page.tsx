'use client';

import { useState } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  AlertTriangle,
  TrendingUp,
  Hash,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { errorsService } from '@/services/errors';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useTranslation } from '@/lib/i18n';
import { StatusBadge } from '@/components/StatusBadge';
import { SurferChart } from '@/components/charts/SurferChart';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import { formatNumber, formatDuration, formatPercentage, timeAgo, cn } from '@/lib/utils';

const PIE_COLORS = ['#FF4D6A', '#FF9F43', '#DFFF00', '#00FFCC', '#3B82F6'];

export default function ErrorsPage() {
  const { t } = useTranslation();
  const { timeRangeMinutes } = useDashboardStore();
  const searchParams = useSearchParams();
  const initialFn = searchParams.get('function_name') || '';

  const [functionFilter, setFunctionFilter] = useState(initialFn);
  const [errorCodeFilter, setErrorCodeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'filter' | 'semantic'>('filter');

  const debouncedFunctionFilter = useDebounce(functionFilter, 300);
  const debouncedErrorCodeFilter = useDebounce(errorCodeFilter, 300);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Error list
  const { data: errorData, isLoading: loadingErrors } = useQuery({
    queryKey: ['errors', debouncedFunctionFilter, debouncedErrorCodeFilter, timeRangeMinutes],
    queryFn: () =>
      errorsService.list({
        function_name: debouncedFunctionFilter || undefined,
        error_code: debouncedErrorCodeFilter || undefined,
        time_range: timeRangeMinutes,
        limit: 50,
      }),
    enabled: searchMode === 'filter',
    refetchInterval: 15_000,
  });

  // Semantic search
  const { data: searchData, isLoading: loadingSearch } = useQuery({
    queryKey: ['errorSearch', debouncedSearchQuery],
    queryFn: () => errorsService.search(debouncedSearchQuery),
    enabled: searchMode === 'semantic' && debouncedSearchQuery.length > 1,
  });

  // Summary
  const { data: summaryData } = useQuery({
    queryKey: ['errorSummary', timeRangeMinutes],
    queryFn: () => errorsService.summary(timeRangeMinutes),
    refetchInterval: 15_000,
  });

  // Trends
  const { data: trendsData } = useQuery({
    queryKey: ['errorTrends', timeRangeMinutes],
    queryFn: () => {
      const bucket = timeRangeMinutes <= 60 ? 5 : timeRangeMinutes <= 360 ? 15 : timeRangeMinutes <= 1440 ? 60 : 360;
      return errorsService.trends(timeRangeMinutes, bucket);
    },
    refetchInterval: 15_000,
  });

  const errors = searchMode === 'semantic'
    ? (searchData?.items || [])
    : (errorData?.items || []);
  const isLoading = searchMode === 'semantic' ? loadingSearch : loadingErrors;

  const trendChartData = (trendsData || []).map((entry) => ({
    label: new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: entry.error_count,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">{t('errors.title')}</h1>
        <TimeRangeSelector />
      </div>

      {/* Summary cards */}
      {summaryData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <SummaryCard
            icon={AlertTriangle}
            label={t('errors.totalErrors')}
            value={formatNumber(summaryData.total_errors)}
            color="text-neon-red"
            bg="bg-neon-red-dim"
          />
          <SummaryCard
            icon={Hash}
            label={t('errors.uniqueCodes')}
            value={String(summaryData.unique_error_codes)}
            color="text-neon-orange"
            bg="bg-[rgba(255,159,67,0.15)]"
          />
          {(summaryData.most_common_errors || []).slice(0, 2).map((err, i) => (
            <SummaryCard
              key={err.error_code}
              icon={TrendingUp}
              label={err.error_code}
              value={`${err.count} (${formatPercentage(err.percentage)})`}
              color={i === 0 ? 'text-neon-red' : 'text-neon-orange'}
              bg={i === 0 ? 'bg-neon-red-dim' : 'bg-[rgba(255,159,67,0.15)]'}
            />
          ))}
        </div>
      )}

      {/* Trends + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Trends chart */}
        <div className="lg:col-span-2 bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
          <h3 className="text-sm font-medium text-text-secondary mb-4">{t('errors.trends')}</h3>
          {trendChartData.length > 0 ? (
            <SurferChart data={trendChartData} color="#FF4D6A" height={180} />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-text-muted text-sm">{t('errors.noTrendData')}</div>
          )}
        </div>

        {/* Error distribution */}
        <div className="bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
          <h3 className="text-sm font-medium text-text-secondary mb-4">{t('errors.distribution')}</h3>
          {summaryData && (summaryData.most_common_errors || []).length > 0 ? (
            <div className="space-y-3">
              {(summaryData.most_common_errors || []).slice(0, 5).map((err, i) => (
                <div key={err.error_code}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary truncate max-w-[60%]">{err.error_code}</span>
                    <span className="text-xs text-text-muted">{err.count}</span>
                  </div>
                  <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${err.percentage}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-text-muted text-sm">{t('errors.noData')}</div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search / filter input */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchMode === 'semantic' ? searchQuery : functionFilter}
            onChange={(e) => {
              if (searchMode === 'semantic') {
                setSearchQuery(e.target.value);
              } else {
                setFunctionFilter(e.target.value);
              }
            }}
            placeholder={searchMode === 'semantic' ? t('errors.search') : t('errors.filterPlaceholder')}
            className={cn(
              'w-full pl-9 pr-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
              'text-sm text-text-primary placeholder:text-text-muted',
              'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
            )}
          />
        </div>

        {/* Error code filter */}
        {searchMode === 'filter' && (
          <input
            type="text"
            value={errorCodeFilter}
            onChange={(e) => setErrorCodeFilter(e.target.value)}
            placeholder={t('errors.errorCodePlaceholder')}
            className={cn(
              'w-40 px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
              'text-sm text-text-primary placeholder:text-text-muted',
              'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
            )}
          />
        )}

        {/* Mode toggle */}
        <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
          <button
            onClick={() => setSearchMode('filter')}
            className={cn(
              'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
              searchMode === 'filter' ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
            )}
          >
            {t('errors.filter')}
          </button>
          <button
            onClick={() => setSearchMode('semantic')}
            className={cn(
              'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
              searchMode === 'semantic' ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
            )}
          >
            {t('errors.semantic')}
          </button>
        </div>
      </div>

      {/* Error table */}
      <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('errors.columnFunction')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('errors.columnErrorCode')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted hidden md:table-cell">{t('errors.columnMessage')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('errors.columnDuration')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('errors.columnTime')}</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-text-muted w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border-default">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-bg-elevated rounded animate-pulse w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : errors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-text-muted">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                errors.map((err) => (
                  <tr key={err.span_id} className="border-b border-border-default hover:bg-bg-card-hover transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-primary font-medium">{err.function_name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2 py-0.5 bg-neon-red-dim text-neon-red rounded-[8px] font-medium">
                        {err.error_code || 'ERROR'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-text-muted truncate block max-w-[300px]" title={err.error_message || ''}>
                        {err.error_message || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-secondary">{formatDuration(err.duration_ms)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-text-muted">{timeAgo(err.timestamp_utc)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {err.trace_id && (
                        <Link
                          href={`/traces/${err.trace_id}`}
                          className="p-1 text-text-muted hover:text-neon-lime transition-colors"
                          title={t('errors.viewTrace')}
                        >
                          <ExternalLink size={14} />
                        </Link>
                      )}
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

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-bg-card border border-border-default rounded-[16px] p-4 card-shadow">
      <div className={cn('w-8 h-8 rounded-[10px] flex items-center justify-center mb-2', bg)}>
        <Icon size={16} className={color} />
      </div>
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <p className={cn('text-lg font-bold', color)}>{value}</p>
    </div>
  );
}
