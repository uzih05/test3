'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Mode = 'light' | 'dark' | 'system';
export type ColorTheme = 'neon' | 'signature' | 'grayscale';

interface ThemeState {
  mode: Mode;
  colorTheme: ColorTheme;
  setMode: (mode: Mode) => void;
  setColorTheme: (theme: ColorTheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      colorTheme: 'neon',
      setMode: (mode) => set({ mode }),
      setColorTheme: (colorTheme) => set({ colorTheme }),
    }),
    {
      name: 'vectorsurfer-theme',
      version: 1,
      migrate: (persisted: unknown) => {
        const old = persisted as Record<string, unknown>;
        // v0 had { theme: 'light' | 'dark' | 'system' }
        if (old && 'theme' in old && !('mode' in old)) {
          return {
            mode: old.theme as Mode,
            colorTheme: 'neon' as ColorTheme,
          };
        }
        return old as unknown as ThemeState;
      },
    }
  )
);
