'use client';

import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink, Loader2, Activity, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';
import { functionsService } from '@/services/functions';
import { useTranslation } from '@/lib/i18n';
import { formatNumber, formatDuration, formatPercentage, cn } from '@/lib/utils';

interface FunctionDetailProps {
  name: string;
  onClose: () => void;
}

export function FunctionDetail({ name, onClose }: FunctionDetailProps) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['function', name],
    queryFn: () => functionsService.get(name),
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-bg-card border border-border-default rounded-[20px] card-shadow overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
          <h3 className="text-lg font-semibold text-text-primary truncate">{name}</h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {isLoading || !data ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-accent-primary" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={Activity} label="Executions" value={formatNumber(data.execution_count || 0)} color="text-accent-primary" />
                <StatCard icon={Clock} label="Avg Duration" value={formatDuration(data.avg_duration_ms || 0)} color="text-accent-secondary" />
                <StatCard icon={AlertTriangle} label="Error Rate" value={formatPercentage(data.error_rate || 0)} color="text-status-error" />
              </div>

              {/* Meta */}
              {(data.module || data.file_path || data.team) && (
                <div className="grid grid-cols-2 gap-3">
                  {data.module && <InfoItem label="Module" value={data.module} />}
                  {data.file_path && <InfoItem label="File" value={data.file_path} mono />}
                  {data.team && <InfoItem label="Team" value={data.team} />}
                </div>
              )}

              {/* Description */}
              {data.description && (
                <div>
                  <p className="text-xs text-text-muted mb-1.5">Description</p>
                  <p className="text-sm text-text-secondary">{data.description}</p>
                </div>
              )}

              {/* Docstring */}
              {data.docstring && (
                <div>
                  <p className="text-xs text-text-muted mb-1.5">Docstring</p>
                  <pre className="bg-bg-elevated rounded-[12px] p-4 text-xs text-text-secondary whitespace-pre-wrap font-mono overflow-x-auto">
                    {data.docstring}
                  </pre>
                </div>
              )}

              {/* Source code */}
              {data.source_code && (
                <div>
                  <p className="text-xs text-text-muted mb-1.5">Source Code</p>
                  <pre className="bg-bg-elevated rounded-[12px] p-4 text-xs text-accent-primary/80 whitespace-pre-wrap font-mono overflow-x-auto max-h-[300px] overflow-y-auto">
                    {data.source_code}
                  </pre>
                </div>
              )}

              {/* Links */}
              <div className="flex gap-3">
                <Link
                  href={`/executions?function_name=${encodeURIComponent(name)}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[12px] bg-bg-elevated text-sm text-text-secondary hover:text-accent-primary hover:bg-bg-card-hover transition-colors"
                >
                  <Activity size={14} />
                  {t('functions.viewExecutions')}
                </Link>
                <Link
                  href={`/errors?function_name=${encodeURIComponent(name)}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[12px] bg-bg-elevated text-sm text-text-secondary hover:text-status-error hover:bg-bg-card-hover transition-colors"
                >
                  <AlertTriangle size={14} />
                  {t('functions.viewErrors')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ size: number; className?: string }>; label: string; value: string; color: string }) {
  return (
    <div className="bg-bg-elevated rounded-[12px] p-3 text-center">
      <Icon size={16} className={cn('mx-auto mb-1.5', color)} />
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      <p className="text-[10px] text-text-muted">{label}</p>
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">{label}</p>
      <p className={cn('text-xs text-text-primary truncate', mono && 'font-mono')}>{value}</p>
    </div>
  );
}
