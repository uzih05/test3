'use client';

import { useState } from 'react';
import { Menu, Search, Sun, Moon, Monitor, Globe } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CommandPalette } from '@/components/CommandPalette';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { mode, setMode } = useThemeStore();
  const { t, language, setLanguage } = useTranslation();
  const [showPalette, setShowPalette] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const themeIcons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };
  const ThemeIcon = themeIcons[mode];

  const nextTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['dark', 'light', 'system'];
    const idx = order.indexOf(mode);
    setMode(order[(idx + 1) % order.length]);
  };

  const langLabels: Record<string, string> = { en: 'EN', ko: 'KO', ja: 'JA' };

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-border-default',
          'h-[56px] lg:h-[80px] flex items-center px-4 lg:px-6 gap-4'
        )}
      >
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-text-muted hover:text-text-primary"
          aria-label={t('accessibility.toggleMenu')}
        >
          <Menu size={22} />
        </button>

        {/* Search bar */}
        <button
          onClick={() => setShowPalette(true)}
          className={cn(
            'flex-1 max-w-md mx-auto flex items-center gap-3 px-4 py-2.5',
            'bg-bg-input border border-border-default rounded-[14px]',
            'text-text-muted hover:border-border-hover transition-colors cursor-pointer'
          )}
        >
          <Search size={16} />
          <span className="text-sm">Search...</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] text-text-muted bg-bg-card rounded-md border border-border-default">
            Ctrl+K
          </kbd>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={nextTheme}
            className="p-2 text-text-muted hover:text-accent-primary transition-colors rounded-[12px] hover:bg-bg-card"
            aria-label={t('accessibility.toggleTheme')}
          >
            <ThemeIcon size={18} />
          </button>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="p-2 text-text-muted hover:text-accent-primary transition-colors rounded-[12px] hover:bg-bg-card flex items-center gap-1"
              aria-label={t('accessibility.toggleLanguage')}
            >
              <Globe size={18} />
              <span className="text-xs font-medium hidden sm:inline">{langLabels[language]}</span>
            </button>
            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-bg-card border border-border-default rounded-[14px] py-1 min-w-[100px] z-50 card-shadow">
                  {(['en', 'ko', 'ja'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setLanguage(lang);
                        setShowLangMenu(false);
                      }}
                      className={cn(
                        'w-full px-4 py-2 text-sm text-left hover:bg-bg-card-hover transition-colors',
                        language === lang ? 'text-accent-primary' : 'text-text-secondary'
                      )}
                    >
                      {lang === 'en' ? 'English' : lang === 'ko' ? '한국어' : '日本語'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
    </>
  );
}
