'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Check, RefreshCw } from 'lucide-react';
import { useState, memo } from 'react';
import { widgetsService } from '@/services/widgets';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { WidgetCard } from '@/components/dashboard/WidgetCard';
import { WidgetPicker } from '@/components/dashboard/WidgetPicker';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import { FillModeSelector } from '@/components/dashboard/FillModeSelector';

import { KpiOverview } from '@/components/dashboard/widgets/KpiOverview';
import { TokenUsage } from '@/components/dashboard/widgets/TokenUsage';
import { CacheHitRate } from '@/components/dashboard/widgets/CacheHitRate';
import { ErrorRate } from '@/components/dashboard/widgets/ErrorRate';
import { ExecutionTimeline } from '@/components/dashboard/widgets/ExecutionTimeline';
import { FunctionDistribution } from '@/components/dashboard/widgets/FunctionDistribution';
import { RecentErrors } from '@/components/dashboard/widgets/RecentErrors';
import { SystemStatus } from '@/components/dashboard/widgets/SystemStatus';
import { SuggestOverview } from '@/components/dashboard/widgets/SuggestOverview';

const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  kpi_overview: memo(KpiOverview),
  token_usage: memo(TokenUsage),
  cache_hit: memo(CacheHitRate),
  error_rate: memo(ErrorRate),
  execution_timeline: memo(ExecutionTimeline),
  function_distribution: memo(FunctionDistribution),
  recent_errors: memo(RecentErrors),
  system_status: memo(SystemStatus),
  suggest_overview: memo(SuggestOverview),
};

const WIDGET_TITLE_KEYS: Record<string, string> = {
  kpi_overview: 'dashboard.widgetKpiOverview',
  token_usage: 'dashboard.widgetTokenUsage',
  cache_hit: 'dashboard.widgetCacheHit',
  error_rate: 'dashboard.widgetErrorRate',
  execution_timeline: 'dashboard.widgetExecutionTimeline',
  function_distribution: 'dashboard.widgetFunctionDistribution',
  recent_errors: 'dashboard.widgetRecentErrors',
  system_status: 'dashboard.widgetSystemStatus',
  suggest_overview: 'dashboard.widgetSuggestOverview',
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const { data: widgetData, isLoading } = useQuery({
    queryKey: ['widgets'],
    queryFn: () => widgetsService.list(),
    refetchInterval: 15_000,
  });

  const widgets = widgetData?.items || [];

  type WidgetList = { items: Array<{ id: string; widget_type: string; size: string; position_order: number }> };

  const addWidget = useMutation({
    mutationFn: ({ type, size }: { type: string; size: string }) =>
      widgetsService.add(type, size),
    onMutate: async ({ type, size }: { type: string; size: string }) => {
      await queryClient.cancelQueries({ queryKey: ['widgets'] });
      const prev = queryClient.getQueryData<WidgetList>(['widgets']);
      queryClient.setQueryData<WidgetList>(['widgets'], (old) => ({
        ...old,
        items: [...(old?.items || []), { id: `temp-${Date.now()}`, widget_type: type, size, position_order: (old?.items?.length ?? 0) + 1 }],
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['widgets'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['widgets'] }),
  });

  const removeWidget = useMutation({
    mutationFn: (id: string) => widgetsService.remove(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['widgets'] });
      const prev = queryClient.getQueryData<WidgetList>(['widgets']);
      queryClient.setQueryData<WidgetList>(['widgets'], (old) => ({
        ...old,
        items: (old?.items || []).filter((w) => w.id !== id),
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['widgets'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['widgets'] }),
  });

  const updateWidget = useMutation({
    mutationFn: ({ id, size }: { id: string; size: string }) =>
      widgetsService.update(id, size),
    onMutate: async ({ id, size }: { id: string; size: string }) => {
      await queryClient.cancelQueries({ queryKey: ['widgets'] });
      const prev = queryClient.getQueryData<WidgetList>(['widgets']);
      queryClient.setQueryData<WidgetList>(['widgets'], (old) => ({
        ...old,
        items: (old?.items || []).map((w) =>
          w.id === id ? { ...w, size } : w
        ),
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['widgets'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['widgets'] }),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-bold text-text-primary">{t('dashboard.title')}</h1>

        <div className="flex items-center gap-2 flex-wrap">
          <FillModeSelector />
          <TimeRangeSelector />

          <button
            onClick={handleRefresh}
            className="p-2 text-text-muted hover:text-neon-lime transition-colors rounded-[12px] hover:bg-bg-card"
            title={t('dashboard.refresh')}
          >
            <RefreshCw size={16} />
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-sm font-medium transition-colors',
              isEditing
                ? 'bg-neon-lime text-text-inverse'
                : 'bg-bg-card border border-border-default text-text-secondary hover:text-text-primary'
            )}
          >
            {isEditing ? <Check size={14} /> : <Pencil size={14} />}
            {isEditing ? t('dashboard.done') : t('dashboard.editMode')}
          </button>
        </div>
      </div>

      {/* Widget grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-[20px] h-48 animate-pulse card-shadow col-span-1 sm:col-span-2" />
          ))}
        </div>
      ) : widgets.length === 0 ? (
        /* Empty state */
        <div className="bg-bg-card border border-dashed border-border-default rounded-[20px] p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-neon-lime-dim flex items-center justify-center">
            <Plus size={24} className="text-neon-lime" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">{t('dashboard.noWidgets')}</h3>
          <p className="text-sm text-text-muted mb-4">{t('dashboard.noWidgetsDesc')}</p>
          <button
            onClick={() => setShowPicker(true)}
            className="px-5 py-2.5 bg-neon-lime text-text-inverse rounded-[14px] text-sm font-semibold hover:brightness-110 transition-[opacity,filter] neon-glow"
          >
            {t('dashboard.addWidget')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {widgets
            .sort((a, b) => a.position_order - b.position_order)
            .map((widget) => {
              const Component = WIDGET_COMPONENTS[widget.widget_type];
              if (!Component) return null;
              return (
                <WidgetCard
                  key={widget.id}
                  title={t(WIDGET_TITLE_KEYS[widget.widget_type] || widget.widget_type)}
                  size={widget.size}
                  isEditing={isEditing}
                  onRemove={() => removeWidget.mutate(widget.id)}
                  onResize={(size) => updateWidget.mutate({ id: widget.id, size })}
                >
                  <Component />
                </WidgetCard>
              );
            })}

          {/* Add widget button (in grid) */}
          {isEditing && (
            <button
              onClick={() => setShowPicker(true)}
              className="col-span-1 flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-border-default rounded-[20px] text-text-muted hover:text-neon-lime hover:border-neon-lime/30 transition-colors"
            >
              <Plus size={24} />
              <span className="text-sm">{t('dashboard.addWidget')}</span>
            </button>
          )}
        </div>
      )}

      {/* Widget picker modal */}
      {showPicker && (
        <WidgetPicker
          existingTypes={widgets.map((w) => w.widget_type)}
          onAdd={(type, size) => {
            addWidget.mutate({ type, size });
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
