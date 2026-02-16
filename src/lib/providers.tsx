'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n';
import { AuthGuard } from '@/components/AuthGuard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ThemeInitializer } from '@/components/ThemeInitializer';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: Infinity,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeInitializer />
        <AuthGuard>
          <DashboardLayout>{children}</DashboardLayout>
        </AuthGuard>
      </I18nProvider>
    </QueryClientProvider>
  );
}
