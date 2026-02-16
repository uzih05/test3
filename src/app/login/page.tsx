'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Globe } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const langLabels: Record<string, string> = { en: 'EN', ko: 'KO', ja: 'JA' };
  const langNames: Record<string, string> = { en: 'English', ko: '한국어', ja: '日本語' };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      router.push('/projects');
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      {/* Language toggle — top right */}
      <div className="fixed top-4 right-4 z-50 relative">
        <button
          onClick={() => setShowLangMenu(!showLangMenu)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-text-muted hover:text-neon-lime hover:bg-bg-card transition-colors"
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

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-neon-lime mb-1">VectorSurfer</h1>
          <p className="text-text-muted text-sm mt-1">{t('auth.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-bg-card border border-border-default rounded-[20px] p-8 card-shadow">
          <h2 className="text-xl font-semibold text-text-primary mb-6">{t('auth.login')}</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-neon-red-dim border border-neon-red/30 rounded-[12px] text-sm text-neon-red">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                placeholder={t('auth.emailPlaceholder')}
                required
                className={cn(
                  'w-full px-4 py-3 bg-bg-input border border-border-default rounded-[12px]',
                  'text-sm text-text-primary placeholder:text-text-muted',
                  'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
                )}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  placeholder={t('auth.passwordPlaceholder')}
                  required
                  className={cn(
                    'w-full px-4 py-3 pr-11 bg-bg-input border border-border-default rounded-[12px]',
                    'text-sm text-text-primary placeholder:text-text-muted',
                    'focus:border-neon-lime focus:ring-1 focus:ring-neon-lime/30 outline-none transition-colors'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  aria-label={t('auth.togglePassword')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-3 rounded-[14px] text-sm font-semibold transition-[opacity,filter,transform] duration-200',
                'bg-neon-lime text-text-inverse hover:brightness-110 active:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'neon-glow'
              )}
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin mx-auto" />
              ) : (
                t('auth.login')
              )}
            </button>
          </form>

          {/* Signup link */}
          <p className="mt-6 text-center text-sm text-text-muted">
            {t('auth.noAccount')}{' '}
            <Link href="/signup" className="text-neon-lime hover:underline font-medium">
              {t('auth.signup')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
