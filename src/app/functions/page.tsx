'use client';

import { useState, useMemo } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  LayoutGrid,
  TreePine,
  Sparkles,
  Loader2,
  MessageSquare,
  Send,
  ChevronRight,
  FolderOpen,
  Code2,
} from 'lucide-react';
import { functionsService } from '@/services/functions';
import { useTranslation } from '@/lib/i18n';
import { FunctionDetail } from '@/components/FunctionDetail';
import { formatNumber, formatDuration, formatPercentage, cn } from '@/lib/utils';
import type { FunctionInfo } from '@/types';

type SortKey = 'execution_count' | 'error_rate' | 'avg_duration_ms' | 'name';

export default function FunctionsPage() {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'semantic' | 'hybrid'>('hybrid');
  const [alpha, setAlpha] = useState(0.5);
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('grid');
  const [sortBy, setSortBy] = useState<SortKey>('execution_count');
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  const [askQuery, setAskQuery] = useState('');
  const [showAsk, setShowAsk] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // All functions
  const { data: allData, isLoading: loadingAll } = useQuery({
    queryKey: ['functions'],
    queryFn: () => functionsService.list(),
    refetchInterval: 30_000,
  });

  // Search results
  const { data: searchData, isLoading: searching } = useQuery({
    queryKey: ['functionSearch', debouncedSearchQuery, searchMode, alpha],
    queryFn: () =>
      searchMode === 'semantic'
        ? functionsService.search(debouncedSearchQuery, 20)
        : functionsService.hybridSearch(debouncedSearchQuery, alpha),
    enabled: debouncedSearchQuery.length > 1,
  });

  // AI QnA
  const { data: askData, isLoading: asking } = useQuery({
    queryKey: ['functionAsk', askQuery],
    queryFn: () => functionsService.ask(askQuery),
    enabled: !!askQuery && showAsk,
  });

  const functions: FunctionInfo[] = debouncedSearchQuery.length > 1
    ? (searchData?.items || [])
    : (allData?.items || []);

  // Sort
  const sorted = useMemo(() => {
    return [...functions].sort((a, b) => {
      if (sortBy === 'name') return a.function_name.localeCompare(b.function_name);
      return ((b[sortBy] as number) || 0) - ((a[sortBy] as number) || 0);
    });
  }, [functions, sortBy]);

  // Tree structure
  const treeNodes = useMemo(() => {
    if (viewMode !== 'tree') return null;
    return buildTree(sorted);
  }, [sorted, viewMode]);

  const isLoading = loadingAll || (debouncedSearchQuery.length > 1 && searching);

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (askQuery.trim()) setShowAsk(true);
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary mb-6">{t('functions.title')}</h1>

      {/* Search & Controls */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('functions.searchPlaceholder')}
              className={cn(
                'w-full pl-9 pr-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                'text-sm text-text-primary placeholder:text-text-muted',
                'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
              )}
            />
          </div>

          {/* Search mode */}
          <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
            {(['semantic', 'hybrid'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSearchMode(mode)}
                className={cn(
                  'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors capitalize',
                  searchMode === mode ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
                )}
              >
                {t(`functions.${mode}`)}
              </button>
            ))}
          </div>

          {/* View mode */}
          <div className="flex gap-1 bg-bg-card rounded-[12px] p-1 border border-border-default">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-[8px] transition-colors',
                viewMode === 'grid' ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={cn(
                'p-1.5 rounded-[8px] transition-colors',
                viewMode === 'tree' ? 'bg-neon-lime text-text-inverse' : 'text-text-muted hover:text-text-primary'
              )}
            >
              <TreePine size={14} />
            </button>
          </div>
        </div>

        {/* Hybrid alpha slider */}
        {searchMode === 'hybrid' && searchQuery.length > 1 && (
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-text-muted">{t('functions.keyword')}</span>
            <input
              type="range"
              min={0} max={1} step={0.1}
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-neon-lime"
            />
            <span className="text-xs text-text-muted">{t('functions.vector')}</span>
            <span className="text-xs text-neon-lime font-mono w-8 text-right">{(alpha * 100).toFixed(0)}%</span>
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{t('functions.sortLabel')}</span>
          {([
            { key: 'execution_count' as SortKey, label: t('functions.sortExecutions') },
            { key: 'error_rate' as SortKey, label: t('functions.sortErrorRate') },
            { key: 'avg_duration_ms' as SortKey, label: t('functions.sortDuration') },
            { key: 'name' as SortKey, label: t('functions.sortName') },
          ]).map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={cn(
                'px-2.5 py-1 rounded-[8px] text-xs transition-colors',
                sortBy === s.key ? 'bg-neon-lime-dim text-neon-lime' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-neon-lime" />
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((fn) => (
            <button
              key={fn.function_name}
              onClick={() => setSelectedFunction(fn.function_name)}
              className="bg-bg-card border border-border-default rounded-[16px] p-5 text-left hover:border-border-hover hover:bg-bg-card-hover transition-[border-color,background-color] group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Code2 size={14} className="text-neon-lime shrink-0" />
                  <span className="text-sm font-medium text-text-primary truncate">{fn.function_name}</span>
                </div>
                <ChevronRight size={14} className="text-text-muted group-hover:text-neon-lime transition-colors shrink-0" />
              </div>
              {fn.description && (
                <p className="text-xs text-text-muted mb-3 line-clamp-2">{fn.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs">
                <span className="text-text-secondary">
                  <span className="text-neon-lime font-semibold">{formatNumber(fn.execution_count || 0)}</span> {t('functions.runs')}
                </span>
                <span className="text-text-secondary">
                  <span className="text-neon-cyan font-semibold">{formatDuration(fn.avg_duration_ms || 0)}</span> {t('functions.avg')}
                </span>
                {(fn.error_rate || 0) > 0 && (
                  <span className="text-neon-red font-semibold">{formatPercentage(fn.error_rate || 0)} {t('functions.err')}</span>
                )}
              </div>
              {fn.team && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-bg-elevated rounded-md text-text-muted">
                  {fn.team}
                </span>
              )}
            </button>
          ))}
          {sorted.length === 0 && (
            <div className="col-span-full text-center py-12 text-text-muted text-sm">
              {t('common.noData')}
            </div>
          )}
        </div>
      ) : (
        /* Tree view */
        <div className="bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
          {treeNodes && treeNodes.length > 0 ? (
            treeNodes.map((node) => (
              <TreeNode key={node.path} node={node} onSelect={setSelectedFunction} />
            ))
          ) : (
            <div className="text-center py-12 text-text-muted text-sm">{t('common.noData')}</div>
          )}
        </div>
      )}

      {/* AI QnA */}
      <div className="mt-6 bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-neon-lime" />
          <h3 className="text-sm font-medium text-text-primary">{t('functions.ask')}</h3>
        </div>
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            value={askQuery}
            onChange={(e) => { setAskQuery(e.target.value); setShowAsk(false); }}
            placeholder={t('functions.askPlaceholder')}
            className={cn(
              'flex-1 px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
              'text-sm text-text-primary placeholder:text-text-muted',
              'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
            )}
          />
          <button
            type="submit"
            disabled={!askQuery.trim() || asking}
            className="px-4 py-2.5 bg-neon-lime text-text-inverse rounded-[12px] text-sm font-medium hover:brightness-110 disabled:opacity-40 transition-[opacity,filter]"
          >
            {asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        {showAsk && askData && (
          <div className="mt-4 bg-bg-elevated rounded-[14px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={12} className="text-neon-cyan" />
              <span className="text-xs text-text-muted">{askData.query}</span>
            </div>
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
              {askData.answer}
            </p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedFunction && (
        <FunctionDetail
          name={selectedFunction}
          onClose={() => setSelectedFunction(null)}
        />
      )}
    </div>
  );
}

/* === Tree utilities === */

interface TreeNodeData {
  path: string;
  name: string;
  children: TreeNodeData[];
  functions: FunctionInfo[];
  totalExecutions: number;
  avgErrorRate: number;
}

function buildTree(functions: FunctionInfo[]): TreeNodeData[] {
  const root: TreeNodeData = { path: '', name: '', children: [], functions: [], totalExecutions: 0, avgErrorRate: 0 };

  for (const fn of functions) {
    const parts = (fn.file_path || fn.module || fn.function_name).split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = { path: parts.slice(0, i + 1).join('/'), name: part, children: [], functions: [], totalExecutions: 0, avgErrorRate: 0 };
        current.children.push(child);
      }
      current = child;
    }
    current.functions.push(fn);
    current.totalExecutions += fn.execution_count || 0;
  }

  // Calculate stats recursively
  function calcStats(node: TreeNodeData): void {
    for (const child of node.children) {
      calcStats(child);
      node.totalExecutions += child.totalExecutions;
    }
    const allFns = getAllFunctions(node);
    if (allFns.length > 0) {
      node.avgErrorRate = allFns.reduce((sum, f) => sum + (f.error_rate || 0), 0) / allFns.length;
    }
  }

  function getAllFunctions(node: TreeNodeData): FunctionInfo[] {
    const result = [...node.functions];
    for (const child of node.children) {
      result.push(...getAllFunctions(child));
    }
    return result;
  }

  calcStats(root);
  return root.children.length > 0 ? root.children : root.functions.map((fn) => ({
    path: fn.function_name,
    name: fn.function_name,
    children: [],
    functions: [fn],
    totalExecutions: fn.execution_count || 0,
    avgErrorRate: fn.error_rate || 0,
  }));
}

function TreeNode({ node, onSelect, depth = 0 }: { node: TreeNodeData; onSelect: (name: string) => void; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0 || node.functions.length > 0;
  const isLeaf = node.children.length === 0 && node.functions.length <= 1;

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-[8px] hover:bg-bg-card-hover cursor-pointer transition-colors group"
        onClick={() => {
          if (isLeaf && node.functions[0]) {
            onSelect(node.functions[0].function_name);
          } else {
            setOpen(!open);
          }
        }}
      >
        {isLeaf ? (
          <Code2 size={14} className="text-neon-lime shrink-0" />
        ) : (
          <FolderOpen size={14} className={cn('shrink-0', open ? 'text-neon-lime' : 'text-text-muted')} />
        )}
        <span className="text-sm text-text-primary flex-1 truncate">{node.name}</span>
        <span className="text-[10px] text-text-muted">{formatNumber(node.totalExecutions)}</span>
        {node.avgErrorRate > 0 && (
          <span className="text-[10px] text-neon-red">{formatPercentage(node.avgErrorRate)}</span>
        )}
      </div>

      {open && hasChildren && (
        <>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} onSelect={onSelect} depth={depth + 1} />
          ))}
          {node.functions.map((fn) => (
            <div
              key={fn.function_name}
              style={{ marginLeft: (depth + 1) * 16 }}
              onClick={() => onSelect(fn.function_name)}
              className="flex items-center gap-2 py-1.5 px-2 rounded-[8px] hover:bg-bg-card-hover cursor-pointer transition-colors"
            >
              <Code2 size={14} className="text-neon-lime shrink-0" />
              <span className="text-sm text-text-primary flex-1 truncate">{fn.function_name}</span>
              <span className="text-[10px] text-text-muted">{formatNumber(fn.execution_count || 0)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
