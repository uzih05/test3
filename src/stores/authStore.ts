'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { api, ApiError } from '@/lib/api';
import { usePagePreferencesStore } from './pagePreferencesStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setHasOpenaiKey: (value: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post<{ access_token: string; user: User }>(
            '/api/v1/auth/login',
            { email, password }
          );
          set({
            user: res.user,
            token: res.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
          // Fetch full user data (has_openai_key, plan, etc.)
          get().checkAuth();
        } catch (e) {
          const msg = e instanceof ApiError ? e.message : 'Login failed';
          set({ isLoading: false, error: msg });
          throw e;
        }
      },

      signup: async (email, password, displayName) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post<{ access_token: string; user: User }>(
            '/api/v1/auth/signup',
            { email, password, display_name: displayName || undefined }
          );
          set({
            user: res.user,
            token: res.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
          // Fetch full user data (has_openai_key, plan, etc.)
          get().checkAuth();
        } catch (e) {
          const msg = e instanceof ApiError ? e.message : 'Signup failed';
          set({ isLoading: false, error: msg });
          throw e;
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, error: null });
        usePagePreferencesStore.getState().resetAll();
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const user = await api.get<User>('/api/v1/auth/me');
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      setHasOpenaiKey: (value) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, has_openai_key: value } });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'vectorsurfer-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
