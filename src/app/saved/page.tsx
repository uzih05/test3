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
  Lock,
  Crown,
} from 'lucide-react';
import { savedService } from '@/services/saved';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/lib/i18n';
import { timeAgo, cn } from '@/lib/utils';

const SOURCE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ask_ai', label: 'Ask AI' },
  { value: 'healer', label: 'Healer' },
];

const SOURCE_ICONS: Record<string, typeof MessageSquare> = {
  ask_ai: MessageSquare,
  healer: Sparkles,
};

export default function SavedPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isPro = user?.plan === 'pro';

  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['savedResponses', sourceFilter, searchQuery],
    queryFn: () =>
      savedService.list({
        source_type: sourceFilter || undefined,
        search: searchQuery || undefined,
        limit: 100,
      }),
    enabled: isPro,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => savedService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedResponses'] });
    },
  });

  const items = data?.items || [];

  // Pro gate
  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="p-4 rounded-2xl bg-neon-lime/10">
          <Lock size={40} className="text-neon-lime" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-text-primary mb-2">
            {t('saved.proOnly', 'Saved Responses is a Pro feature')}
          </h2>
          <p className="text-sm text-text-muted max-w-md">
            {t('saved.proDesc', 'Upgrade to Pro to save and organize your AI responses for easy reference.')}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-lime/10 text-neon-lime text-sm font-medium">
          <Crown size={16} />
          {t('plan.upgrade', 'Upgrade to Pro')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-neon-lime/10">
          <BookmarkCheck size={24} className="text-neon-lime" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('saved.title', 'Saved Responses')}</h1>
          <p className="text-sm text-text-muted">
            {data?.total ?? 0} {t('saved.responses', 'responses')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Source type filter */}
        <div className="flex bg-bg-card border border-border-default rounded-xl overflow-hidden">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSourceFilter(opt.value)}
              className={cn(
                'px-3 py-2 text-xs font-medium transition-colors',
                sourceFilter === opt.value
                  ? 'bg-neon-lime-dim text-neon-lime'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {opt.label}
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
          <p className="text-sm text-text-muted">{t('saved.empty', 'No saved responses yet')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const Icon = SOURCE_ICONS[item.source_type] || MessageSquare;

            return (
              <div
                key={item.id}
                className="bg-bg-card border border-border-default rounded-2xl overflow-hidden"
              >
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-bg-secondary/50 transition-colors"
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
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-text-muted shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-text-muted shrink-0" />
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border-default">
                    <div className="px-5 py-4">
                      <pre className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                        {item.answer}
                      </pre>
                    </div>
                    <div className="px-5 py-3 border-t border-border-default flex justify-end">
                      <button
                        onClick={() => {
                          if (confirm(t('saved.confirmDelete', 'Delete this saved response?'))) {
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
