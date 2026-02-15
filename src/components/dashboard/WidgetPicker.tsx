'use client';

import { useQuery } from '@tanstack/react-query';
import { X, Plus } from 'lucide-react';
import { widgetsService } from '@/services/widgets';
import { cn } from '@/lib/utils';

interface WidgetPickerProps {
  existingTypes: string[];
  onAdd: (type: string, size: string) => void;
  onClose: () => void;
}

export function WidgetPicker({ existingTypes, onAdd, onClose }: WidgetPickerProps) {
  const { data } = useQuery({
    queryKey: ['widgetCatalog'],
    queryFn: () => widgetsService.catalog(),
  });

  const catalog = data?.items || [];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg-card border border-border-default rounded-[20px] card-shadow overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h3 className="text-lg font-semibold text-text-primary">Add Widget</h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Catalog */}
        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
          {catalog.map((item) => {
            const exists = existingTypes.includes(item.type);
            return (
              <button
                key={item.type}
                onClick={() => !exists && onAdd(item.type, item.default_size)}
                disabled={exists}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-[14px] transition-colors text-left',
                  exists
                    ? 'bg-bg-elevated text-text-muted cursor-not-allowed opacity-50'
                    : 'bg-bg-elevated hover:bg-bg-card-hover text-text-primary'
                )}
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Sizes: {item.sizes.join(', ')}
                  </p>
                </div>
                {!exists && <Plus size={16} className="text-neon-lime shrink-0" />}
                {exists && <span className="text-xs text-text-muted">Added</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
