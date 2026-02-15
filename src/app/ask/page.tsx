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
import type { AskAiResponse } from '@/types';

export default function AskAiPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [question, setQuestion] = useState('');
  const [selectedFunction, setSelectedFunction] = useState('');
  const [result, setResult] = useState<AskAiResponse | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: planInfo, refetch: refetchPlan } = useQuery({
    queryKey: ['planInfo'],
    queryFn: () => planService.info(),
  });

  const { data: functionsData } = useQuery({
    queryKey: ['functionsList'],
    queryFn: () => functionsService.list(),
  });

  const functions = functionsData?.items || [];

  const askMutation = useMutation({
    mutationFn: () => askAiService.ask(question, selectedFunction || undefined),
    onSuccess: (data) => {
      setResult(data);
      setSaved(false);
      refetchPlan();
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!result) throw new Error('No result');
      return savedService.save({
        question: result.question,
        answer: result.answer,
        source_type: 'ask_ai',
        function_name: result.function_name || undefined,
      });
    },
    onSuccess: () => setSaved(true),
  });

  const hasOpenAiKey = user?.has_openai_key;
  const isPro = user?.plan === 'pro';
  const canUseAi = planInfo?.can_use_ai !== false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neon-cyan/10">
            <MessageSquare size={24} className="text-neon-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t('ask.title', 'Ask AI')}</h1>
            <p className="text-sm text-text-muted">{t('ask.subtitle', 'Ask questions about your monitored functions')}</p>
          </div>
        </div>
        {planInfo && !isPro && (
          <div className="text-sm text-text-muted bg-bg-card px-3 py-1.5 rounded-lg">
            {planInfo.usage_today}/{planInfo.daily_limit} {t('ask.callsToday', 'calls today')}
          </div>
        )}
      </div>

      {/* OpenAI key warning */}
      {!hasOpenAiKey && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-neon-orange/10 border border-neon-orange/30">
          <KeyRound size={20} className="text-neon-orange shrink-0" />
          <p className="text-sm text-neon-orange">{t('healer.noOpenaiKey')}</p>
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
            className="w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-neon-cyan"
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
            className="w-full bg-bg-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-neon-cyan"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-text-muted">
            {!canUseAi && !isPro && (
              <span className="text-neon-orange">{t('ask.limitReached', 'Daily limit reached. Upgrade to Pro for unlimited access.')}</span>
            )}
          </div>
          <button
            onClick={() => askMutation.mutate()}
            disabled={!question.trim() || !hasOpenAiKey || !canUseAi || askMutation.isPending}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
              'bg-neon-cyan text-text-inverse hover:brightness-110',
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
        <div className="flex items-center gap-3 p-4 rounded-xl bg-neon-red/10 border border-neon-red/30">
          <AlertTriangle size={20} className="text-neon-red shrink-0" />
          <p className="text-sm text-neon-red">
            {(askMutation.error as { message?: string })?.message || 'Failed to get response'}
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-bg-card border border-border-default rounded-2xl overflow-hidden">
          {/* Question */}
          <div className="px-6 py-4 border-b border-border-default bg-bg-secondary/50">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-neon-cyan/10 mt-0.5">
                <MessageSquare size={14} className="text-neon-cyan" />
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
            <pre className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
              {result.answer}
            </pre>
          </div>

          {/* Actions */}
          <div className="px-6 py-3 border-t border-border-default flex items-center justify-between">
            <div className="flex items-center gap-2">
              {result.status === 'success' && (
                <span className="flex items-center gap-1 text-xs text-neon-lime">
                  <CheckCircle2 size={14} /> {t('ask.success', 'Success')}
                </span>
              )}
            </div>
            {isPro ? (
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saved || saveMutation.isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  saved
                    ? 'bg-neon-lime/10 text-neon-lime'
                    : 'bg-bg-secondary text-text-muted hover:text-text-primary hover:bg-bg-card'
                )}
              >
                <Bookmark size={14} />
                {saved ? t('ask.saved', 'Saved') : t('common.save', 'Save')}
              </button>
            ) : (
              <span className="text-[10px] text-text-muted bg-bg-secondary px-2 py-1 rounded-md uppercase">
                Pro
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
