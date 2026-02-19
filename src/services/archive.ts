import { api } from '@/lib/api';
import type { ArchivePreview } from '@/types';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://vectorsurfer-api.azurewebsites.net').replace(/\/+$/, '');

export const archiveService = {
  preview: (params?: { function_name?: string; include_golden?: boolean; limit?: number }) =>
    api.get<ArchivePreview>('/api/v1/archive/preview', params),

  exportDownload: async (params?: { function_name?: string; include_golden?: boolean }) => {
    let token: string | null = null;
    try {
      const stored = localStorage.getItem('vectorsurfer-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        token = parsed?.state?.token || null;
      }
    } catch { /* ignore */ }

    const query = new URLSearchParams();
    if (params?.function_name) query.set('function_name', params.function_name);
    if (params?.include_golden) query.set('include_golden', 'true');

    const res = await fetch(`${API_BASE}/api/v1/archive/export?${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'finetune.jsonl';
    a.click();
    URL.revokeObjectURL(url);
  },
};
