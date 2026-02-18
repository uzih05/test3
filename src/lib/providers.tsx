'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n';
import { AuthGuard } from '@/components/AuthGuard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ThemeInitializer } from '@/components/ThemeInitializer';
import { DocumentTitle } from '@/components/DocumentTitle';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,     // 5 min — cached data is "fresh" for 5 min (prevents refetch on mount/navigation)
            gcTime: 10 * 60_000,        // 10 min — garbage collect unused cache after 10 min
            retry: 1,
            refetchOnWindowFocus: false, // polling (refetchInterval) handles updates
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeInitializer />
        <DocumentTitle />
        <AuthGuard>
          <DashboardLayout>{children}</DashboardLayout>
        </AuthGuard>
      </I18nProvider>
    </QueryClientProvider>
  );
}
