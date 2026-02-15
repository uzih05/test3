'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Globe, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function AccountPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();
  const [showQuickStart, setShowQuickStart] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem('quickStartDismissed');
    setShowQuickStart(dismissed !== 'true');
  }, []);

  const handleToggleQuickStart = () => {
    const next = !showQuickStart;
    setShowQuickStart(next);
    if (next) {
      localStorage.removeItem('quickStartDismissed');
    } else {
      localStorage.setItem('quickStartDismissed', 'true');
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const initials = user?.display_name
    ? user.display_name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="min-h-screen bg-bg-primary p-4 flex flex-col items-center">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-neon-lime/3 rounded-full blur-[150px] pointer-events-none" />

      {/* Back button */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => router.push('/projects')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-sm text-text-muted hover:text-neon-lime hover:bg-bg-card transition-colors"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>
      </div>

      <div className="w-full max-w-lg relative pt-16">
        {/* Header */}
        <h1 className="text-2xl font-bold text-text-primary mb-8">{t('account.title')}</h1>

        {/* Profile section */}
        <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow mb-4">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">{t('account.profile')}</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-neon-lime-dim flex items-center justify-center">
              <span className="text-sm font-bold text-neon-lime">{initials}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{user?.display_name || '—'}</p>
              <p className="text-xs text-text-muted">{user?.email || '—'}</p>
            </div>
          </div>
        </div>

        {/* Language section */}
        <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow mb-4">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">{t('account.language')}</h2>
          <div className="flex gap-2">
            {(['en', 'ko', 'ja'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={cn(
                  'flex-1 py-2.5 rounded-[12px] text-sm font-medium transition-colors',
                  language === lang
                    ? 'bg-neon-lime text-text-inverse'
                    : 'bg-bg-elevated text-text-muted hover:text-text-primary'
                )}
              >
                {lang === 'en' ? 'English' : lang === 'ko' ? '한국어' : '日本語'}
              </button>
            ))}
          </div>
        </div>

        {/* Preferences section */}
        <div className="bg-bg-card border border-border-default rounded-[20px] p-6 card-shadow mb-4">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">{t('account.preferences')}</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('account.showQuickStart')}</p>
              <p className="text-xs text-text-muted mt-0.5">{t('account.showQuickStartDesc')}</p>
            </div>
            <button
              onClick={handleToggleQuickStart}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors shrink-0',
                showQuickStart ? 'bg-neon-lime' : 'bg-bg-elevated'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-[left]',
                  showQuickStart ? 'left-[22px]' : 'left-0.5'
                )}
              />
            </button>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-bg-card border border-border-default rounded-[20px] text-sm text-neon-red hover:bg-bg-card-hover transition-colors card-shadow"
        >
          <LogOut size={16} />
          {t('account.logout')}
        </button>
      </div>
    </div>
  );
}
