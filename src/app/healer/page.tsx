'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Bookmark,
} from 'lucide-react';
import { healerService } from '@/services/healer';
import { savedService } from '@/services/saved';
import { useAuthStore } from '@/stores/authStore';
import { usePagePreferencesStore } from '@/stores/pagePreferencesStore';
import { useTranslation } from '@/lib/i18n';
import { timeAgo, cn } from '@/lib/utils';
import type { DiagnosisResult, HealableFunction } from '@/types';

const TIME_RANGE_OPTIONS = [
  { value: 60, label: '1h' },
  { value: 180, label: '3h' },
  { value: 360, label: '6h' },
  { value: 720, label: '12h' },
  { value: 1440, label: '24h' },
  { value: 4320, label: '3d' },
  { value: 10080, label: '7d' },
  { value: 0, label: 'All' },
];

export default function HealerPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const mode = usePagePreferencesStore((s) => s.healerMode);
  const setMode = usePagePreferencesStore((s) => s.setHealerMode);
  const [functionFilter, setFunctionFilter] = useState('');
  const timeRangeFilter = usePagePreferencesStore((s) => s.healerTimeRangeFilter);
  const setTimeRangeFilter = usePagePreferencesStore((s) => s.setHealerTimeRangeFilter);
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  const [lookback, setLookback] = useState(1440);

  const handleTimeRangeChange = (value: number) => {
    setTimeRangeFilter(value);
    // "All"(0) 선택 시 lookback은 변경하지 않음 (사용자가 자유롭게 설정)
    if (value > 0) {
      setLookback(Math.min(lookback, value));
    }
  };

  // 슬라이더 최대값: 특정 시간대 선택 시 해당 범위, "All" 선택 시 7일
  const lookbackMax = timeRangeFilter === 0 ? 10080 : timeRangeFilter;
  const [checkedFunctions, setCheckedFunctions] = useState<Set<string>>(new Set());

  // Single diagnosis result
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  // Batch results
  const [batchResults, setBatchResults] = useState<DiagnosisResult[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['healerFunctions', timeRangeFilter],
    queryFn: () => healerService.functions(timeRangeFilter),
    refetchInterval: 60_000,
  });

  const functions = (data?.items || []).filter(
    (fn) => !functionFilter || fn.function_name.toLowerCase().includes(functionFilter.toLowerCase())
  );

  const diagnoseMutation = useMutation({
    mutationFn: (fnName: string) => healerService.diagnose(fnName, lookback),
    onSuccess: (result) => setDiagnosis(result),
  });

  const batchMutation = useMutation({
    mutationFn: (names: string[]) => healerService.diagnoseBatch(names, lookback),
    onSuccess: (data) => setBatchResults(data.results || []),
  });

  const handleCheck = (name: string) => {
    const next = new Set(checkedFunctions);
    if (next.has(name)) next.delete(name); else next.add(name);
    setCheckedFunctions(next);
  };

  const handleSelectAll = () => {
    if (checkedFunctions.size === functions.length) {
      setCheckedFunctions(new Set());
    } else {
      setCheckedFunctions(new Set(functions.map((f) => f.function_name)));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // No OpenAI key warning
  if (!user?.has_openai_key) {
    return (
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-6">{t('healer.title')}</h1>
        <div className="bg-bg-card border border-status-warning/30 rounded-[20px] p-8 text-center card-shadow">
          <KeyRound size={32} className="mx-auto mb-4 text-status-warning" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">{t('healer.apiKeyRequired')}</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">{t('healer.noOpenaiKey')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">{t('healer.title')}</h1>
        <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
          {(['single', 'batch'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setDiagnosis(null); setBatchResults([]); }}
              className={cn(
                'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors capitalize',
                mode === m ? 'bg-accent-primary text-text-inverse' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {t(`healer.${m}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left panel: Function list */}
        <div className="lg:col-span-2 bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
          {/* Filters */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={functionFilter}
                onChange={(e) => setFunctionFilter(e.target.value)}
                placeholder={t('healer.filterPlaceholder')}
                className={cn(
                  'w-full pl-9 pr-4 py-2 bg-bg-input border border-border-default rounded-[10px]',
                  'text-sm text-text-primary placeholder:text-text-muted',
                  'focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 outline-none transition-colors'
                )}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTimeRangeChange(opt.value)}
                  className={cn(
                    'px-2 py-1 rounded-[6px] text-[10px] font-medium transition-colors',
                    timeRangeFilter === opt.value
                      ? 'bg-accent-primary text-text-inverse'
                      : 'bg-bg-elevated text-text-muted hover:text-text-primary'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Lookback slider */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">{t('healer.lookback')}</span>
              <input
                type="range" min={lookbackMax >= 1440 ? 60 : 5} max={lookbackMax} step={lookbackMax >= 1440 ? 60 : 5}
                value={Math.min(lookback, lookbackMax)}
                onChange={(e) => setLookback(parseInt(e.target.value))}
                className="flex-1 h-1 accent-accent-primary"
              />
              <span className="text-[10px] text-accent-primary font-mono w-16 text-right">
                {lookback >= 1440 ? `${(lookback / 1440).toFixed(1)}d` : lookback >= 60 ? `${(lookback / 60).toFixed(1)}h` : `${lookback}m`}
              </span>
            </div>
          </div>

          {/* Batch select all */}
          {mode === 'batch' && functions.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="text-xs text-accent-primary hover:underline mb-3"
            >
              {checkedFunctions.size === functions.length ? t('healer.deselectAll') : t('healer.selectAll')}
            </button>
          )}

          {/* Function list */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-accent-primary" />
            </div>
          ) : functions.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-muted">{t('healer.noFunctions')}</div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {functions.map((fn) => (
                <FunctionItem
                  key={fn.function_name}
                  fn={fn}
                  mode={mode}
                  isSelected={selectedFunction === fn.function_name}
                  isChecked={checkedFunctions.has(fn.function_name)}
                  onSelect={() => { setSelectedFunction(fn.function_name); setDiagnosis(null); }}
                  onCheck={() => handleCheck(fn.function_name)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel: Results */}
        <div className="lg:col-span-3 space-y-4">
          {mode === 'single' ? (
            <>
              {/* Selected function info */}
              {selectedFunction && (
                <div className="bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{selectedFunction}</h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        {t('healer.lookback')} {lookback >= 1440 ? `${(lookback / 1440).toFixed(1)}d` : lookback >= 60 ? `${(lookback / 60).toFixed(1)}h` : `${lookback}m`}
                      </p>
                    </div>
                    <button
                      onClick={() => diagnoseMutation.mutate(selectedFunction)}
                      disabled={diagnoseMutation.isPending}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-sm font-semibold transition-[opacity,filter]',
                        'bg-accent-primary text-text-inverse hover:brightness-110 accent-glow',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      {diagnoseMutation.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      {t('healer.diagnose')}
                    </button>
                  </div>

                  {/* Diagnosis result */}
                  {diagnosis && <DiagnosisCard result={diagnosis} onCopy={handleCopy} isPro={user?.plan === 'pro'} />}
                </div>
              )}

              {!selectedFunction && (
                <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center card-shadow">
                  <Sparkles size={28} className="mx-auto mb-3 text-text-muted opacity-40" />
                  <p className="text-sm text-text-muted">{t('healer.selectFunction')}</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Batch diagnose button */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  {checkedFunctions.size} {t('healer.selected')}
                </span>
                <button
                  onClick={() => batchMutation.mutate([...checkedFunctions])}
                  disabled={checkedFunctions.size === 0 || batchMutation.isPending}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-sm font-semibold transition-[opacity,filter]',
                    'bg-accent-primary text-text-inverse hover:brightness-110 accent-glow',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {batchMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {t('healer.batchDiagnose')} ({checkedFunctions.size})
                </button>
              </div>

              {/* Batch progress */}
              {batchMutation.isPending && (
                <div className="bg-bg-card border border-border-default rounded-[16px] p-4 card-shadow">
                  <div className="flex items-center gap-3">
                    <Loader2 size={16} className="animate-spin text-accent-primary" />
                    <span className="text-sm text-text-secondary">{t('healer.diagnosing')} {checkedFunctions.size} functions...</span>
                  </div>
                  <div className="mt-3 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div className="h-full bg-accent-primary rounded-full w-full animate-pulse" />
                  </div>
                </div>
              )}

              {/* Batch results */}
              {batchResults.length > 0 && (
                <div className="space-y-3">
                  {batchResults.map((result) => (
                    <div key={result.function_name} className="bg-bg-card border border-border-default rounded-[16px] card-shadow overflow-hidden">
                      <button
                        onClick={() => setExpandedBatch(expandedBatch === result.function_name ? null : result.function_name)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-bg-card-hover transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {result.status === 'success' ? (
                            <CheckCircle2 size={14} className="text-accent-secondary" />
                          ) : result.status === 'no_errors' ? (
                            <CheckCircle2 size={14} className="text-accent-primary" />
                          ) : (
                            <AlertTriangle size={14} className="text-status-error" />
                          )}
                          <span className="text-sm font-medium text-text-primary">{result.function_name}</span>
                        </div>
                        {expandedBatch === result.function_name ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                      </button>
                      {expandedBatch === result.function_name && (
                        <div className="px-5 pb-4">
                          <DiagnosisCard result={result} onCopy={handleCopy} isPro={user?.plan === 'pro'} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* === Sub-components === */

function FunctionItem({
  fn,
  mode,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
}: {
  fn: HealableFunction;
  mode: 'single' | 'batch';
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      onClick={mode === 'single' ? onSelect : onCheck}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-[12px] cursor-pointer transition-colors',
        isSelected ? 'bg-accent-primary-dim border border-accent-primary/30' :
        isChecked ? 'bg-accent-primary-dim/50' :
        'hover:bg-bg-card-hover'
      )}
    >
      {mode === 'batch' && (
        <div className={cn(
          'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
          isChecked ? 'bg-accent-primary border-accent-primary' : 'border-border-default'
        )}>
          {isChecked && <CheckCircle2 size={10} className="text-text-inverse" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{fn.function_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-status-error font-medium">{fn.error_count} {t('healer.errorCount')}</span>
          <span className="text-[10px] text-text-muted">{timeAgo(fn.last_error)}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 shrink-0">
        {(fn.error_codes || []).slice(0, 2).map((code) => (
          <span key={code} className="text-[9px] px-1.5 py-0.5 bg-status-error-dim text-status-error rounded-md">
            {code}
          </span>
        ))}
      </div>
    </div>
  );
}

function DiagnosisCard({
  result,
  onCopy,
  isPro,
}: {
  result: DiagnosisResult;
  onCopy: (text: string) => void;
  isPro?: boolean;
}) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await savedService.save({
        question: `[Healer] ${result.function_name} (${result.lookback_minutes}min)`,
        answer: [result.diagnosis, result.suggested_fix].filter(Boolean).join('\n\n--- Suggested Fix ---\n\n'),
        source_type: 'healer',
        function_name: result.function_name,
      });
      setSaved(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {result.status === 'no_errors' ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-accent-secondary-dim rounded-[12px] text-sm text-accent-secondary">
          <CheckCircle2 size={16} />
          {t('healer.noErrors')}
        </div>
      ) : (
        <div className={cn('grid gap-4', result.suggested_fix ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
          {/* Diagnosis */}
          <div>
            <p className="text-xs text-text-muted mb-1.5">{t('healer.diagnosis')}</p>
            <div className="bg-bg-elevated rounded-[12px] p-4 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed h-full max-h-[350px] overflow-y-auto">
              {result.diagnosis}
            </div>
          </div>

          {/* Suggested fix */}
          {result.suggested_fix && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-text-muted">{t('healer.suggestedFix')}</p>
                <div className="flex items-center gap-2">
                  {isPro ? (
                    <button
                      onClick={handleSave}
                      disabled={saved || saving}
                      className={cn(
                        'flex items-center gap-1 text-xs transition-colors',
                        saved ? 'text-accent-primary' : 'text-text-muted hover:text-accent-primary'
                      )}
                    >
                      <Bookmark size={12} />
                      {saved ? 'Saved' : 'Save'}
                    </button>
                  ) : (
                    <span className="text-[9px] text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded uppercase">Pro</span>
                  )}
                  <button
                    onClick={() => onCopy(result.suggested_fix!)}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-accent-primary transition-colors"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
              </div>
              <pre className="bg-[#0d1117] border border-border-default rounded-[12px] p-4 text-xs whitespace-pre-wrap font-mono overflow-x-auto max-h-[350px] overflow-y-auto">
                <code dangerouslySetInnerHTML={{ __html: highlightPython(result.suggested_fix) }} />
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function highlightPython(code: string): string {
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    // Comments
    .replace(/(#.*)/g, '<span style="color:#6a9955">$1</span>')
    // Strings (double and single quoted)
    .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span style="color:#ce9178">$&</span>')
    // Keywords
    .replace(/\b(def|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|try|except|finally|raise|import|from|class|with|as|pass|break|continue|lambda|yield)\b/g,
      '<span style="color:#c586c0">$1</span>')
    // Built-in functions
    .replace(/\b(print|len|range|int|str|float|list|dict|set|tuple|type|isinstance|round|max|min|abs|sum|sorted|enumerate|zip|map|filter)\b/g,
      '<span style="color:#dcdcaa">$1</span>')
    // Numbers
    .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#b5cea8">$1</span>')
    // Function definitions
    .replace(/\b(def)\s+(\w+)/g, '<span style="color:#c586c0">$1</span> <span style="color:#dcdcaa">$2</span>');
}
