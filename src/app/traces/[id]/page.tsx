'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  GitBranch,
  Loader2,
  Sparkles,
  TreePine,
  BarChart3,
} from 'lucide-react';
import { tracesService } from '@/services/traces';
import { useTranslation } from '@/lib/i18n';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDuration, timeAgo, cn } from '@/lib/utils';
import type { Span } from '@/types';

export default function TraceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const traceId = params.id as string;

  const [viewMode, setViewMode] = useState<'tree' | 'waterfall'>('tree');
  const [language, setLanguage] = useState<'en' | 'ko'>('en');
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data: traceData, isLoading } = useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => tracesService.get(traceId),
  });

  const { data: treeData } = useQuery({
    queryKey: ['traceTree', traceId],
    queryFn: () => tracesService.tree(traceId),
  });

  const { data: analysis, isLoading: analyzing } = useQuery({
    queryKey: ['traceAnalysis', traceId, language],
    queryFn: () => tracesService.analyze(traceId, language),
    enabled: showAnalysis,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-neon-lime" />
      </div>
    );
  }

  if (!traceData) {
    return (
      <div className="text-center py-20 text-text-muted">Trace not found</div>
    );
  }

  const tree = treeData?.tree || [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 text-text-muted hover:text-text-primary rounded-[12px] hover:bg-bg-card transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch size={16} className="text-text-muted" />
            <h1 className="text-lg font-bold text-text-primary">Trace Detail</h1>
            <StatusBadge status={traceData.status} />
          </div>
          <p className="text-xs text-text-muted font-mono">{traceId}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total Duration" value={formatDuration(traceData.total_duration_ms)} color="text-neon-lime" />
        <SummaryCard label="Spans" value={String(traceData.span_count)} color="text-neon-cyan" />
        <SummaryCard label="Status" value={traceData.status} color={traceData.status === 'ERROR' ? 'text-neon-red' : 'text-neon-cyan'} />
        <SummaryCard label="Started" value={timeAgo(traceData.start_time)} color="text-text-secondary" />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {/* View mode */}
        <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
          <button
            onClick={() => setViewMode('tree')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
              viewMode === 'tree' ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
            )}
          >
            <TreePine size={12} />
            {t('traces.tree')}
          </button>
          <button
            onClick={() => setViewMode('waterfall')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
              viewMode === 'waterfall' ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
            )}
          >
            <BarChart3 size={12} />
            {t('traces.waterfall')}
          </button>
        </div>

        {/* AI Analysis */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-bg-card rounded-[8px] p-0.5 border border-border-default">
            {(['en', 'ko'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={cn(
                  'px-2 py-1 rounded-[6px] text-[10px] font-medium transition-colors',
                  language === lang ? 'bg-neon-lime text-text-inverse' : 'text-text-muted'
                )}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAnalysis(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-card border border-border-default rounded-[12px] text-xs text-text-secondary hover:text-neon-lime hover:border-neon-lime/30 transition-colors"
          >
            <Sparkles size={12} />
            {t('traces.analyze')}
          </button>
        </div>
      </div>

      {/* AI Analysis result */}
      {showAnalysis && (
        <div className="bg-bg-card border border-neon-lime/20 rounded-[16px] p-5 mb-6 card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-neon-lime" />
            <h3 className="text-sm font-medium text-neon-lime">AI Analysis</h3>
          </div>
          {analyzing ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 size={14} className="animate-spin" />
              Analyzing...
            </div>
          ) : analysis ? (
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
              {analysis.analysis}
            </p>
          ) : null}
        </div>
      )}

      {/* Tree / Waterfall view */}
      <div className="bg-bg-card border border-border-default rounded-[20px] card-shadow overflow-hidden">
        {viewMode === 'tree' ? (
          <div className="p-5">
            {tree.length > 0 ? (
              tree.map((span) => (
                <SpanTreeNode key={span.span_id} span={span} depth={0} totalDuration={traceData.total_duration_ms} />
              ))
            ) : (
              <div className="text-center py-8 text-text-muted text-sm">No tree data</div>
            )}
          </div>
        ) : (
          <div className="p-5">
            <WaterfallView spans={traceData.spans || []} totalDuration={traceData.total_duration_ms} startTime={traceData.start_time} />
          </div>
        )}
      </div>
    </div>
  );
}

/* === Sub-components === */

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg-card border border-border-default rounded-[14px] p-4">
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-lg font-bold', color)}>{value}</p>
    </div>
  );
}

function SpanTreeNode({ span, depth, totalDuration }: { span: Span; depth: number; totalDuration: number }) {
  const pct = totalDuration > 0 ? (span.duration_ms / totalDuration) * 100 : 0;
  const barColor =
    span.status === 'ERROR' ? '#FF4D6A' : span.status === 'CACHE_HIT' ? '#00FFCC' : '#DFFF00';

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div className="flex items-center gap-3 py-2 group">
        {/* Connector line */}
        {depth > 0 && (
          <div className="w-4 h-px bg-border-default shrink-0" />
        )}

        {/* Span info */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <StatusBadge status={span.status} />
          <span className="text-sm text-text-primary font-medium truncate">{span.function_name}</span>
          <span className="text-xs text-text-muted shrink-0">{formatDuration(span.duration_ms)}</span>
        </div>

        {/* Duration bar */}
        <div className="w-24 h-1.5 bg-bg-elevated rounded-full overflow-hidden shrink-0 hidden sm:block">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(pct, 2)}%`, background: barColor }}
          />
        </div>
      </div>

      {/* Children */}
      {span.children?.map((child) => (
        <SpanTreeNode key={child.span_id} span={child} depth={depth + 1} totalDuration={totalDuration} />
      ))}
    </div>
  );
}

function WaterfallView({ spans, totalDuration, startTime }: { spans: Span[]; totalDuration: number; startTime: string }) {
  const startMs = new Date(startTime).getTime();

  if (spans.length === 0) {
    return <div className="text-center py-8 text-text-muted text-sm">No spans</div>;
  }

  return (
    <div className="space-y-1.5">
      {/* Time axis */}
      <div className="flex justify-between text-[10px] text-text-muted mb-2 px-1">
        <span>0ms</span>
        <span>{formatDuration(totalDuration / 2)}</span>
        <span>{formatDuration(totalDuration)}</span>
      </div>

      {spans.map((span) => {
        const spanStart = new Date(span.timestamp_utc).getTime();
        const offsetPct = totalDuration > 0 ? ((spanStart - startMs) / totalDuration) * 100 : 0;
        const widthPct = totalDuration > 0 ? (span.duration_ms / totalDuration) * 100 : 0;
        const barColor =
          span.status === 'ERROR' ? '#FF4D6A' : span.status === 'CACHE_HIT' ? '#00FFCC' : '#DFFF00';

        return (
          <div key={span.span_id} className="flex items-center gap-3 py-1">
            <span className="text-xs text-text-secondary w-32 truncate shrink-0">
              {span.function_name}
            </span>
            <div className="flex-1 h-6 bg-bg-elevated rounded-md relative overflow-hidden">
              <div
                className="absolute top-0.5 bottom-0.5 rounded-md transition-all duration-500 flex items-center px-2"
                style={{
                  left: `${Math.max(offsetPct, 0)}%`,
                  width: `${Math.max(widthPct, 1)}%`,
                  background: barColor,
                  minWidth: '4px',
                }}
              >
                <span className="text-[9px] text-black font-semibold whitespace-nowrap">
                  {formatDuration(span.duration_ms)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
