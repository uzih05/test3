'use client';

import { X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetCardProps {
  title: string;
  size: 'S' | 'M' | 'L';
  isEditing?: boolean;
  onRemove?: () => void;
  onResize?: (size: 'S' | 'M' | 'L') => void;
  children: React.ReactNode;
}

const SIZE_CLASSES = {
  S: 'col-span-1',
  M: 'col-span-1 sm:col-span-2',
  L: 'col-span-1 sm:col-span-2 lg:col-span-4',
};

export function WidgetCard({
  title,
  size,
  isEditing,
  onRemove,
  onResize,
  children,
}: WidgetCardProps) {
  return (
    <div
      className={cn(
        'bg-bg-card border border-border-default rounded-[20px] p-5 card-shadow',
        'transition-all duration-200',
        isEditing && 'ring-1 ring-neon-lime/20',
        SIZE_CLASSES[size]
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        {isEditing && (
          <div className="flex items-center gap-1">
            {/* Size toggles */}
            {onResize && (
              <div className="flex gap-0.5 mr-2">
                {(['S', 'M', 'L'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => onResize(s)}
                    className={cn(
                      'w-6 h-6 rounded-md text-[10px] font-bold transition-colors',
                      size === s
                        ? 'bg-neon-lime text-text-inverse'
                        : 'bg-bg-elevated text-text-muted hover:text-text-primary'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-1 text-text-muted hover:text-neon-red transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
