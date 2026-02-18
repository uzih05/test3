'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PagePreferencesState {
  projectSelected: boolean;
  githubSelectedRepo: { owner: string; repo: string } | null;
  analysisActiveTab: string;
  goldenActiveTab: string;
  settingsActiveTab: string;
  healerMode: 'single' | 'batch';
  healerTimeRangeFilter: number;
  suggestPriorityFilter: string;
  functionsViewMode: 'grid' | 'tree';
  functionsSortBy: string;
  errorsSearchMode: 'filter' | 'semantic';

  setProjectSelected: (v: boolean) => void;
  setGithubSelectedRepo: (v: { owner: string; repo: string } | null) => void;
  setAnalysisActiveTab: (v: string) => void;
  setGoldenActiveTab: (v: string) => void;
  setSettingsActiveTab: (v: string) => void;
  setHealerMode: (v: 'single' | 'batch') => void;
  setHealerTimeRangeFilter: (v: number) => void;
  setSuggestPriorityFilter: (v: string) => void;
  setFunctionsViewMode: (v: 'grid' | 'tree') => void;
  setFunctionsSortBy: (v: string) => void;
  setErrorsSearchMode: (v: 'filter' | 'semantic') => void;
  resetAll: () => void;
}

const DEFAULTS = {
  projectSelected: false,
  githubSelectedRepo: null,
  analysisActiveTab: 'overview',
  goldenActiveTab: 'records',
  settingsActiveTab: 'appearance',
  healerMode: 'single' as const,
  healerTimeRangeFilter: 1440,
  suggestPriorityFilter: 'all',
  functionsViewMode: 'grid' as const,
  functionsSortBy: 'execution_count',
  errorsSearchMode: 'filter' as const,
};

export const usePagePreferencesStore = create<PagePreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setProjectSelected: (v) => set({ projectSelected: v }),
      setGithubSelectedRepo: (v) => set({ githubSelectedRepo: v }),
      setAnalysisActiveTab: (v) => set({ analysisActiveTab: v }),
      setGoldenActiveTab: (v) => set({ goldenActiveTab: v }),
      setSettingsActiveTab: (v) => set({ settingsActiveTab: v }),
      setHealerMode: (v) => set({ healerMode: v }),
      setHealerTimeRangeFilter: (v) => set({ healerTimeRangeFilter: v }),
      setSuggestPriorityFilter: (v) => set({ suggestPriorityFilter: v }),
      setFunctionsViewMode: (v) => set({ functionsViewMode: v }),
      setFunctionsSortBy: (v) => set({ functionsSortBy: v }),
      setErrorsSearchMode: (v) => set({ errorsSearchMode: v }),
      resetAll: () => set(DEFAULTS),
    }),
    { name: 'vectorsurfer-page-prefs' }
  )
);
