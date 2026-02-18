'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePagePreferencesStore } from '@/stores/pagePreferencesStore';
import { useTranslation } from '@/lib/i18n';

const BASE_TITLE = 'Cozymori VectorSurfer';

const ROUTE_NAV_KEY: Record<string, string> = {
  '/': 'overview',
  '/executions': 'executions',
  '/traces': 'traces',
  '/functions': 'functions',
  '/errors': 'errors',
  '/healer': 'healer',
  '/ask': 'ask',
  '/analysis': 'analysis',
  '/cache': 'cache',
  '/golden': 'golden',
  '/github': 'github',
  '/suggest': 'suggest',
  '/saved': 'saved',
  '/projects': 'projects',
  '/settings': 'settings',
};

export function DocumentTitle() {
  const pathname = usePathname();
  const { projectSelected, projectName } = usePagePreferencesStore();
  const { t } = useTranslation();

  useEffect(() => {
    let pageName: string | null = null;

    // Exact match first
    const navKey = ROUTE_NAV_KEY[pathname];
    if (navKey) {
      pageName = t(`nav.${navKey}`);
    } else if (pathname.startsWith('/traces/')) {
      pageName = t('nav.traces');
    } else if (pathname.startsWith('/projects/')) {
      pageName = t('nav.projects');
    } else if (pathname === '/login') {
      pageName = t('auth.login');
    } else if (pathname === '/signup') {
      pageName = t('auth.signup');
    } else if (pathname === '/account') {
      pageName = t('account.title');
    }

    const suffix = projectSelected && projectName ? projectName : BASE_TITLE;

    document.title = pageName ? `${pageName} · ${suffix}` : suffix;
  }, [pathname, projectSelected, projectName, t]);

  return null;
}
