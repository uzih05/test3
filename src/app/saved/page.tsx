'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookmarkCheck,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  Bookmark,
  Lock,
  Crown,
} from 'lucide-react';
import { savedService } from '@/services/saved';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/lib/i18n';
import { timeAgo, cn } from '@/lib/utils';

const SOURCE_OPTIONS = [
  { value: '', labelKey: 'sourceAll' },
  { value: 'ask_ai', labelKey: 'sourceAskAi' },
  { value: 'healer', labelKey: 'sourceHealer' },
];

const SOURCE_ICONS: Record<string, typeof MessageSquare> = {
  ask_ai: MessageSquare,
  healer: Sparkles,
};

type FilterTab = 'all' | 'bookmarked';

export default function SavedPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isPro = user?.plan === 'pro';

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['savedResponses', sourceFilter, searchQuery, filterTab],
    queryFn: () =>
      savedService.list({
        source_type: sourceFilter || undefined,
        search: searchQuery || undefined,
        bookmarked: filterTab === 'bookmarked' ? true : undefined,
        limit: 100,
      }),
    staleTime: 0,
  });

  const bookmarkMutation = useMutation({
    mutationFn: (id: string) => savedService.toggleBookmark(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedResponses'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => savedService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedResponses'] });
    },
  });

  const items = data?.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-neon-lime/10">
          <BookmarkCheck size={24} className="text-neon-lime" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('saved.title', 'AI History')}</h1>
          <p className="text-sm text-text-muted">
            {data?.total ?? 0} {t('saved.responses', 'responses')}
          </p>
        </div>
      </div>

      {/* Free plan info */}
      {!isPro && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-neon-orange/10 border border-neon-orange/20">
          <Lock size={16} className="text-neon-orange shrink-0" />
          <p className="text-xs text-neon-orange flex-1">
            {t('saved.freeLimit', 'Free plan: responses older than 24 hours are locked. Upgrade to Pro for unlimited access.')}
          </p>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neon-lime/10 text-neon-lime text-xs font-medium shrink-0">
            <Crown size={12} />
            {t('plan.upgrade', 'Upgrade to Pro')}
          </div>
        </div>
      )}

      {/* Filter tabs + Source filter + Search */}
      <div className="flex flex-wrap items-center gap-3">
        {/* All / Bookmarked tabs */}
        <div className="flex bg-bg-card border border-border-default rounded-xl overflow-hidden">
          <button
            onClick={() => setFilterTab('all')}
            className={cn(
              'px-3 py-2 text-xs font-medium transition-colors',
              filterTab === 'all'
                ? 'bg-neon-lime-dim text-neon-lime'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            {t('saved.all', 'All')}
          </button>
          <button
            onClick={() => setFilterTab('bookmarked')}
            className={cn(
              'flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors',
              filterTab === 'bookmarked'
                ? 'bg-neon-lime-dim text-neon-lime'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Bookmark size={12} />
            {t('saved.bookmarked', 'Bookmarked')}
          </button>
        </div>

        {/* Source type filter */}
        <div className="flex bg-bg-card border border-border-default rounded-xl overflow-hidden">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSourceFilter(opt.value)}
              className={cn(
                'px-3 py-2 text-xs font-medium transition-colors',
                sourceFilter === opt.value
                  ? 'bg-neon-cyan-dim text-neon-cyan'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {t(`saved.${opt.labelKey}`)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('saved.search', 'Search responses...')}
            className="w-full bg-bg-card border border-border-default rounded-xl pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-lime"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-text-muted text-sm">
          {t('common.loading')}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <BookmarkCheck size={40} className="mx-auto mb-3 text-text-muted opacity-30" />
          <p className="text-sm text-text-muted">
            {filterTab === 'bookmarked'
              ? t('saved.noBookmarks', 'No bookmarked responses yet')
              : t('saved.empty', 'No AI responses yet. Ask AI or use Healer to get started.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const Icon = SOURCE_ICONS[item.source_type] || MessageSquare;
            const isLocked = item.locked;

            return (
              <div
                key={item.id}
                className={cn(
                  'bg-bg-card border rounded-2xl overflow-hidden',
                  isLocked ? 'border-border-default opacity-60' : 'border-border-default'
                )}
              >
                {/* Header row */}
                <button
                  onClick={() => !isLocked && setExpandedId(isExpanded ? null : item.id)}
                  disabled={isLocked}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-4 text-left transition-colors',
                    isLocked ? 'cursor-not-allowed' : 'hover:bg-bg-secondary/50'
                  )}
                >
                  <div className={cn(
                    'p-1.5 rounded-lg shrink-0',
                    item.source_type === 'ask_ai' ? 'bg-neon-cyan/10' : 'bg-neon-lime/10'
                  )}>
                    <Icon size={14} className={
                      item.source_type === 'ask_ai' ? 'text-neon-cyan' : 'text-neon-lime'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{item.question}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded">
                        {item.source_type.replace('_', ' ')}
                      </span>
                      {item.function_name && (
                        <span className="text-xs text-text-muted">{item.function_name}</span>
                      )}
                      <span className="text-xs text-text-muted">{timeAgo(item.created_at)}</span>
                      {item.is_bookmarked && (
                        <Bookmark size={12} className="text-neon-lime fill-current" />
                      )}
                    </div>
                  </div>
                  {isLocked ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Lock size={14} className="text-text-muted" />
                      <span className="text-[10px] text-text-muted">Pro</span>
                    </div>
                  ) : isExpanded ? (
                    <ChevronUp size={16} className="text-text-muted shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-text-muted shrink-0" />
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && !isLocked && (
                  <div className="border-t border-border-default">
                    <div className="px-5 py-4">
                      <pre className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                        {item.answer}
                      </pre>
                    </div>
                    <div className="px-5 py-3 border-t border-border-default flex justify-between">
                      <button
                        onClick={() => bookmarkMutation.mutate(item.id)}
                        disabled={bookmarkMutation.isPending}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          item.is_bookmarked
                            ? 'bg-neon-lime/10 text-neon-lime'
                            : 'text-text-muted hover:text-text-primary hover:bg-bg-secondary'
                        )}
                      >
                        <Bookmark size={14} className={item.is_bookmarked ? 'fill-current' : ''} />
                        {item.is_bookmarked ? t('saved.bookmarked', 'Bookmarked') : t('saved.bookmark', 'Bookmark')}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(t('saved.confirmDelete', 'Delete this response?'))) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-neon-red hover:bg-neon-red/10 transition-colors"
                      >
                        <Trash2 size={14} />
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
