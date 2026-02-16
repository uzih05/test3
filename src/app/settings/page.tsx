'use client';

import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Key,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Database,
  Trash2,
  Shield,
  Palette,
  User,
  LogOut,
} from 'lucide-react';
import { authService } from '@/services/auth';
import { connectionsService } from '@/services/connections';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type SettingsTab = 'appearance' | 'ai' | 'connections' | 'account';

/* === Appearance === */
const AppearanceSection = memo(function AppearanceSection() {
  const { t } = useTranslation();
  const { theme, setTheme } = useThemeStore();

  const themes = [
    { key: 'dark' as const, label: t('settings.theme.dark'), icon: Moon, desc: t('settings.neonDarkDesc') },
    { key: 'light' as const, label: t('settings.theme.light'), icon: Sun, desc: t('settings.cleanLightDesc') },
    { key: 'system' as const, label: t('settings.theme.system'), icon: Monitor, desc: t('settings.followOsDesc') },
  ];

  return (
    <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
      <h2 className="text-sm font-medium text-text-secondary mb-4">{t('settings.appearance')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {themes.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            onClick={() => setTheme(key)}
            className={cn(
              'p-4 rounded-[14px] border-2 text-left transition-[border-color,background-color]',
              theme === key
                ? 'border-neon-lime bg-neon-lime-dim'
                : 'border-border-default hover:border-border-hover bg-bg-elevated'
            )}
          >
            <Icon size={20} className={theme === key ? 'text-neon-lime mb-2' : 'text-text-muted mb-2'} />
            <p className={cn('text-sm font-medium', theme === key ? 'text-neon-lime' : 'text-text-primary')}>
              {label}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
});

/* === AI Settings === */
const AISection = memo(function AISection() {
  const { t } = useTranslation();
  const { user, setHasOpenaiKey } = useAuthStore();

  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => authService.updateApiKey(apiKey),
    onSuccess: () => {
      setHasOpenaiKey(true);
      setApiKey('');
      setMessage({ type: 'success', text: t('settings.apiKeySaved') });
    },
    onError: (err) => {
      setMessage({ type: 'error', text: (err as Error).message || t('settings.apiKeyFailed') });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => authService.updateApiKey(null),
    onSuccess: () => {
      setHasOpenaiKey(false);
      setMessage({ type: 'success', text: t('settings.apiKeyRemoved') });
    },
    onError: (err) => {
      setMessage({ type: 'error', text: (err as Error).message || t('settings.apiKeyRemoveFailed') });
    },
  });

  return (
    <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
      <h2 className="text-sm font-medium text-text-secondary mb-4">{t('settings.aiSettings')}</h2>

      {/* Status */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 rounded-[12px] mb-4',
        user?.has_openai_key ? 'bg-neon-cyan-dim' : 'bg-[rgba(255,159,67,0.15)]'
      )}>
        {user?.has_openai_key ? (
          <>
            <CheckCircle2 size={16} className="text-neon-cyan" />
            <span className="text-sm text-neon-cyan font-medium">{t('settings.apiKeyConfigured')}</span>
          </>
        ) : (
          <>
            <AlertTriangle size={16} className="text-neon-orange" />
            <span className="text-sm text-neon-orange font-medium">{t('settings.apiKeyNotSet')}</span>
          </>
        )}
      </div>

      <p className="text-xs text-text-muted mb-4">
        {t('settings.apiKeyDescription')}
      </p>

      <div className="flex gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setMessage(null); }}
          placeholder={t('settings.apiKeyPlaceholder')}
          className={cn(
            'flex-1 px-4 py-2.5 bg-bg-input border border-border-default rounded-[12px]',
            'text-sm text-text-primary placeholder:text-text-muted font-mono',
            'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
          )}
        />
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!apiKey || saveMutation.isPending}
          className="px-4 py-2.5 bg-neon-lime text-text-inverse rounded-[12px] text-sm font-medium hover:brightness-110 disabled:opacity-40 transition-[opacity,filter]"
        >
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : t('common.save')}
        </button>
      </div>

      {user?.has_openai_key && (
        <button
          onClick={() => removeMutation.mutate()}
          disabled={removeMutation.isPending}
          className="mt-3 flex items-center gap-1.5 text-xs text-neon-red hover:bg-neon-red-dim px-3 py-1.5 rounded-[8px] transition-colors"
        >
          <Trash2 size={12} />
          {t('settings.removeApiKey')}
        </button>
      )}

      {message && (
        <div className={cn(
          'mt-3 flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs',
          message.type === 'success' ? 'bg-neon-cyan-dim text-neon-cyan' : 'bg-neon-red-dim text-neon-red'
        )}>
          {message.type === 'success' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {message.text}
        </div>
      )}
    </div>
  );
});

/* === Connections === */
const ConnectionsSection = memo(function ConnectionsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [keyEditId, setKeyEditId] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyMessage, setKeyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => connectionsService.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => connectionsService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  });

  const saveKeyMutation = useMutation({
    mutationFn: ({ id, key }: { id: string; key: string }) => connectionsService.updateApiKey(id, key),
    onSuccess: () => {
      setKeyMessage({ type: 'success', text: t('settings.apiKeySaved') });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      setTimeout(() => { setKeyEditId(null); setKeyMessage(null); }, 2000);
    },
    onError: (err) => {
      setKeyMessage({ type: 'error', text: (err as Error).message || t('settings.apiKeyFailed') });
    },
  });

  const connections = data?.items || [];

  return (
    <div className="bg-bg-card border border-border-default rounded-[20px] overflow-hidden card-shadow">
      <div className="px-6 py-4 border-b border-border-default">
        <h2 className="text-sm font-medium text-text-secondary">{t('settings.connections')}</h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-neon-lime" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12 text-sm text-text-muted">{t('settings.noConnections')}</div>
      ) : (
        <div className="divide-y divide-border-default">
          {connections.map((conn) => (
            <div key={conn.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    conn.is_active ? 'bg-neon-lime' : 'bg-text-muted'
                  )} />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{conn.name}</p>
                    <p className="text-[11px] text-text-muted font-mono">{conn.host}:{conn.port}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 bg-bg-elevated rounded-md text-text-muted">
                    {conn.connection_type}
                  </span>
                  {conn.is_active && (
                    <span className="text-[10px] px-2 py-0.5 bg-neon-lime-dim text-neon-lime rounded-md font-medium">
                      {t('settings.connectionActive')}
                    </span>
                  )}
                  <button
                    onClick={() => { setKeyEditId(keyEditId === conn.id ? null : conn.id); setKeyInput(''); setKeyMessage(null); }}
                    className="p-1.5 text-text-muted hover:text-neon-lime transition-colors"
                    title={t('settings.connectionApiKey')}
                  >
                    <Key size={14} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(conn.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-text-muted hover:text-neon-red transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* API Key edit panel */}
              {keyEditId === conn.id && (
                <div className="mt-3 ml-5.5 pl-3 border-l-2 border-border-default">
                  <p className="text-xs text-text-muted mb-2">
                    {t('settings.connectionApiKeyFor')} <span className="text-text-primary">{conn.name}</span>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={keyInput}
                      onChange={(e) => { setKeyInput(e.target.value); setKeyMessage(null); }}
                      placeholder={t('settings.apiKeyPlaceholder')}
                      className={cn(
                        'flex-1 px-3 py-2 bg-bg-input border border-border-default rounded-[10px]',
                        'text-xs text-text-primary placeholder:text-text-muted font-mono',
                        'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
                      )}
                    />
                    <button
                      onClick={() => saveKeyMutation.mutate({ id: conn.id, key: keyInput })}
                      disabled={!keyInput || saveKeyMutation.isPending}
                      className="px-3 py-2 bg-neon-lime text-text-inverse rounded-[10px] text-xs font-medium hover:brightness-110 disabled:opacity-40 transition-[opacity,filter]"
                    >
                      {saveKeyMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : t('common.save')}
                    </button>
                  </div>
                  {keyMessage && (
                    <div className={cn(
                      'mt-2 flex items-center gap-1.5 text-[11px]',
                      keyMessage.type === 'success' ? 'text-neon-cyan' : 'text-neon-red'
                    )}>
                      {keyMessage.type === 'success' ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                      {keyMessage.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* === Account === */
const AccountSection = memo(function AccountSection() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
        <h2 className="text-sm font-medium text-text-secondary mb-4">{t('settings.profile')}</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-neon-lime-dim flex items-center justify-center text-neon-lime text-xl font-bold">
            {(user?.display_name || user?.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-text-primary">
              {user?.display_name || user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-text-muted">{user?.email}</p>
            {user?.created_at && (
              <p className="text-[10px] text-text-muted mt-1">
                {t('settings.memberSince')} {new Date(user.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Security info */}
      <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow">
        <h2 className="text-sm font-medium text-text-secondary mb-4">{t('settings.security')}</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-text-muted" />
              <span className="text-sm text-text-primary">{t('settings.connectionApiKey')}</span>
            </div>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-md font-medium',
              user?.has_openai_key ? 'bg-neon-cyan-dim text-neon-cyan' : 'bg-bg-elevated text-text-muted'
            )}>
              {user?.has_openai_key ? t('settings.configured') : t('settings.notSet')}
            </span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 bg-bg-card border border-border-default rounded-[16px] text-sm text-neon-red hover:bg-neon-red-dim transition-colors card-shadow"
      >
        <LogOut size={16} />
        {t('settings.logout')}
      </button>
    </div>
  );
});

export default function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const tabs: { key: SettingsTab; label: string; icon: React.ComponentType<{ size: number; className?: string }> }[] = [
    { key: 'appearance', label: t('settings.appearance'), icon: Palette },
    { key: 'ai', label: t('settings.aiSettings'), icon: Key },
    { key: 'connections', label: t('settings.connections'), icon: Database },
    { key: 'account', label: t('settings.account'), icon: User },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary mb-6">{t('settings.title')}</h1>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar tabs */}
        <div className="lg:w-56 shrink-0">
          <div className="bg-bg-card border border-border-default rounded-[16px] p-2 card-shadow lg:sticky lg:top-24">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm transition-colors text-left',
                  activeTab === key
                    ? 'bg-neon-lime text-text-inverse font-medium'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-card-hover'
                )}
              >
                <Icon size={16} className={activeTab === key ? 'text-text-inverse' : ''} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'appearance' && <AppearanceSection />}
          {activeTab === 'ai' && <AISection />}
          {activeTab === 'connections' && <ConnectionsSection />}
          {activeTab === 'account' && <AccountSection />}
        </div>
      </div>
    </div>
  );
}
