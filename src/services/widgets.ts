import { api } from '@/lib/api';
import type { Widget, WidgetCatalogItem } from '@/types';

export const widgetsService = {
  catalog: () =>
    api.get<{ items: WidgetCatalogItem[] }>('/api/v1/widgets/catalog'),

  list: () =>
    api.get<{ items: Widget[] }>('/api/v1/widgets'),

  add: (widget_type: string, size?: string) =>
    api.post<Widget>('/api/v1/widgets', { widget_type, size }),

  update: (id: string, size: string) =>
    api.put<Widget>(`/api/v1/widgets/${id}`, { size }),

  remove: (id: string) =>
    api.delete(`/api/v1/widgets/${id}`),

  reorder: (widget_ids: string[]) =>
    api.put('/api/v1/widgets/reorder', { widget_ids }),
};
