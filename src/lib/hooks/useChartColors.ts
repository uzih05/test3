'use client';

import { useState, useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

interface ChartColors {
  accentPrimary: string;
  accentSecondary: string;
  statusError: string;
  statusWarning: string;
  statusInfo: string;
  bgCard: string;
  bgElevated: string;
  borderDefault: string;
  textPrimary: string;
  textMuted: string;
}

const FALLBACK: ChartColors = {
  accentPrimary: '#DFFF00',
  accentSecondary: '#00FFCC',
  statusError: '#FF4D6A',
  statusWarning: '#FF9F43',
  statusInfo: '#3B82F6',
  bgCard: '#1a1a1a',
  bgElevated: '#252525',
  borderDefault: '#2a2a2a',
  textPrimary: '#FFFFFF',
  textMuted: '#666666',
};

function readColors(): ChartColors {
  if (typeof window === 'undefined') return FALLBACK;
  const s = getComputedStyle(document.documentElement);
  const get = (v: string) => s.getPropertyValue(v).trim();
  return {
    accentPrimary: get('--theme-accent-primary') || FALLBACK.accentPrimary,
    accentSecondary: get('--theme-accent-secondary') || FALLBACK.accentSecondary,
    statusError: get('--theme-status-error') || FALLBACK.statusError,
    statusWarning: get('--theme-status-warning') || FALLBACK.statusWarning,
    statusInfo: get('--theme-status-info') || FALLBACK.statusInfo,
    bgCard: get('--theme-bg-card') || FALLBACK.bgCard,
    bgElevated: get('--theme-bg-elevated') || FALLBACK.bgElevated,
    borderDefault: get('--theme-border-default') || FALLBACK.borderDefault,
    textPrimary: get('--theme-text-primary') || FALLBACK.textPrimary,
    textMuted: get('--theme-text-muted') || FALLBACK.textMuted,
  };
}

export function useChartColors(): ChartColors {
  const { mode, colorTheme } = useThemeStore();
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    // Wait one frame for CSS variables to update after theme change
    const id = requestAnimationFrame(() => setColors(readColors()));
    return () => cancelAnimationFrame(id);
  }, [mode, colorTheme]);

  return colors;
}
