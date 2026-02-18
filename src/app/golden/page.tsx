'use client';

import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  Map,
  Info,
} from 'lucide-react';
import { cacheService } from '@/services/cache';
import { semanticService } from '@/services/semantic';
import { functionsService } from '@/services/functions';
import { executionsService } from '@/services/executions';
import { useTranslation } from '@/lib/i18n';
import { formatNumber, formatPercentage, formatDuration, timeAgo, cn } from '@/lib/utils';
import { TruncatedText } from '@/components/TruncatedText';
import type { GoldenRecord, ScatterPoint, CoverageResult } from '@/types';

export default function GoldenPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [functionFilter, setFunctionFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'recommend' | 'coverage'>('records');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Records sub-mode
  const [recordsMode, setRecordsMode] = useState<'golden' | 'browse'>('golden');
  const [browsePage, setBrowsePage] = useState(0);
  const BROWSE_PAGE_SIZE = 20;

  // Register form
  const [showRegister, setShowRegister] = useState(false);
  const [regUuid, setRegUuid] = useState('');
  const [regNote, setRegNote] = useState('');
  const [regTags, setRegTags] = useState('');

  // Recommend
  const [recFn, setRecFn] = useState('');
  const [registeredUuids, setRegisteredUuids] = useState<Set<string>>(new Set());
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [batchRegistering, setBatchRegistering] = useState(false);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  // Functions list for recommend/coverage tab
  const { data: fnListData } = useQuery({
    queryKey: ['functions'],
    queryFn: () => functionsService.list(),
    enabled: activeTab === 'recommend' || activeTab === 'coverage',
    refetchInterval: 60_000,
  });

  // Auto-select first function when list loads
  const fnNames = (fnListData?.items || [])
    .filter((f) => (f.execution_count ?? 0) > 0)
    .map((f) => f.function_name);

  // Coverage state
  const [coverageFn, setCoverageFn] = useState('');

  useEffect(() => {
    if (activeTab === 'recommend' && fnNames.length > 0 && !recFn) {
      setRecFn(fnNames[0]);
    }
    if (activeTab === 'coverage' && fnNames.length > 0 && !coverageFn) {
      setCoverageFn(fnNames[0]);
    }
  }, [activeTab, fnNames.length]);

  // Coverage
  const { data: coverageData, isLoading: loadingCoverage } = useQuery({
    queryKey: ['goldenCoverage', coverageFn],
    queryFn: () => semanticService.coverage(coverageFn || undefined),
    enabled: activeTab === 'coverage',
    refetchInterval: 60_000,
  });

  // Enhanced Recommend (with diversity)
  const { data: diverseRecData, isLoading: loadingDiverseRec } = useQuery({
    queryKey: ['semanticRecommend', recFn],
    queryFn: () => semanticService.recommend(recFn, 10),
    enabled: activeTab === 'recommend' && recFn.length > 0,
    refetchInterval: 60_000,
  });

  // Golden records
  const { data: goldenData, isLoading: loadingGolden } = useQuery({
    queryKey: ['golden', functionFilter],
    queryFn: () => cacheService.goldenList(functionFilter || undefined, 100),
    enabled: activeTab === 'records',
    refetchInterval: 60_000,
  });

  // Browse executions (within Records tab)
  const { data: browseData, isLoading: loadingBrowse } = useQuery({
    queryKey: ['browseExecutions', functionFilter, browsePage],
    queryFn: () => executionsService.list({
      function_name: functionFilter || undefined,
      limit: BROWSE_PAGE_SIZE,
      offset: browsePage * BROWSE_PAGE_SIZE,
      sort_by: 'timestamp_utc',
      sort_asc: false,
    }),
    enabled: activeTab === 'records' && recordsMode === 'browse',
    refetchInterval: 60_000,
  });

  // Set of execution UUIDs already registered as golden
  const goldenExecUuids = new Set(
    (goldenData?.items || []).map((r) => r.execution_uuid)
  );

  // Stats
  const { data: statsData } = useQuery({
    queryKey: ['goldenStats'],
    queryFn: () => cacheService.goldenStats(),
    refetchInterval: 60_000,
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

  // Quick register from recommend tab
  const quickRegisterMutation = useMutation({
    mutationFn: (uuid: string) => cacheService.goldenRegister(uuid),
    onSuccess: (_data, uuid) => {
      setRegisteredUuids((prev) => new Set(prev).add(uuid));
      setSelectedUuids((prev) => { const next = new Set(prev); next.delete(uuid); return next; });
      queryClient.invalidateQueries({ queryKey: ['golden'] });
      queryClient.invalidateQueries({ queryKey: ['goldenStats'] });
    },
  });

  // Batch register
  const handleBatchRegister = async () => {
    if (selectedUuids.size === 0) return;
    setBatchRegistering(true);
    const uuids = Array.from(selectedUuids);
    for (const uuid of uuids) {
      try {
        await cacheService.goldenRegister(uuid);
        setRegisteredUuids((prev) => new Set(prev).add(uuid));
      } catch { /* skip failed */ }
    }
    setSelectedUuids(new Set());
    setBatchRegistering(false);
    queryClient.invalidateQueries({ queryKey: ['golden'] });
    queryClient.invalidateQueries({ queryKey: ['goldenStats'] });
  };

  const toggleSelect = (uuid: string) => {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid); else next.add(uuid);
      return next;
    });
  };

  const toggleSelectAll = (candidates: { uuid: string }[]) => {
    const selectable = candidates.filter((c) => !registeredUuids.has(c.uuid));
    if (selectable.every((c) => selectedUuids.has(c.uuid))) {
      setSelectedUuids(new Set());
    } else {
      setSelectedUuids(new Set(selectable.map((c) => c.uuid)));
    }
  };

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
            {(['records', 'recommend', 'coverage'] as const).map((tab) => (
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-lime text-text-inverse rounded-[10px] text-xs font-medium hover:brightness-110 transition-[filter] focus-visible:ring-2 focus-visible:ring-neon-lime/50"
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
            {t('golden.allFilter')} ({statsData?.total || 0})
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
              placeholder={t('golden.executionUuidPlaceholder')}
              className={cn(
                'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-neon-lime focus-visible:ring-2 focus-visible:ring-neon-lime/50 outline-none transition-colors font-mono'
              )}
            />
            <input
              type="text"
              value={regNote}
              onChange={(e) => setRegNote(e.target.value)}
              placeholder={t('golden.notePlaceholder')}
              className={cn(
                'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-neon-lime focus-visible:ring-2 focus-visible:ring-neon-lime/50 outline-none transition-colors'
              )}
            />
            <input
              type="text"
              value={regTags}
              onChange={(e) => setRegTags(e.target.value)}
              placeholder={t('golden.tagsPlaceholder')}
              className={cn(
                'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-neon-lime focus-visible:ring-2 focus-visible:ring-neon-lime/50 outline-none transition-colors'
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
                className="px-4 py-2 bg-neon-lime text-text-inverse rounded-[10px] text-xs font-medium hover:brightness-110 disabled:opacity-40 transition-[opacity,filter] focus-visible:ring-2 focus-visible:ring-neon-lime/50"
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
                {(registerMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* === Records tab === */}
      {activeTab === 'records' && (
        <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
          <div className="px-5 py-3 border-b border-border-default flex items-center gap-3">
            {/* Sub-mode toggle */}
            <div className="flex bg-bg-secondary border border-border-default rounded-xl overflow-hidden shrink-0">
              <button
                onClick={() => setRecordsMode('golden')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  recordsMode === 'golden'
                    ? 'bg-neon-lime-dim text-neon-lime'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t('golden.goldenRecords')}
              </button>
              <button
                onClick={() => setRecordsMode('browse')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  recordsMode === 'browse'
                    ? 'bg-neon-lime-dim text-neon-lime'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t('golden.browseExecutions')}
              </button>
            </div>
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={functionFilter}
                onChange={(e) => { setFunctionFilter(e.target.value); setBrowsePage(0); }}
                placeholder={t('golden.filterPlaceholder')}
                className={cn(
                  'w-full pl-9 pr-4 py-2 bg-bg-input border border-border-default rounded-[10px]',
                  'text-xs text-text-primary placeholder:text-text-muted',
                  'focus:border-neon-lime focus-visible:ring-2 focus-visible:ring-neon-lime/50 outline-none transition-colors'
                )}
              />
            </div>
          </div>

          {recordsMode === 'golden' ? (
            /* Golden Records sub-tab */
            loadingGolden ? (
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
            )
          ) : (
            /* Browse Executions sub-tab */
            loadingBrowse ? (
              <div className="flex justify-center py-12">
                <Loader2 size={20} className="animate-spin text-neon-lime" />
              </div>
            ) : !browseData?.items?.length ? (
              <div className="text-center py-16">
                <Search size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
                <p className="text-sm text-text-muted">{t('golden.noExecutions')}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-default">
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('golden.columnFunction')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('golden.columnStatus')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('golden.columnDuration')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('golden.columnTime')}</th>
                        <th className="text-center px-5 py-3 text-xs font-medium text-text-muted">{t('golden.register')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {browseData.items.map((exec) => {
                        const isGolden = goldenExecUuids.has(exec.uuid) || registeredUuids.has(exec.uuid);
                        return (
                          <tr key={exec.span_id} className="border-b border-border-default hover:bg-bg-card-hover transition-colors">
                            <td className="px-5 py-3.5 text-sm text-text-primary">{exec.function_name}</td>
                            <td className="px-5 py-3.5">
                              <span className={cn(
                                'text-[11px] px-2 py-0.5 rounded-[8px] font-semibold',
                                exec.status === 'SUCCESS' ? 'bg-neon-lime-dim text-neon-lime' :
                                exec.status === 'ERROR' ? 'bg-neon-red-dim text-neon-red' :
                                'bg-neon-cyan-dim text-neon-cyan'
                              )}>
                                {exec.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-text-secondary">{formatDuration(exec.duration_ms)}</td>
                            <td className="px-5 py-3.5 text-xs text-text-muted">
                              {timeAgo(exec.timestamp_utc)}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {isGolden ? (
                                <CheckCircle2 size={16} className="inline text-neon-lime" />
                              ) : (
                                <button
                                  onClick={() => quickRegisterMutation.mutate(exec.uuid)}
                                  disabled={quickRegisterMutation.isPending}
                                  className="p-1.5 rounded-[8px] text-text-muted hover:text-neon-lime hover:bg-neon-lime-dim transition-colors disabled:opacity-40"
                                  title={t('golden.register')}
                                >
                                  <Plus size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="px-5 py-3 border-t border-border-default flex items-center justify-between">
                  <span className="text-xs text-text-muted">
                    {browseData.total} {t('golden.executionsCount')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBrowsePage((p) => Math.max(0, p - 1))}
                      disabled={browsePage === 0}
                      className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                    >
                      {t('golden.prev')}
                    </button>
                    <span className="text-xs text-text-muted">
                      {t('golden.page')} {browsePage + 1}
                    </span>
                    <button
                      onClick={() => setBrowsePage((p) => p + 1)}
                      disabled={(browsePage + 1) * BROWSE_PAGE_SIZE >= browseData.total}
                      className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                    >
                      {t('golden.next')}
                    </button>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      )}

      {/* === Recommend tab (with Discovery/Steady) === */}
      {activeTab === 'recommend' && (
        <div className="space-y-4">
          {/* Description */}
          <div className="bg-bg-card border border-border-default rounded-[14px] px-4 py-3 card-shadow">
            <p className="text-xs text-text-secondary leading-relaxed">
              {t('analysis.recommendDesc')}
            </p>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-neon-orange" />
                <span className="text-[10px] text-neon-orange font-medium">{t('analysis.discovery')}</span>
                <span className="text-[10px] text-text-muted">— {t('analysis.discoveryDesc')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-neon-cyan" />
                <span className="text-[10px] text-neon-cyan font-medium">{t('analysis.steady')}</span>
                <span className="text-[10px] text-text-muted">— {t('analysis.steadyDesc')}</span>
              </div>
            </div>
          </div>

          {/* Function selector (dropdown) */}
          {fnNames.length > 0 && (
            <select
              value={recFn}
              onChange={(e) => setRecFn(e.target.value)}
              className={cn(
                'w-full max-w-sm px-4 py-2 bg-bg-input border border-border-default rounded-[10px]',
                'text-xs text-text-primary',
                'focus:border-neon-lime focus-visible:ring-2 focus-visible:ring-neon-lime/50 outline-none transition-colors'
              )}
            >
              <option value="" disabled>{t('analysis.selectFunction')}</option>
              {fnNames.map((fn) => (
                <option key={fn} value={fn}>{fn}</option>
              ))}
            </select>
          )}

          {loadingDiverseRec ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-neon-lime" />
            </div>
          ) : diverseRecData && diverseRecData.candidates.length > 0 ? (
            <>
              {/* Golden 0개 배너 */}
              {diverseRecData.golden_count === 0 && (
                <div className="flex items-center gap-2 bg-neon-orange/10 border border-neon-orange/20 rounded-[12px] px-4 py-2.5">
                  <Info size={14} className="text-neon-orange shrink-0" />
                  <p className="text-xs text-neon-orange">
                    {t('golden.noGoldenBanner')}
                  </p>
                </div>
              )}
              <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
                <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text-secondary">
                    {t('golden.candidatesFor')} <span className="text-neon-lime">{diverseRecData.function_name}</span>
                    <span className="ml-2 text-xs text-text-muted">
                      ({diverseRecData.golden_count} {t('golden.goldenPoint').toLowerCase()})
                    </span>
                  </h3>
                  {selectedUuids.size > 0 && (
                    <button
                      onClick={handleBatchRegister}
                      disabled={batchRegistering}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-lime text-text-inverse rounded-[10px] text-xs font-medium hover:brightness-110 disabled:opacity-40 transition-[opacity,filter]"
                    >
                      {batchRegistering ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} />
                      )}
                      {t('golden.registerSelected')} ({selectedUuids.size})
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-default">
                        <th className="w-10 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={diverseRecData.candidates.filter((c) => !registeredUuids.has(c.uuid)).length > 0 && diverseRecData.candidates.filter((c) => !registeredUuids.has(c.uuid)).every((c) => selectedUuids.has(c.uuid))}
                            onChange={() => toggleSelectAll(diverseRecData.candidates)}
                            className="rounded border-border-default accent-neon-lime"
                          />
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('golden.columnSpanId')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('golden.columnType')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('golden.columnDuration')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('analysis.diversityScore')}</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">
                          {diverseRecData.golden_count > 0 ? t('analysis.distanceToGolden') : t('golden.avgDistance')}
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-text-muted">{t('golden.columnTime')}</th>
                        <th className="text-center px-5 py-3 text-xs font-medium text-text-muted">{t('golden.register')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diverseRecData.candidates.map((c) => {
                        const isRegistered = registeredUuids.has(c.uuid);
                        const isExpanded = expandedCandidateId === c.uuid;
                        return (
                          <React.Fragment key={c.uuid}>
                          <tr
                            className="border-b border-border-default hover:bg-bg-card-hover transition-colors cursor-pointer"
                            onClick={() => setExpandedCandidateId(isExpanded ? null : c.uuid)}
                          >
                            <td className="w-10 px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                              {isRegistered ? (
                                <CheckCircle2 size={16} className="text-neon-lime mx-auto" />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={selectedUuids.has(c.uuid)}
                                  onChange={() => toggleSelect(c.uuid)}
                                  className="rounded border-border-default accent-neon-lime"
                                />
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-sm text-text-primary"><TruncatedText text={c.span_id || c.uuid} maxLength={12} mono /></td>
                            <td className="px-5 py-3.5">
                              <span className={cn(
                                'text-[11px] px-2 py-0.5 rounded-[8px] font-semibold',
                                c.candidate_type === 'DISCOVERY'
                                  ? 'bg-[rgba(255,159,67,0.15)] text-neon-orange'
                                  : 'bg-neon-cyan-dim text-neon-cyan'
                              )}>
                                {c.candidate_type === 'DISCOVERY' ? t('analysis.discovery') : t('analysis.steady')}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-text-secondary">{formatDuration(c.duration_ms)}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      c.candidate_type === 'DISCOVERY' ? 'bg-neon-orange' : 'bg-neon-cyan'
                                    )}
                                    style={{ width: `${Math.min(c.score * 100, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-text-muted font-mono">{(c.score * 100).toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-text-muted font-mono">
                              {c.distance_to_nearest_golden < 0 ? t('golden.notApplicable') : c.distance_to_nearest_golden.toFixed(6)}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-text-muted" title={c.timestamp_utc}>
                              {timeAgo(c.timestamp_utc)}
                            </td>
                            <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              {isRegistered ? (
                                <CheckCircle2 size={16} className="inline text-neon-lime" />
                              ) : (
                                <button
                                  onClick={() => quickRegisterMutation.mutate(c.uuid)}
                                  disabled={quickRegisterMutation.isPending}
                                  className="p-1.5 rounded-[8px] text-text-muted hover:text-neon-lime hover:bg-neon-lime-dim transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-neon-lime/50"
                                  aria-label={t('golden.register')}
                                  title={t('golden.register')}
                                >
                                  <Plus size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (c.input_preview || c.output_preview) && (
                            <tr className="border-b border-border-default bg-bg-elevated/50">
                              <td colSpan={8} className="px-5 py-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {c.input_preview && (
                                    <div>
                                      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Input</p>
                                      <pre className="bg-bg-elevated rounded-[8px] p-2.5 text-xs text-text-secondary font-mono max-h-[100px] overflow-y-auto whitespace-pre-wrap break-all">
                                        {c.input_preview}
                                      </pre>
                                    </div>
                                  )}
                                  {c.output_preview && (
                                    <div>
                                      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Output</p>
                                      <pre className="bg-bg-elevated rounded-[8px] p-2.5 text-xs text-neon-lime/70 font-mono max-h-[100px] overflow-y-auto whitespace-pre-wrap break-all">
                                        {c.output_preview}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : recFn && !loadingDiverseRec ? (
            <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
              <BarChart3 size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
              <p className="text-sm text-text-muted">{t('golden.noRecords')}</p>
            </div>
          ) : fnNames.length === 0 && !loadingDiverseRec ? (
            <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
              <Sparkles size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
              <p className="text-sm text-text-muted">{t('golden.noFunctions')}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* === Coverage tab === */}
      {activeTab === 'coverage' && (
        <CoverageTab
          data={coverageData}
          loading={loadingCoverage}
          fnNames={fnNames}
          coverageFn={coverageFn}
          setCoverageFn={setCoverageFn}
        />
      )}
    </div>
  );
}

// ========================
// Coverage Tab (D14)
// ========================
const COVERAGE_COLORS = {
  golden: '#DFFF00',
  execution: '#00FFCC',
};

function CoverageTab({
  data,
  loading,
  fnNames,
  coverageFn,
  setCoverageFn,
}: {
  data: CoverageResult | undefined;
  loading: boolean;
  fnNames: string[];
  coverageFn: string;
  setCoverageFn: (v: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState<ScatterPoint | null>(null);
  const [clickedPoint, setClickedPoint] = useState<ScatterPoint | null>(null);
  const [covRegistered, setCovRegistered] = useState<Set<string>>(new Set());

  const coverageRegisterMutation = useMutation({
    mutationFn: (uuid: string) => cacheService.goldenRegister(uuid),
    onSuccess: (_data, uuid) => {
      setCovRegistered((prev) => new Set(prev).add(uuid));
      setClickedPoint(null);
      queryClient.invalidateQueries({ queryKey: ['goldenCoverage'] });
      queryClient.invalidateQueries({ queryKey: ['golden'] });
      queryClient.invalidateQueries({ queryKey: ['goldenStats'] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="bg-bg-card border border-border-default rounded-[14px] px-4 py-3 card-shadow">
        <p className="text-xs text-text-secondary leading-relaxed">
          {t('analysis.coverageDesc')}
        </p>
      </div>

      {/* Function filter (dropdown) */}
      {fnNames.length > 0 && (
        <select
          value={coverageFn}
          onChange={(e) => setCoverageFn(e.target.value)}
          className={cn(
            'w-full max-w-sm px-4 py-2 bg-bg-input border border-border-default rounded-[10px]',
            'text-xs text-text-primary',
            'focus:border-neon-lime focus-visible:ring-2 focus-visible:ring-neon-lime/50 outline-none transition-colors'
          )}
        >
          <option value="">{t('golden.allFilter')}</option>
          {fnNames.map((fn) => (
            <option key={fn} value={fn}>{fn}</option>
          ))}
        </select>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-neon-lime" />
        </div>
      ) : !data ? (
        <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
          <Map size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
          <p className="text-sm text-text-muted">{t('analysis.noData')}</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bg-card border border-border-default rounded-[16px] p-4 card-shadow">
              <p className="text-xs text-text-muted mb-1">{t('analysis.coverageScore')}</p>
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#1e1e1e" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none" stroke="#DFFF00" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - data.coverage_score)}`}
                      className="transition-[stroke-dashoffset] duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-neon-lime">{formatPercentage(data.coverage_score * 100)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-bg-card border border-border-default rounded-[16px] p-4 card-shadow">
              <p className="text-xs text-text-muted mb-1">{t('golden.executionsCount')}</p>
              <p className="text-xl font-bold text-neon-cyan">{formatNumber(data.total_executions)}</p>
            </div>
            <div className="bg-bg-card border border-border-default rounded-[16px] p-4 card-shadow">
              <p className="text-xs text-text-muted mb-1">{t('golden.goldenRecords')}</p>
              <p className="text-xl font-bold text-neon-lime">{formatNumber(data.golden_count)}</p>
            </div>
          </div>

          {/* Scatter plot */}
          {data.scatter.length > 0 && (() => {
            const xVals = data.scatter.map((d) => d.x);
            const yVals = data.scatter.map((d) => d.y);
            const xMin = Math.min(...xVals);
            const xMax = Math.max(...xVals);
            const yMin = Math.min(...yVals);
            const yMax = Math.max(...yVals);
            const xRange = xMax - xMin || 1;
            const yRange = yMax - yMin || 1;
            const pad = 30;
            const w = 600;
            const h = 400;

            return (
              <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
                <h3 className="text-sm font-medium text-text-secondary mb-4">{t('analysis.coverage')}</h3>
                <div className="relative">
                  <svg
                    viewBox={`0 0 ${w} ${h}`}
                    className="w-full"
                    style={{ maxHeight: 420 }}
                    onClick={() => setClickedPoint(null)}
                  >
                    {/* Grid */}
                    {[0.25, 0.5, 0.75].map((pct) => (
                      <line key={`h-${pct}`} x1={pad} y1={pad + pct * (h - 2 * pad)} x2={w - pad} y2={pad + pct * (h - 2 * pad)} stroke="#222" strokeWidth="0.5" />
                    ))}
                    {/* Execution points (circles) */}
                    {data.scatter.filter((p) => !p.is_golden).map((pt, i) => {
                      const cx = pad + ((pt.x - xMin) / xRange) * (w - 2 * pad);
                      const cy = pad + ((pt.y - yMin) / yRange) * (h - 2 * pad);
                      const isClicked = clickedPoint?.span_id === pt.span_id;
                      const isNewlyRegistered = pt.uuid ? covRegistered.has(pt.uuid) : false;
                      return (
                        <circle
                          key={`e-${i}`}
                          cx={cx} cy={cy} r={isClicked ? 5 : 3.5}
                          fill={isNewlyRegistered ? COVERAGE_COLORS.golden : COVERAGE_COLORS.execution}
                          fillOpacity={isClicked || isNewlyRegistered ? 0.9 : 0.5}
                          stroke={isClicked ? '#fff' : hovered?.span_id === pt.span_id ? '#fff' : 'none'}
                          strokeWidth={isClicked ? 2 : 1}
                          onMouseEnter={() => setHovered(pt)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={(e) => { e.stopPropagation(); if (!isNewlyRegistered) setClickedPoint(isClicked ? null : pt); }}
                          className="cursor-pointer"
                        />
                      );
                    })}
                    {/* Golden points (stars as larger circles with different style) */}
                    {data.scatter.filter((p) => p.is_golden).map((pt, i) => {
                      const cx = pad + ((pt.x - xMin) / xRange) * (w - 2 * pad);
                      const cy = pad + ((pt.y - yMin) / yRange) * (h - 2 * pad);
                      return (
                        <g key={`g-${i}`}>
                          <circle
                            cx={cx} cy={cy} r={6}
                            fill={COVERAGE_COLORS.golden} fillOpacity={0.8}
                            stroke="#fff" strokeWidth={1}
                            onMouseEnter={() => setHovered(pt)}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                          />
                          <text x={cx} y={cy + 1} textAnchor="middle" fontSize="7" fill="#111" fontWeight="bold">G</text>
                        </g>
                      );
                    })}
                  </svg>
                  {/* Tooltip / action panel */}
                  {(hovered || clickedPoint) && (
                    <div className={cn(
                      'absolute top-2 right-2 bg-bg-elevated border border-border-default rounded-[12px] px-4 py-3 text-xs space-y-1',
                      clickedPoint ? '' : 'pointer-events-none'
                    )}>
                      {(() => {
                        const pt = clickedPoint || hovered!;
                        return (
                          <>
                            <p className="font-medium text-text-primary">{pt.is_golden ? t('golden.goldenPoint') : t('golden.executionPoint')}</p>
                            <p className="text-text-muted">{pt.function_name}</p>
                            <p className="text-text-muted"><TruncatedText text={pt.span_id} maxLength={16} prefix="ID: " /></p>
                            {pt.duration_ms > 0 && (
                              <p className="text-text-muted">{formatDuration(pt.duration_ms)}</p>
                            )}
                            {clickedPoint && !clickedPoint.is_golden && clickedPoint.uuid && !covRegistered.has(clickedPoint.uuid) && (
                              <button
                                onClick={() => coverageRegisterMutation.mutate(clickedPoint.uuid!)}
                                disabled={coverageRegisterMutation.isPending}
                                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-neon-lime text-text-inverse rounded-[8px] text-xs font-medium hover:brightness-110 disabled:opacity-40 transition-[opacity,filter] w-full justify-center"
                              >
                                {coverageRegisterMutation.isPending ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Plus size={12} />
                                )}
                                {t('golden.registerAsGolden')}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div className="flex gap-4 mt-4 justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COVERAGE_COLORS.execution }} />
                    <span className="text-[10px] text-text-muted">{t('golden.executionPoint')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COVERAGE_COLORS.golden }} />
                    <span className="text-[10px] text-text-muted">{t('golden.goldenPoint')}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
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
            {(record.tags || []).length > 0 && (
              <div className="flex gap-1">
                {(record.tags || []).slice(0, 3).map((tag) => (
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
              <span className="text-text-muted">{t('golden.uuidLabel')}</span>
              <span className="ml-2 text-text-primary font-mono">{record.uuid}</span>
            </div>
            <div>
              <span className="text-text-muted">{t('golden.executionUuidLabel')}</span>
              <span className="ml-2 text-text-primary font-mono">{record.execution_uuid}</span>
            </div>
          </div>
          {(record.tags || []).length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag size={12} className="text-text-muted" />
              {(record.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 bg-neon-lime-dim text-neon-lime rounded-md"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {record.input_preview && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Input</p>
              <pre className="bg-bg-elevated rounded-[8px] p-2.5 text-xs text-text-secondary font-mono max-h-[120px] overflow-y-auto whitespace-pre-wrap break-all">
                {record.input_preview}
              </pre>
            </div>
          )}
          {record.output_preview && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Output</p>
              <pre className="bg-bg-elevated rounded-[8px] p-2.5 text-xs text-neon-lime/70 font-mono max-h-[120px] overflow-y-auto whitespace-pre-wrap break-all">
                {typeof record.output_preview === 'object' ? JSON.stringify(record.output_preview, null, 2) : record.output_preview}
              </pre>
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              disabled={deleting}
              aria-label={t('golden.delete')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neon-red hover:bg-neon-red-dim rounded-[8px] transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-neon-red/50"
            >
              <Trash2 size={12} />
              {deleting ? t('golden.deleting') : t('golden.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

