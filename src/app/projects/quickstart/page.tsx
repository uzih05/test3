'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, CheckCircle2, BookOpen, Rocket } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Step =
  | 'q1_used_vectorwave'
  | 'q2_has_weaviate'
  | 'q3_wcs_from_yes'
  | 'intro_vectorwave'
  | 'q3_wcs_from_no'
  | 'end_ready'
  | 'end_wcs'
  | 'end_docker'
  | 'end_wcs_full'
  | 'end_docker_full';

export default function QuickStartPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('q1_used_vectorwave');
  const [history, setHistory] = useState<Step[]>([]);

  const goTo = (next: Step) => {
    setHistory((prev) => [...prev, step]);
    setStep(next);
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      setStep(prev);
    } else {
      router.push('/projects');
    }
  };

  const goToProjects = () => router.push('/projects');

  const isQuestion = step.startsWith('q');
  const isEnd = step.startsWith('end_');

  return (
    <div className="min-h-screen bg-bg-primary p-4 flex flex-col items-center">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-neon-lime/3 rounded-full blur-[150px] pointer-events-none" />

      {/* Back button */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-sm text-text-muted hover:text-neon-lime hover:bg-bg-card transition-colors"
        >
          <ArrowLeft size={16} />
          {history.length > 0 ? t('onboarding.back') : t('common.back')}
        </button>
      </div>

      <div className="w-full max-w-lg relative pt-20 flex-1 flex flex-col items-center justify-center">
        {/* Question steps */}
        {step === 'q1_used_vectorwave' && (
          <QuestionCard
            question={t('onboarding.q1')}
            yesLabel={t('onboarding.yes')}
            noLabel={t('onboarding.no')}
            onYes={() => goTo('q2_has_weaviate')}
            onNo={() => goTo('intro_vectorwave')}
          />
        )}

        {step === 'q2_has_weaviate' && (
          <QuestionCard
            question={t('onboarding.q2')}
            yesLabel={t('onboarding.yes')}
            noLabel={t('onboarding.no')}
            onYes={() => goTo('end_ready')}
            onNo={() => goTo('q3_wcs_from_yes')}
          />
        )}

        {step === 'q3_wcs_from_yes' && (
          <QuestionCard
            question={t('onboarding.q3')}
            yesLabel={t('onboarding.yes')}
            noLabel={t('onboarding.no')}
            onYes={() => goTo('end_wcs')}
            onNo={() => goTo('end_docker')}
          />
        )}

        {step === 'q3_wcs_from_no' && (
          <QuestionCard
            question={t('onboarding.q3')}
            yesLabel={t('onboarding.yes')}
            noLabel={t('onboarding.no')}
            onYes={() => goTo('end_wcs_full')}
            onNo={() => goTo('end_docker_full')}
          />
        )}

        {/* Intro step */}
        {step === 'intro_vectorwave' && (
          <div className="bg-bg-card border border-border-default rounded-[20px] p-8 card-shadow w-full text-center">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-neon-lime-dim flex items-center justify-center">
              <BookOpen size={24} className="text-neon-lime" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-3">{t('onboarding.intro')}</h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              {t('onboarding.introDesc')}
            </p>
            <a
              href="https://cozymori.vercel.app/docs/quickstart"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-neon-cyan hover:underline mb-6"
            >
              {t('onboarding.docsLink')} <ExternalLink size={11} />
            </a>
            <div>
              <button
                onClick={() => goTo('q3_wcs_from_no')}
                className="px-8 py-3 bg-neon-lime text-text-inverse rounded-[14px] font-semibold text-sm hover:brightness-110 transition-[opacity,filter] neon-glow"
              >
                {t('onboarding.continue')}
              </button>
            </div>
          </div>
        )}

        {/* End A: Ready to connect */}
        {step === 'end_ready' && (
          <EndCard
            icon={<CheckCircle2 size={24} className="text-neon-lime" />}
            title={t('onboarding.endReady')}
            description={t('onboarding.endReadyDesc')}
            ctaLabel={t('onboarding.goToProjects')}
            onCta={goToProjects}
          />
        )}

        {/* End B: WCS guide (VW experienced) */}
        {step === 'end_wcs' && (
          <GuideCard
            title={t('onboarding.wcsTitle')}
            steps={[
              <>
                {t('onboarding.wcsStep1')}{' '}
                <a href="https://console.weaviate.cloud" target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline inline-flex items-center gap-1">
                  {t('onboarding.wcsConsole')} <ExternalLink size={11} />
                </a>
              </>,
              t('onboarding.wcsStep2'),
              t('onboarding.wcsStep3'),
            ]}
            docsUrl="https://weaviate.io/developers/wcs"
            docsLabel={t('onboarding.wcsDocsLink')}
            ctaLabel={t('onboarding.goToProjects')}
            onCta={goToProjects}
          />
        )}

        {/* End C: Docker guide (VW experienced) */}
        {step === 'end_docker' && (
          <GuideCard
            title={t('onboarding.dockerTitle')}
            steps={[
              <CodeBlock key="cmd">{t('onboarding.dockerCmd')}</CodeBlock>,
              t('onboarding.dockerPorts'),
              t('onboarding.dockerStep3'),
            ]}
            docsUrl="https://cozymori.vercel.app/docs/vectorwave-installation"
            docsLabel={t('onboarding.docsLink')}
            ctaLabel={t('onboarding.goToProjects')}
            onCta={goToProjects}
          />
        )}

        {/* End D: WCS + VW install guide */}
        {step === 'end_wcs_full' && (
          <GuideCard
            title={t('onboarding.wcsTitle')}
            steps={[
              <>
                {t('onboarding.wcsStep1')}{' '}
                <a href="https://console.weaviate.cloud" target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline inline-flex items-center gap-1">
                  {t('onboarding.wcsConsole')} <ExternalLink size={11} />
                </a>
              </>,
              t('onboarding.wcsStep2'),
              t('onboarding.wcsStep3'),
            ]}
            docsUrl="https://weaviate.io/developers/wcs"
            docsLabel={t('onboarding.wcsDocsLink')}
            ctaLabel={t('onboarding.goToProjects')}
            onCta={goToProjects}
            install
            t={t}
          />
        )}

        {/* End E: Docker + VW install guide */}
        {step === 'end_docker_full' && (
          <GuideCard
            title={t('onboarding.dockerTitle')}
            steps={[
              <CodeBlock key="cmd">{t('onboarding.dockerCmd')}</CodeBlock>,
              t('onboarding.dockerPorts'),
              t('onboarding.dockerStep3'),
            ]}
            docsUrl="https://cozymori.vercel.app/docs/vectorwave-installation"
            docsLabel={t('onboarding.docsLink')}
            ctaLabel={t('onboarding.goToProjects')}
            onCta={goToProjects}
            install
            t={t}
          />
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-2 mt-8">
          {['q1', 'q2/intro', 'q3', 'end'].map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i <= getProgressIndex(step) ? 'bg-neon-lime' : 'bg-bg-elevated'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function getProgressIndex(step: Step): number {
  if (step === 'q1_used_vectorwave') return 0;
  if (step === 'q2_has_weaviate' || step === 'intro_vectorwave') return 1;
  if (step.startsWith('q3_')) return 2;
  return 3;
}

function QuestionCard({
  question,
  yesLabel,
  noLabel,
  onYes,
  onNo,
}: {
  question: string;
  yesLabel: string;
  noLabel: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="bg-bg-card border border-border-default rounded-[20px] p-8 card-shadow w-full text-center">
      <h2 className="text-xl font-bold text-text-primary mb-8">{question}</h2>
      <div className="flex gap-4">
        <button
          onClick={onYes}
          className="flex-1 py-3.5 bg-neon-lime text-text-inverse rounded-[14px] font-semibold text-sm hover:brightness-110 transition-[opacity,filter] neon-glow"
        >
          {yesLabel}
        </button>
        <button
          onClick={onNo}
          className="flex-1 py-3.5 bg-bg-elevated text-text-secondary rounded-[14px] font-semibold text-sm hover:text-text-primary hover:bg-bg-card-hover transition-colors"
        >
          {noLabel}
        </button>
      </div>
    </div>
  );
}

function EndCard({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="bg-bg-card border border-border-default rounded-[20px] p-8 card-shadow w-full text-center">
      <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-neon-lime-dim flex items-center justify-center">
        {icon}
      </div>
      <h2 className="text-xl font-bold text-text-primary mb-3">{title}</h2>
      <p className="text-sm text-text-secondary mb-8">{description}</p>
      <button
        onClick={onCta}
        className="px-8 py-3 bg-neon-lime text-text-inverse rounded-[14px] font-semibold text-sm hover:brightness-110 transition-[opacity,filter] neon-glow"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

function GuideCard({
  title,
  steps,
  docsUrl,
  docsLabel,
  ctaLabel,
  onCta,
  install,
  t,
}: {
  title: string;
  steps: React.ReactNode[];
  docsUrl: string;
  docsLabel: string;
  ctaLabel: string;
  onCta: () => void;
  install?: boolean;
  t?: (key: string) => string;
}) {
  return (
    <div className="bg-bg-card border border-border-default rounded-[20px] p-8 card-shadow w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-[12px] bg-neon-lime-dim flex items-center justify-center shrink-0">
          <Rocket size={20} className="text-neon-lime" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      </div>

      <div className="space-y-4 mb-5">
        {steps.map((content, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center shrink-0 text-xs font-bold text-text-secondary">
              {i + 1}
            </span>
            <div className="text-sm text-text-secondary flex-1">{content}</div>
          </div>
        ))}
      </div>

      <a
        href={docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-neon-cyan hover:underline"
      >
        {docsLabel} <ExternalLink size={11} />
      </a>

      {/* VectorWave install section */}
      {install && t && (
        <div className="mt-6 pt-5 border-t border-border-default">
          <h3 className="text-sm font-semibold text-text-primary mb-4">{t('onboarding.installTitle')}</h3>
          <div className="space-y-3">
            <CodeBlock>{t('onboarding.installCmd')}</CodeBlock>
            <CodeBlock>{t('onboarding.installEnv')}</CodeBlock>
            <CodeBlock>{t('onboarding.installInit')}</CodeBlock>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <button
          onClick={onCta}
          className="px-8 py-3 bg-neon-lime text-text-inverse rounded-[14px] font-semibold text-sm hover:brightness-110 transition-[opacity,filter] neon-glow"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <code className="block bg-bg-elevated rounded-[12px] px-4 py-3 text-xs font-mono text-neon-lime whitespace-pre-wrap">
      {children}
    </code>
  );
}
