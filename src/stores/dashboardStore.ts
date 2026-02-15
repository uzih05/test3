'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimeRange {
  preset: number | null;
  customStart: string | null;
  customEnd: string | null;
  mode: 'preset' | 'custom';
}

const PRESET_LABELS: Record<number, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  180: '3h',
  360: '6h',
  720: '12h',
  1440: '24h',
  4320: '3d',
  10080: '7d',
};

interface DashboardState {
  timeRange: TimeRange;
  fillMode: 'stroke-only' | 'gradient' | 'solid';
  timeRangeMinutes: number;
  timeRangeLabel: string;
  setPreset: (minutes: number) => void;
  setCustomRange: (start: string, end: string) => void;
  setFillMode: (mode: 'stroke-only' | 'gradient' | 'solid') => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      timeRange: { preset: 60, customStart: null, customEnd: null, mode: 'preset' },
      fillMode: 'gradient',
      timeRangeMinutes: 60,
      timeRangeLabel: '1h',

      setPreset: (minutes) =>
        set({
          timeRange: { preset: minutes, customStart: null, customEnd: null, mode: 'preset' },
          timeRangeMinutes: minutes,
          timeRangeLabel: PRESET_LABELS[minutes] || `${minutes}m`,
        }),

      setCustomRange: (start, end) => {
        const diff = Math.round(
          (new Date(end).getTime() - new Date(start).getTime()) / 60_000
        );
        set({
          timeRange: { preset: null, customStart: start, customEnd: end, mode: 'custom' },
          timeRangeMinutes: diff,
          timeRangeLabel: 'Custom',
        });
      },

      setFillMode: (mode) => set({ fillMode: mode }),
    }),
    { name: 'vectorsurfer-dashboard' }
  )
);
