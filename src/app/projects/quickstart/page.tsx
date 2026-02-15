'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  BookOpen,
  Rocket,
  Zap,
  Activity,
  TrendingUp,
  Heart,
  Info,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import AnimatedTerminal, {
  SETUP_SEQUENCE_INTRO,
  SETUP_SEQUENCE_WCS,
  SETUP_SEQUENCE_DOCKER,
} from '@/components/quickstart/AnimatedTerminal';

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

  return (
    <div
      className="min-h-screen p-4 flex flex-col items-center relative overflow-hidden"
      style={{ background: 'linear-gradient(170deg, #0a0a0a 0%, #0d1117 40%, #0a1628 70%, #0a0a0a 100%)' }}
    >
      {/* Cyan glow - top center */}
      <div
        className="fixed top-[-100px] left-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'rgba(0, 255, 204, 0.04)',
          filter: 'blur(160px)',
          animation: 'onboarding-float 8s ease-in-out infinite',
        }}
      />
      {/* Lime glow - right side */}
      <div
        className="fixed top-1/3 right-[-100px] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'rgba(223, 255, 0, 0.03)',
          filter: 'blur(120px)',
          animation: 'onboarding-drift 12s ease-in-out infinite',
        }}
      />
      {/* Dot grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />

      {/* Back button */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-sm text-text-muted hover:text-neon-lime hover:bg-white/5 transition-colors"
          aria-label={t('accessibility.goBack')}
        >
          <ArrowLeft size={16} />
          {history.length > 0 ? t('onboarding.back') : t('common.back')}
        </button>
      </div>

      <div className="w-full max-w-2xl relative pt-12 flex flex-col items-center z-10">
        {/* Question steps */}
        {step === 'q1_used_vectorwave' && (
          <div className="mt-8 w-full max-w-lg">
            <QuestionCard
              question={t('onboarding.q1')}
              yesLabel={t('onboarding.yes')}
              noLabel={t('onboarding.no')}
              onYes={() => goTo('q2_has_weaviate')}
              onNo={() => goTo('intro_vectorwave')}
            />
          </div>
        )}

        {step === 'q2_has_weaviate' && (
          <div className="mt-8 w-full max-w-lg">
            <QuestionCard
              question={t('onboarding.q2')}
              yesLabel={t('onboarding.yes')}
              noLabel={t('onboarding.no')}
              onYes={() => goTo('end_ready')}
              onNo={() => goTo('q3_wcs_from_yes')}
            />
          </div>
        )}

        {step === 'q3_wcs_from_yes' && (
          <div className="mt-8 w-full max-w-lg">
            <QuestionCard
              question={t('onboarding.q3')}
              yesLabel={t('onboarding.yes')}
              noLabel={t('onboarding.no')}
              onYes={() => goTo('end_wcs')}
              onNo={() => goTo('end_docker')}
            />
          </div>
        )}

        {step === 'q3_wcs_from_no' && (
          <div className="mt-8 w-full max-w-lg">
            <QuestionCard
              question={t('onboarding.q3')}
              yesLabel={t('onboarding.yes')}
              noLabel={t('onboarding.no')}
              onYes={() => goTo('end_wcs_full')}
              onNo={() => goTo('end_docker_full')}
            />
          </div>
        )}

        {/* Intro step */}
        {step === 'intro_vectorwave' && (
          <div className="w-full max-w-lg">
            <div className="bg-bg-card border border-border-default rounded-[20px] p-8 card-shadow text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-neon-cyan-dim flex items-center justify-center">
                <BookOpen size={24} className="text-neon-cyan" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-3">{t('onboarding.intro')}</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-5">
                {t('onboarding.introDesc')}
              </p>

              {/* Feature highlight chips */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  { icon: <Zap size={14} />, label: t('onboarding.featureCaching') },
                  { icon: <Activity size={14} />, label: t('onboarding.featureTracing') },
                  { icon: <TrendingUp size={14} />, label: t('onboarding.featureDrift') },
                  { icon: <Heart size={14} />, label: t('onboarding.featureHealing') },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-bg-elevated">
                    <span className="text-neon-cyan">{f.icon}</span>
                    <span className="text-xs text-text-secondary">{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Setup demo */}
              <div className="mb-6 text-left">
                <AnimatedTerminal lines={SETUP_SEQUENCE_INTRO} title="vectorwave-setup" />
              </div>

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
          </div>
        )}

        {/* End A: Ready to connect */}
        {step === 'end_ready' && (
          <div className="w-full max-w-lg">
            <EndCard
              icon={<CheckCircle2 size={24} className="text-neon-lime" />}
              title={t('onboarding.endReady')}
              description={t('onboarding.endReadyDesc')}
              ctaLabel={t('onboarding.goToProjects')}
              onCta={goToProjects}
            />
          </div>
        )}

        {/* End B: WCS guide (VW experienced) */}
        {step === 'end_wcs' && (
          <WcsGuide t={t} onCta={goToProjects} />
        )}

        {/* End C: Docker guide (VW experienced) */}
        {step === 'end_docker' && (
          <DockerGuide t={t} onCta={goToProjects} />
        )}

        {/* End D: WCS + VW install guide */}
        {step === 'end_wcs_full' && (
          <div className="w-full space-y-4">
            <WcsGuide t={t} onCta={goToProjects} hideCta />
            <AnimatedTerminal lines={SETUP_SEQUENCE_WCS} title="wcs-setup" />
            <VectorWaveInstallGuide t={t} envType="wcs" onCta={goToProjects} />
          </div>
        )}

        {/* End E: Docker + VW install guide */}
        {step === 'end_docker_full' && (
          <div className="w-full space-y-4">
            <DockerGuide t={t} onCta={goToProjects} hideCta />
            <AnimatedTerminal lines={SETUP_SEQUENCE_DOCKER} title="docker-setup" />
            <VectorWaveInstallGuide t={t} envType="docker" onCta={goToProjects} />
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-2 mt-8">
          {['q1', 'q2/intro', 'q3', 'end'].map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i <= getProgressIndex(step) ? 'bg-neon-cyan' : 'bg-white/10'
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

/* ── Sub Components ── */

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

function LabeledCodeBlock({ label, children, maxH }: { label?: string; children: React.ReactNode; maxH?: string }) {
  return (
    <div className="rounded-[12px] overflow-hidden border border-border-default">
      {label && (
        <div className="bg-bg-elevated px-4 py-2 text-xs text-text-muted font-mono border-b border-border-default">
          {label}
        </div>
      )}
      <code
        className={cn(
          'block bg-bg-primary px-4 py-3 text-xs font-mono text-neon-lime whitespace-pre-wrap',
          maxH && 'overflow-y-auto'
        )}
        style={maxH ? { maxHeight: maxH } : undefined}
      >
        {children}
      </code>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <code className="block bg-bg-primary border border-border-default rounded-[12px] px-4 py-3 text-xs font-mono text-neon-lime whitespace-pre-wrap">
      {children}
    </code>
  );
}

function EndpointRow({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 bg-bg-elevated rounded-[12px]">
      <span className="text-xs font-semibold text-neon-cyan">{label}</span>
      <code className="text-sm font-mono text-neon-lime">{value}</code>
      <span className="text-xs text-text-muted">{description}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-text-primary mb-3">{children}</h3>;
}

/* ── Guide Sections ── */

function WcsGuide({ t, onCta, hideCta }: { t: (k: string) => string; onCta: () => void; hideCta?: boolean }) {
  return (
    <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-[12px] bg-neon-cyan-dim flex items-center justify-center shrink-0">
          <Rocket size={20} className="text-neon-cyan" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">{t('onboarding.wcsTitle')}</h2>
      </div>

      {/* Section 1: Create cluster */}
      <div className="mb-5">
        <SectionTitle>1. {t('onboarding.wcsStep1')}</SectionTitle>
        <a
          href="https://console.weaviate.cloud"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-neon-cyan hover:underline"
        >
          {t('onboarding.wcsConsole')} <ExternalLink size={12} />
        </a>
      </div>

      {/* Section 2: Endpoints */}
      <div className="mb-5">
        <SectionTitle>2. {t('onboarding.wcsEndpointsTitle')}</SectionTitle>
        <div className="space-y-2">
          <EndpointRow
            label={t('onboarding.wcsRestLabel')}
            value={t('onboarding.wcsRestValue')}
            description={t('onboarding.wcsRestDesc')}
          />
          <EndpointRow
            label={t('onboarding.wcsGrpcLabel')}
            value={t('onboarding.wcsGrpcValue')}
            description={t('onboarding.wcsGrpcDesc')}
          />
          <EndpointRow
            label={t('onboarding.wcsApiKeyLabel')}
            value="••••••••"
            description={t('onboarding.wcsApiKeyDesc')}
          />
        </div>
        <div className="flex items-start gap-2 mt-3 p-3 bg-bg-elevated/50 rounded-[12px]">
          <Info size={14} className="text-neon-cyan shrink-0 mt-0.5" />
          <span className="text-xs text-text-muted">{t('onboarding.wcsWhereToFind')}</span>
        </div>
      </div>

      {/* Section 3: Connect tip */}
      <div className="mb-5">
        <SectionTitle>3. {t('onboarding.wcsStep3')}</SectionTitle>
        <p className="text-xs text-text-muted">{t('onboarding.wcsConnectTip')}</p>
      </div>

      {/* Docs link */}
      <a
        href="https://weaviate.io/developers/wcs"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-neon-cyan hover:underline"
      >
        {t('onboarding.wcsDocsLink')} <ExternalLink size={11} />
      </a>

      {/* CTA */}
      {!hideCta && (
        <div className="mt-6 text-center">
          <button
            onClick={onCta}
            className="px-8 py-3 bg-neon-lime text-text-inverse rounded-[14px] font-semibold text-sm hover:brightness-110 transition-[opacity,filter] neon-glow"
          >
            {t('onboarding.goToProjects')}
          </button>
        </div>
      )}
    </div>
  );
}

function DockerGuide({ t, onCta, hideCta }: { t: (k: string) => string; onCta: () => void; hideCta?: boolean }) {
  return (
    <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-[12px] bg-neon-cyan-dim flex items-center justify-center shrink-0">
          <Rocket size={20} className="text-neon-cyan" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">{t('onboarding.dockerTitle')}</h2>
      </div>

      {/* Section 1: Docker Compose file */}
      <div className="mb-5">
        <SectionTitle>1. Docker Compose</SectionTitle>
        <LabeledCodeBlock label={t('onboarding.dockerComposeLabel')} maxH="200px">
          {t('onboarding.dockerComposeContent')}
        </LabeledCodeBlock>
      </div>

      {/* Section 2: Start container */}
      <div className="mb-5">
        <SectionTitle>2. {t('onboarding.dockerCmd')}</SectionTitle>
        <CodeBlock>{t('onboarding.dockerCmd')}</CodeBlock>
      </div>

      {/* Section 3: Default endpoints */}
      <div className="mb-5">
        <SectionTitle>3. {t('onboarding.dockerPorts')}</SectionTitle>
        <div className="space-y-2">
          <EndpointRow label="REST" value="http://localhost:8080" description="" />
          <EndpointRow label="gRPC" value="localhost:50051" description="" />
        </div>
      </div>

      {/* Section 4: Verify */}
      <div className="mb-5">
        <SectionTitle>4. {t('onboarding.dockerVerifyTitle')}</SectionTitle>
        <CodeBlock>{t('onboarding.dockerVerifyCmd')}</CodeBlock>
        <p className="text-xs text-text-muted mt-2">{t('onboarding.dockerVerifyDesc')}</p>
      </div>

      {/* Docs link */}
      <a
        href="https://cozymori.vercel.app/docs/vectorwave-installation"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-neon-cyan hover:underline"
      >
        {t('onboarding.docsLink')} <ExternalLink size={11} />
      </a>

      {/* CTA */}
      {!hideCta && (
        <div className="mt-6 text-center">
          <button
            onClick={onCta}
            className="px-8 py-3 bg-neon-lime text-text-inverse rounded-[14px] font-semibold text-sm hover:brightness-110 transition-[opacity,filter] neon-glow"
          >
            {t('onboarding.goToProjects')}
          </button>
        </div>
      )}
    </div>
  );
}

function VectorWaveInstallGuide({
  t,
  envType,
  onCta,
}: {
  t: (k: string) => string;
  envType: 'wcs' | 'docker';
  onCta: () => void;
}) {
  const envContent = envType === 'wcs' ? t('onboarding.installEnvWcs') : t('onboarding.installEnvDocker');

  return (
    <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-[12px] bg-neon-lime-dim flex items-center justify-center shrink-0">
          <Zap size={20} className="text-neon-lime" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">{t('onboarding.installTitle')}</h2>
      </div>

      {/* What is VectorWave */}
      <p className="text-sm text-text-secondary mb-5">{t('onboarding.installWhatIs')}</p>

      {/* Install SDK */}
      <div className="mb-5">
        <SectionTitle>1. {t('onboarding.installCmd')}</SectionTitle>
        <CodeBlock>{t('onboarding.installCmd')}</CodeBlock>
        <p className="text-xs text-text-muted mt-2">{t('onboarding.installPipDesc')}</p>
      </div>

      {/* Configure env */}
      <div className="mb-5">
        <SectionTitle>2. {t('onboarding.installEnvTitle')}</SectionTitle>
        <LabeledCodeBlock label={t('onboarding.installEnvLabel')}>
          {envContent}
        </LabeledCodeBlock>
      </div>

      {/* Initialize DB */}
      <div className="mb-5">
        <SectionTitle>3. {t('onboarding.installTitle')}</SectionTitle>
        <CodeBlock>{t('onboarding.installInit')}</CodeBlock>
        <p className="text-xs text-text-muted mt-2">{t('onboarding.installInitDesc')}</p>
      </div>

      {/* Quick test */}
      <div className="mb-5">
        <SectionTitle>4. {t('onboarding.installTestTitle')}</SectionTitle>
        <LabeledCodeBlock label={t('onboarding.installTestLabel')}>
          {t('onboarding.installTestCode')}
        </LabeledCodeBlock>
        <p className="text-xs text-text-muted mt-2">{t('onboarding.installTestDesc')}</p>
      </div>

      {/* Docs link */}
      <a
        href="https://cozymori.vercel.app/docs/vectorwave-installation"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-neon-cyan hover:underline"
      >
        {t('onboarding.docsLink')} <ExternalLink size={11} />
      </a>

      {/* CTA */}
      <div className="mt-6 text-center">
        <button
          onClick={onCta}
          className="px-8 py-3 bg-neon-lime text-text-inverse rounded-[14px] font-semibold text-sm hover:brightness-110 transition-[opacity,filter] neon-glow"
        >
          {t('onboarding.goToProjects')}
        </button>
      </div>
    </div>
  );
}
