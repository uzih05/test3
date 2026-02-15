'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  Search,
  Loader2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Tag,
  BarChart3,
} from 'lucide-react';
import { cacheService } from '@/services/cache';
import { useTranslation } from '@/lib/i18n';
import { formatNumber, timeAgo, cn } from '@/lib/utils';
import type { GoldenRecord } from '@/types';

export default function GoldenPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [functionFilter, setFunctionFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'recommend'>('records');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Register form
  const [showRegister, setShowRegister] = useState(false);
  const [regUuid, setRegUuid] = useState('');
  const [regNote, setRegNote] = useState('');
  const [regTags, setRegTags] = useState('');

  // Recommend
  const [recFn, setRecFn] = useState('');

  // Golden records
  const { data: goldenData, isLoading: loadingGolden } = useQuery({
    queryKey: ['golden', functionFilter],
    queryFn: () => cacheService.goldenList(functionFilter || undefined, 100),
    enabled: activeTab === 'records',
  });

  // Stats
  const { data: statsData } = useQuery({
    queryKey: ['goldenStats'],
    queryFn: () => cacheService.goldenStats(),
  });

  // Recommend
  const { data: recData, isLoading: loadingRec } = useQuery({
    queryKey: ['goldenRecommend', recFn],
    queryFn: () => cacheService.goldenRecommend(recFn, 10),
    enabled: activeTab === 'recommend' && recFn.length > 0,
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: () =>
      cacheService.goldenRegister(
        regUuid,
        regNote || undefined,
        regTags ? regTags.split(',').map((t) => t.trim()).filter(Boolean) : undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['golden'] });
      queryClient.invalidateQueries({ queryKey: ['goldenStats'] });
      setShowRegister(false);
      setRegUuid('');
      setRegNote('');
      setRegTags('');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (uuid: string) => cacheService.goldenDelete(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['golden'] });
      queryClient.invalidateQueries({ queryKey: ['goldenStats'] });
    },
  });

  const records = goldenData?.items || [];
  const stats = statsData?.stats || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">{t('golden.title')}</h1>
        <div className="flex items-center gap-2">
          {/* Tab toggle */}
          <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
            {(['records', 'recommend'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors capitalize',
                  activeTab === tab ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t(`golden.${tab}`)}
              </button>
            ))}
          </div>
          {activeTab === 'records' && (
            <button
              onClick={() => setShowRegister(!showRegister)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-lime text-text-inverse rounded-[10px] text-xs font-medium hover:brightness-110 transition-all"
            >
              <Plus size={14} />
              {t('golden.register')}
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {stats.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setFunctionFilter('')}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-[10px] text-xs font-medium border transition-colors',
              !functionFilter
                ? 'bg-neon-lime-dim border-neon-lime/30 text-neon-lime'
                : 'bg-bg-card border-border-default text-text-muted hover:text-text-primary'
            )}
          >
            All ({statsData?.total || 0})
          </button>
          {stats.map((s) => (
            <button
              key={s.function_name}
              onClick={() => setFunctionFilter(s.function_name)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-[10px] text-xs font-medium border transition-colors',
                functionFilter === s.function_name
                  ? 'bg-neon-orange/15 border-neon-orange/30 text-neon-orange'
                  : 'bg-bg-card border-border-default text-text-muted hover:text-text-primary'
              )}
            >
              {s.function_name} ({s.count})
            </button>
          ))}
        </div>
      )}

      {/* Register form */}
      {showRegister && (
        <div className="bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow mb-4">
          <h3 className="text-sm font-medium text-text-secondary mb-4">{t('golden.registerNew')}</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={regUuid}
              onChange={(e) => setRegUuid(e.target.value)}
              placeholder="Execution UUID..."
              className={cn(
                'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-neon-lime outline-none transition-colors font-mono'
              )}
            />
            <input
              type="text"
              value={regNote}
              onChange={(e) => setRegNote(e.target.value)}
              placeholder="Note (optional)..."
              className={cn(
                'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-neon-lime outline-none transition-colors'
              )}
            />
            <input
              type="text"
              value={regTags}
              onChange={(e) => setRegTags(e.target.value)}
              placeholder="Tags (comma separated)..."
              className={cn(
                'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-neon-lime outline-none transition-colors'
              )}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRegister(false)}
                className="px-4 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => registerMutation.mutate()}
                disabled={!regUuid || registerMutation.isPending}
                className="px-4 py-2 bg-neon-lime text-text-inverse rounded-[10px] text-xs font-medium hover:brightness-110 disabled:opacity-40 transition-all"
              >
                {registerMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  t('golden.register')
                )}
              </button>
            </div>
            {registerMutation.isError && (
              <p className="text-xs text-neon-red">
                {(registerMutation.error as Error).message || 'Registration failed'}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'records' ? (
        /* === Records tab === */
        <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
          {/* Search */}
          <div className="px-5 py-3 border-b border-border-default">
            <div className="relative max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={functionFilter}
                onChange={(e) => setFunctionFilter(e.target.value)}
                placeholder="Filter by function..."
                className={cn(
                  'w-full pl-9 pr-4 py-2 bg-bg-input border border-border-default rounded-[10px]',
                  'text-xs text-text-primary placeholder:text-text-muted',
                  'focus:border-neon-lime outline-none transition-colors'
                )}
              />
            </div>
          </div>

          {loadingGolden ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-neon-lime" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-16">
              <Star size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
              <p className="text-sm text-text-muted">{t('golden.noRecords')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border-default">
              {records.map((rec) => (
                <GoldenRecordRow
                  key={rec.uuid}
                  record={rec}
                  expanded={expandedId === rec.uuid}
                  onToggle={() => setExpandedId(expandedId === rec.uuid ? null : rec.uuid)}
                  onDelete={() => deleteMutation.mutate(rec.uuid)}
                  deleting={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* === Recommend tab === */
        <div className="space-y-4">
          <div className="bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={14} className="text-neon-lime" />
              <h3 className="text-sm font-medium text-text-secondary">{t('golden.recommendTitle')}</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={recFn}
                onChange={(e) => setRecFn(e.target.value)}
                placeholder="Enter function name..."
                className={cn(
                  'flex-1 px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                  'text-sm text-text-primary placeholder:text-text-muted',
                  'focus:border-neon-lime outline-none transition-colors'
                )}
              />
            </div>
          </div>

          {loadingRec ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-neon-lime" />
            </div>
          ) : recData && recData.candidates.length > 0 ? (
            <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
              <div className="px-5 py-3 border-b border-border-default">
                <h3 className="text-sm font-medium text-text-secondary">
                  Candidates for <span className="text-neon-lime">{recData.function_name}</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Span ID</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Duration</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Score</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recData.candidates.map((c) => (
                      <tr key={c.span_id} className="border-b border-border-default hover:bg-bg-card-hover transition-colors">
                        <td className="px-5 py-3.5 text-sm text-text-primary font-mono">{c.span_id.slice(0, 12)}...</td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            'text-[11px] px-2 py-0.5 rounded-[8px] font-semibold',
                            c.status === 'SUCCESS' ? 'bg-neon-cyan-dim text-neon-cyan'
                              : c.status === 'CACHE_HIT' ? 'bg-neon-lime-dim text-neon-lime'
                              : 'bg-neon-red-dim text-neon-red'
                          )}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-text-secondary">{c.duration_ms}ms</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                              <div
                                className="h-full bg-neon-lime rounded-full"
                                style={{ width: `${Math.min(c.score * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-neon-lime font-mono">{(c.score * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-text-muted">{timeAgo(c.timestamp_utc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : recFn.length > 0 && !loadingRec ? (
            <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
              <BarChart3 size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
              <p className="text-sm text-text-muted">No candidates found</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function GoldenRecordRow({
  record,
  expanded,
  onToggle,
  onDelete,
  deleting,
}: {
  record: GoldenRecord;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div
        className="flex items-center gap-3 px-5 py-3.5 hover:bg-bg-card-hover cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <Star size={14} className="text-neon-orange shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{record.function_name}</span>
            {record.tags.length > 0 && (
              <div className="flex gap-1">
                {record.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 bg-bg-elevated rounded-md text-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {record.note && (
            <p className="text-xs text-text-muted mt-0.5 truncate">{record.note}</p>
          )}
        </div>
        <span className="text-[10px] text-text-muted shrink-0">{timeAgo(record.created_at)}</span>
        {expanded ? (
          <ChevronUp size={14} className="text-text-muted shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-text-muted shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-1 ml-8 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-text-muted">UUID:</span>
              <span className="ml-2 text-text-primary font-mono">{record.uuid}</span>
            </div>
            <div>
              <span className="text-text-muted">Execution UUID:</span>
              <span className="ml-2 text-text-primary font-mono">{record.execution_uuid}</span>
            </div>
          </div>
          {record.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag size={12} className="text-text-muted" />
              {record.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 bg-neon-lime-dim text-neon-lime rounded-md"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neon-red hover:bg-neon-red-dim rounded-[8px] transition-colors disabled:opacity-40"
            >
              <Trash2 size={12} />
              {deleting ? 'Deleting...' : t('golden.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

