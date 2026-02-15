'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  Activity,
  GitBranch,
  Code2,
  AlertTriangle,
  Sparkles,
  BarChart3,
  Star,
  GitPullRequest,
  FolderOpen,
  Settings,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const COMMANDS = [
  { key: 'overview', path: '/', icon: LayoutDashboard },
  { key: 'executions', path: '/executions', icon: Activity },
  { key: 'traces', path: '/traces', icon: GitBranch },
  { key: 'functions', path: '/functions', icon: Code2 },
  { key: 'errors', path: '/errors', icon: AlertTriangle },
  { key: 'healer', path: '/healer', icon: Sparkles },
  { key: 'analysis', path: '/analysis', icon: BarChart3 },
  { key: 'golden', path: '/golden', icon: Star },
  { key: 'github', path: '/github', icon: GitPullRequest },
  { key: 'projects', path: '/projects', icon: FolderOpen },
  { key: 'settings', path: '/settings', icon: Settings },
];

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = COMMANDS.filter((cmd) => {
    const label = t(`nav.${cmd.key}`).toLowerCase();
    return label.includes(query.toLowerCase()) || cmd.key.includes(query.toLowerCase());
  });

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      onClose();
    },
    [router, onClose]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      navigate(filtered[activeIndex].path);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-bg-card border border-border-default rounded-[20px] card-shadow overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-default">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] text-text-muted bg-bg-elevated rounded border border-border-default">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-text-muted">
              No results found
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.key}
                  onClick={() => navigate(cmd.path)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors',
                    i === activeIndex
                      ? 'bg-neon-lime-dim text-neon-lime'
                      : 'text-text-secondary hover:bg-bg-card-hover'
                  )}
                >
                  <Icon size={18} />
                  <span>{t(`nav.${cmd.key}`)}</span>
                  <span className="ml-auto text-xs text-text-muted">{cmd.path}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
