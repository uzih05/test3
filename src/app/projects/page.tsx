'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Server,
  Cloud,
  CheckCircle2,
  Wifi,
  WifiOff,
  Loader2,
  ArrowRight,
  Rocket,
  X,
  Globe,
  LogOut,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { connectionsService } from '@/services/connections';
import { useAuthStore } from '@/stores/authStore';
import { usePagePreferencesStore } from '@/stores/pagePreferencesStore';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { WeaviateConnection } from '@/types';

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);

  const langLabels: Record<string, string> = { en: 'EN', ko: 'KO', ja: 'JA' };
  const langNames: Record<string, string> = { en: 'English', ko: '한국어', ja: '日本語' };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const [bannerVisible, setBannerVisible] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'self_hosted' | 'wcs_cloud'>('self_hosted');
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('localhost');
  const [formPort, setFormPort] = useState('8080');
  const [formGrpcPort, setFormGrpcPort] = useState('50051');
  const [formApiKey, setFormApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem('quickStartDismissed');
    if (dismissed !== 'true') {
      setBannerVisible(true);
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => connectionsService.list(),
  });

  const connections = data?.items || [];

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof connectionsService.create>[0]) =>
      connectionsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      resetForm();
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => connectionsService.activate(id),
    onSuccess: () => {
      queryClient.removeQueries();
      usePagePreferencesStore.getState().setProjectSelected(true);
      router.push('/');
    },
    onError: (err) => {
      setActivatingId(null);
      setActivateError(err instanceof Error ? err.message : 'Failed to activate project');
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormHost('localhost');
    setFormPort('8080');
    setFormGrpcPort('50051');
    setFormApiKey('');
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await connectionsService.test({
        host: formHost,
        port: parseInt(formPort),
        grpc_port: parseInt(formGrpcPort),
        api_key: formApiKey || undefined,
      });
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formName || 'Default',
      connection_type: formType,
      host: formHost,
      port: parseInt(formPort),
      grpc_port: parseInt(formGrpcPort),
      api_key: formApiKey || undefined,
    });
  };

  const handleSelect = (conn: WeaviateConnection) => {
    setActivateError(null);
    if (conn.is_active) {
      queryClient.removeQueries();
      usePagePreferencesStore.getState().setProjectSelected(true);
      router.push('/');
    } else {
      setActivatingId(conn.id);
      activateMutation.mutate(conn.id);
    }
  };

  const dismissBanner = () => setBannerVisible(false);
  const dismissBannerForever = () => {
    localStorage.setItem('quickStartDismissed', 'true');
    setBannerVisible(false);
  };

  return (
    <div className="min-h-screen bg-bg-primary p-4 flex flex-col items-center">
      {/* Top toolbar — account, language, logout */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-1">
        {/* Account (was Settings) */}
        <Link
          href="/account"
          className="p-2 rounded-[12px] text-text-muted hover:text-neon-lime hover:bg-bg-card transition-colors"
          aria-label={t('account.title')}
        >
          <Settings size={18} />
        </Link>

        {/* Language selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-[12px] text-text-muted hover:text-neon-lime hover:bg-bg-card transition-colors"
            aria-label={t('accessibility.toggleLanguage')}
          >
            <Globe size={16} />
            <span className="text-xs font-medium">{langLabels[language]}</span>
          </button>
          {showLangMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-bg-card border border-border-default rounded-[14px] py-1 min-w-[100px] z-50 card-shadow">
                {(['en', 'ko', 'ja'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setLanguage(lang); setShowLangMenu(false); }}
                    className={cn(
                      'w-full px-4 py-2 text-sm text-left hover:bg-bg-card-hover transition-colors',
                      language === lang ? 'text-neon-lime' : 'text-text-secondary'
                    )}
                  >
                    {langNames[lang]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-[12px] text-text-muted hover:text-neon-red hover:bg-bg-card transition-colors"
          aria-label={t('auth.logout')}
        >
          <LogOut size={18} />
        </button>
      </div>

      <div className="w-full max-w-3xl relative pt-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-neon-lime mb-4">VectorSurfer</h1>
          <h1 className="text-2xl font-bold text-text-primary">
            {user?.display_name ? `Welcome, ${user.display_name}` : t('projects.title')}
          </h1>
          <p className="text-text-muted text-sm mt-1">{t('projects.subtitle')}</p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-neon-lime" />
          </div>
        )}

        {/* Empty state — prompt to add first connection */}
        {!isLoading && connections.length === 0 && !showForm && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-bg-elevated flex items-center justify-center">
              <Plus size={28} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary mb-6">{t('projects.subtitle')}</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-neon-lime text-text-inverse rounded-[14px] font-semibold text-sm hover:brightness-110 transition-[opacity,filter] neon-glow"
            >
              {t('projects.newConnection')}
            </button>
          </div>
        )}

        {/* Activate error */}
        {activateError && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-[14px] bg-neon-red-dim text-neon-red text-sm">
            <WifiOff size={16} />
            {activateError}
            <button onClick={() => setActivateError(null)} className="ml-auto p-0.5 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Connection cards */}
        {!isLoading && connections.length > 0 && (
          <div className="space-y-3 mb-6">
            {connections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => handleSelect(conn)}
                disabled={activatingId === conn.id && activateMutation.isPending}
                className={cn(
                  'w-full text-left bg-bg-card border rounded-[20px] p-5 transition-[border-color,background-color] duration-200 group',
                  conn.is_active
                    ? 'border-neon-lime/40 neon-glow'
                    : 'border-border-default hover:border-border-hover hover:bg-bg-card-hover'
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={cn(
                    'w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0',
                    conn.is_active ? 'bg-neon-lime-dim' : 'bg-bg-elevated'
                  )}>
                    {conn.connection_type === 'wcs_cloud' ? (
                      <Cloud size={20} className={conn.is_active ? 'text-neon-lime' : 'text-text-muted'} />
                    ) : (
                      <Server size={20} className={conn.is_active ? 'text-neon-lime' : 'text-text-muted'} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-text-primary truncate">{conn.name}</h3>
                      {conn.is_active && (
                        <span className="flex items-center gap-1 text-xs text-neon-lime">
                          <CheckCircle2 size={12} /> {t('projects.active')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {conn.host}:{conn.port} · {conn.connection_type === 'wcs_cloud' ? 'WCS Cloud' : 'Self Hosted'}
                      {conn.has_openai_key && <span className="ml-2 text-neon-cyan">{t('projects.aiReady')}</span>}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ArrowRight
                    size={18}
                    className="text-text-muted group-hover:text-neon-lime transition-colors shrink-0"
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Add connection button (when list exists) */}
        {!isLoading && connections.length > 0 && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-4 border border-dashed border-border-default rounded-[20px] text-sm text-text-muted hover:text-neon-lime hover:border-neon-lime/30 transition-colors"
          >
            <Plus size={18} />
            {t('projects.newConnection')}
          </button>
        )}

        {/* New connection form */}
        {showForm && (
          <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow mt-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-primary">{t('projects.newConnection')}</h3>
              <button onClick={resetForm} className="p-1 text-text-muted hover:text-text-primary" aria-label={t('accessibility.close')}>
                <X size={18} />
              </button>
            </div>

            {/* Type toggle */}
            <div className="flex gap-2 mb-6">
              {(['self_hosted', 'wcs_cloud'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFormType(type)}
                  className={cn(
                    'flex-1 py-2.5 rounded-[12px] text-sm font-medium transition-colors',
                    formType === type
                      ? 'bg-neon-lime text-text-inverse'
                      : 'bg-bg-elevated text-text-muted hover:text-text-primary'
                  )}
                >
                  {type === 'self_hosted' ? t('projects.selfHosted') : t('projects.wcsCloud')}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">{t('projects.formName')}</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My Weaviate"
                  className={cn(
                    'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                    'text-sm text-text-primary placeholder:text-text-muted',
                    'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
                  )}
                />
              </div>

              {/* Host */}
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">{t('projects.formHost')}</label>
                <input
                  type="text"
                  value={formHost}
                  onChange={(e) => setFormHost(e.target.value)}
                  placeholder="localhost"
                  className={cn(
                    'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                    'text-sm text-text-primary placeholder:text-text-muted',
                    'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
                  )}
                />
              </div>

              {/* Ports */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">{t('projects.formHttpPort')}</label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                      'text-sm text-text-primary',
                      'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1.5">{t('projects.formGrpcPort')}</label>
                  <input
                    type="number"
                    value={formGrpcPort}
                    onChange={(e) => setFormGrpcPort(e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                      'text-sm text-text-primary',
                      'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
                    )}
                  />
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">
                  {t('projects.formApiKey')} <span className="text-text-muted">({t('auth.optional')})</span>
                </label>
                <input
                  type="password"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder="weaviate-api-key"
                  className={cn(
                    'w-full px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
                    'text-sm text-text-primary placeholder:text-text-muted',
                    'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
                  )}
                />
              </div>

              {/* Test result */}
              {testResult && (
                <div className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-[12px] text-sm',
                  testResult.success
                    ? 'bg-neon-cyan-dim text-neon-cyan'
                    : 'bg-neon-red-dim text-neon-red'
                )}>
                  {testResult.success ? <Wifi size={16} /> : <WifiOff size={16} />}
                  {testResult.message}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleTest}
                  disabled={testing || !formHost}
                  className={cn(
                    'flex-1 py-2.5 rounded-[12px] text-sm font-medium border transition-colors',
                    'border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover',
                    'disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  {testing ? (
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  ) : (
                    t('projects.testConnection')
                  )}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !formHost}
                  className={cn(
                    'flex-1 py-2.5 rounded-[14px] text-sm font-semibold transition-[opacity,filter]',
                    'bg-neon-lime text-text-inverse hover:brightness-110',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {createMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  ) : (
                    t('common.save')
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Quick Start banner */}
      {bannerVisible && (
        <div
          className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-3rem)] max-w-lg pointer-events-none"
          style={{ animation: 'banner-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        >
          <div
            className="bg-bg-card border-2 rounded-[20px] card-shadow p-5 relative overflow-hidden pointer-events-auto"
            style={{ animation: 'banner-pulse-border 3s ease-in-out infinite, banner-glow 3s ease-in-out infinite', borderColor: 'rgba(0, 255, 204, 0.3)' }}
          >
            {/* Gradient accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #00FFCC, #DFFF00, transparent)' }} />

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[14px] bg-neon-cyan-dim flex items-center justify-center shrink-0">
                <Rocket size={22} className="text-neon-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{t('projects.quickStartBannerTitle')}</p>
                <p className="text-xs text-text-muted mt-0.5">{t('projects.quickStartBannerDesc')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/projects/quickstart"
                  className="px-5 py-2 bg-neon-cyan text-text-inverse rounded-[12px] text-sm font-semibold hover:brightness-110 transition-[opacity,filter] neon-glow-cyan"
                >
                  {t('projects.quickStartBannerAction')}
                </Link>
                <button
                  onClick={dismissBanner}
                  className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-elevated transition-colors"
                  aria-label={t('accessibility.close')}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="mt-2 text-right">
              <button
                onClick={dismissBannerForever}
                className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                {t('projects.quickStartDontShow')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
