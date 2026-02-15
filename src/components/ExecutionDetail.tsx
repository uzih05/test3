'use client';

import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { executionsService } from '@/services/executions';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDuration, timeAgo } from '@/lib/utils';

interface ExecutionDetailProps {
  spanId: string;
  onClose: () => void;
}

export function ExecutionDetail({ spanId, onClose }: ExecutionDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['execution', spanId],
    queryFn: () => executionsService.get(spanId),
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg-card border border-border-default rounded-[20px] card-shadow overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
          <h3 className="text-lg font-semibold text-text-primary">Execution Detail</h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {isLoading || !data ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-neon-lime" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status & Function */}
              <div className="flex items-center gap-3">
                <StatusBadge status={data.status} />
                <span className="text-sm font-medium text-text-primary">{data.function_name}</span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="Span ID" value={data.span_id} mono />
                <InfoItem label="Trace ID">
                  <Link
                    href={`/traces/${data.trace_id}`}
                    className="text-xs text-neon-lime hover:underline flex items-center gap-1 font-mono"
                  >
                    {data.trace_id.slice(0, 12)}...
                    <ExternalLink size={10} />
                  </Link>
                </InfoItem>
                <InfoItem label="Duration" value={formatDuration(data.duration_ms)} />
                <InfoItem label="Timestamp" value={timeAgo(data.timestamp_utc)} />
                {data.team && <InfoItem label="Team" value={data.team} />}
              </div>

              {/* Error info */}
              {data.error_code && (
                <div className="bg-neon-red-dim border border-neon-red/20 rounded-[14px] p-4">
                  <p className="text-xs text-neon-red font-semibold mb-1">{data.error_code}</p>
                  <p className="text-xs text-text-secondary">{data.error_message}</p>
                </div>
              )}

              {/* Return value */}
              {data.return_value && (
                <div>
                  <p className="text-xs text-text-muted mb-2">Return Value</p>
                  <pre className="bg-bg-elevated rounded-[12px] p-3 text-xs text-text-secondary overflow-x-auto max-h-[200px] overflow-y-auto font-mono">
                    {JSON.stringify(data.return_value, null, 2)}
                  </pre>
                </div>
              )}

              {/* View Trace button */}
              <Link
                href={`/traces/${data.trace_id}`}
                className="block w-full text-center py-2.5 rounded-[12px] bg-bg-elevated text-sm text-text-secondary hover:text-neon-lime hover:bg-bg-card-hover transition-colors"
              >
                View Trace
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">{label}</p>
      {children || (
        <p className={`text-xs text-text-primary ${mono ? 'font-mono' : ''} truncate`}>
          {value}
        </p>
      )}
    </div>
  );
}
