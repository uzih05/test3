'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
  Loader2,
  KeyRound,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { askAiService } from '@/services/askAi';
import { savedService } from '@/services/saved';
import { planService } from '@/services/plan';
import { functionsService } from '@/services/functions';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import type { AskAiResponse } from '@/types';

export default function AskAiPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [question, setQuestion] = useState('');
  const [selectedFunction, setSelectedFunction] = useState('');
  const [result, setResult] = useState<AskAiResponse & { saved_id?: string } | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  const isPro = user?.plan === 'pro';

  const { data: planInfo, refetch: refetchPlan } = useQuery({
    queryKey: ['planInfo'],
    queryFn: () => planService.info(),
    enabled: !isPro,
    staleTime: 10 * 60_000,
  });

  const { data: functionsData } = useQuery({
    queryKey: ['functionsList'],
    queryFn: () => functionsService.list(),
    staleTime: 30 * 60_000,
  });

  const functions = functionsData?.items || [];

  const askMutation = useMutation({
    mutationFn: () => askAiService.ask(question, selectedFunction || undefined),
    onSuccess: (data) => {
      setResult(data);
      setBookmarked(false);
      refetchPlan();
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: () => {
      if (!result?.saved_id) throw new Error('No saved_id');
      return savedService.toggleBookmark(result.saved_id);
    },
    onSuccess: (data) => setBookmarked(data.is_bookmarked),
  });

  const hasOpenAiKey = user?.has_openai_key;
  const canUseAi = planInfo?.can_use_ai !== false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent-secondary/10">
            <MessageSquare size={24} className="text-accent-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t('ask.title', 'Ask AI')}</h1>
            <p className="text-sm text-text-muted">{t('ask.subtitle', 'Ask questions about your monitored functions')}</p>
          </div>
        </div>
        {planInfo && !isPro && (
          <div className="flex items-center gap-3 bg-bg-card px-3 py-1.5 rounded-lg">
            <span className="text-sm text-text-muted">
              {planInfo.usage_today}/{planInfo.daily_limit} {t('ask.callsToday', 'calls today')}
            </span>
            <div className="w-16 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  planInfo.usage_today >= (planInfo.daily_limit ?? 5) ? 'bg-status-error' : 'bg-accent-secondary'
                )}
                style={{ width: `${Math.min((planInfo.usage_today / (planInfo.daily_limit ?? 5)) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* OpenAI key warning */}
      {!hasOpenAiKey && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-status-warning/10 border border-status-warning/30">
          <KeyRound size={20} className="text-status-warning shrink-0" />
          <p className="text-sm text-status-warning">{t('healer.noOpenaiKey')}</p>
        </div>
      )}

      {/* Input area */}
      <div className="bg-bg-card border border-border-default rounded-2xl p-6 space-y-4">
        {/* Function selector */}
        <div>
          <label className="text-xs text-text-muted mb-1.5 block">{t('ask.scope', 'Scope')}</label>
          <select
            value={selectedFunction}
            onChange={(e) => setSelectedFunction(e.target.value)}
            className="w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-secondary"
          >
            <option value="">{t('ask.allFunctions', 'All Functions')}</option>
            {functions.map((fn) => (
              <option key={fn.function_name} value={fn.function_name}>
                {fn.function_name}
              </option>
            ))}
          </select>
        </div>

        {/* Question input */}
        <div>
          <label className="text-xs text-text-muted mb-1.5 block">{t('ask.question', 'Question')}</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('ask.placeholder', 'Ask a question about your functions...')}
            rows={4}
            className="w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent-secondary"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-text-muted">
            {!canUseAi && !isPro && (
              <span className="text-status-warning">{t('ask.limitReached', 'Daily limit reached. Upgrade to Pro for unlimited access.')}</span>
            )}
          </div>
          <button
            onClick={() => askMutation.mutate()}
            disabled={!question.trim() || !hasOpenAiKey || !canUseAi || askMutation.isPending}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
              'bg-accent-secondary text-text-inverse hover:brightness-110',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {askMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {t('ask.submit', 'Ask')}
          </button>
        </div>
      </div>

      {/* Error */}
      {askMutation.isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-status-error/10 border border-status-error/30">
          <AlertTriangle size={20} className="text-status-error shrink-0" />
          <p className="text-sm text-status-error">
            {(askMutation.error as { message?: string })?.message || t('ask.failedResponse')}
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-bg-card border border-border-default rounded-2xl overflow-hidden">
          {/* Question */}
          <div className="px-6 py-4 border-b border-border-default bg-bg-secondary/50">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-accent-secondary/10 mt-0.5">
                <MessageSquare size={14} className="text-accent-secondary" />
              </div>
              <div>
                <p className="text-sm text-text-primary font-medium">{result.question}</p>
                {result.function_name && (
                  <span className="text-xs text-text-muted mt-1 inline-block">
                    {result.function_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Answer */}
          <div className="px-6 py-4">
            <MarkdownRenderer content={result.answer} />
          </div>

          {/* Actions */}
          <div className="px-6 py-3 border-t border-border-default flex items-center justify-between">
            <div className="flex items-center gap-2">
              {result.status === 'success' && (
                <span className="flex items-center gap-1 text-xs text-accent-primary">
                  <CheckCircle2 size={14} /> {t('ask.success', 'Success')}
                </span>
              )}
            </div>
            {result.saved_id && (
              <button
                onClick={() => bookmarkMutation.mutate()}
                disabled={bookmarkMutation.isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  bookmarked
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : 'bg-bg-secondary text-text-muted hover:text-text-primary hover:bg-bg-card'
                )}
              >
                <Bookmark size={14} className={bookmarked ? 'fill-current' : ''} />
                {bookmarked ? t('ask.bookmarked', 'Bookmarked') : t('ask.bookmark', 'Bookmark')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
