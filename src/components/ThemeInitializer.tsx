'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export function ThemeInitializer() {
  const { mode, colorTheme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    const applyDark = (isDark: boolean) => {
      root.classList.toggle('dark', isDark);
      root.style.colorScheme = isDark ? 'dark' : 'light';
    };

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }

    applyDark(mode === 'dark');
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    if (colorTheme === 'neon') {
      root.removeAttribute('data-color-theme');
    } else {
      root.setAttribute('data-color-theme', colorTheme);
    }
  }, [colorTheme]);

  return null;
}
