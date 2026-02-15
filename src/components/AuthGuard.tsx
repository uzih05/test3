'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

const PUBLIC_PATHS = ['/login', '/signup'];
const FULLSCREEN_PATHS = ['/login', '/signup', '/projects', '/projects/quickstart', '/account'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);

  // Dev mode: skip auth guard
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (isDev) {
      setChecked(true);
      return;
    }
    checkAuth().finally(() => setChecked(true));
  }, [checkAuth, isDev]);

  useEffect(() => {
    if (!checked || isDev) return;

    const isPublic = PUBLIC_PATHS.includes(pathname);

    if (!isAuthenticated && !isPublic) {
      router.replace('/login');
      return;
    }

    if (isAuthenticated && isPublic) {
      router.replace('/projects');
      return;
    }

    if (isAuthenticated && !FULLSCREEN_PATHS.includes(pathname)) {
      const projectSelected = sessionStorage.getItem('project_selected');
      if (!projectSelected) {
        router.replace('/projects');
      }
    }
  }, [checked, isAuthenticated, pathname, router, isDev]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="w-8 h-8 border-2 border-neon-lime border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

export function isFullscreenPath(pathname: string): boolean {
  return FULLSCREEN_PATHS.includes(pathname);
}
