'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Activity,
  GitBranch,
  Code2,
  AlertTriangle,
  Sparkles,
  MessageSquare,
  BarChart3,
  BookmarkCheck,
  Star,
  GitPullRequest,
  FolderOpen,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/lib/i18n';
import { planService } from '@/services/plan';
import { cn } from '@/lib/utils';

const NAV_ITEMS_TOP = [
  { key: 'overview', path: '/', icon: LayoutDashboard },
  { key: 'executions', path: '/executions', icon: Activity },
  { key: 'traces', path: '/traces', icon: GitBranch },
  { key: 'functions', path: '/functions', icon: Code2 },
  { key: 'errors', path: '/errors', icon: AlertTriangle },
  { key: 'healer', path: '/healer', icon: Sparkles },
  { key: 'ask', path: '/ask', icon: MessageSquare },
  { key: 'analysis', path: '/analysis', icon: BarChart3 },
  { key: 'saved', path: '/saved', icon: BookmarkCheck },
  { key: 'golden', path: '/golden', icon: Star },
  { key: 'github', path: '/github', icon: GitPullRequest },
];

const NAV_ITEMS_BOTTOM = [
  { key: 'projects', path: '/projects', icon: FolderOpen },
  { key: 'settings', path: '/settings', icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, checkAuth } = useAuthStore();
  const { t } = useTranslation();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handlePlanToggle = async () => {
    if (!user) return;
    const newPlan = user.plan === 'pro' ? 'free' : 'pro';
    try {
      await planService.update(newPlan);
      await checkAuth();
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full bg-bg-secondary border-r border-border-default z-50',
          'flex flex-col transition-transform duration-300 ease-in-out',
          // Desktop
          'lg:translate-x-0 lg:w-[128px]',
          // Mobile
          'w-[264px]',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-[80px] flex items-center justify-center border-b border-border-default px-3">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-neon-lime flex items-center justify-center">
              <span className="text-text-inverse font-bold text-sm">VS</span>
            </div>
            <span className="text-sm font-bold text-text-primary lg:hidden">
              VectorSurfer
            </span>
          </Link>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="ml-auto lg:hidden p-1 text-text-muted hover:text-text-primary"
            aria-label={t('accessibility.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Top nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {NAV_ITEMS_TOP.map(({ key, path, icon: Icon }) => (
              <li key={key}>
                <Link
                  href={path}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-[14px] transition-colors duration-200',
                    'lg:flex-col lg:gap-1 lg:py-3 lg:px-2 lg:text-center',
                    isActive(path)
                      ? 'bg-neon-lime-dim text-neon-lime neon-glow'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-card'
                  )}
                >
                  <Icon size={20} strokeWidth={isActive(path) ? 2.5 : 1.5} />
                  <span className="text-xs font-medium">{t(`nav.${key}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom nav */}
        <div className="border-t border-border-default py-4 px-2">
          <ul className="space-y-1">
            {NAV_ITEMS_BOTTOM.map(({ key, path, icon: Icon }) => (
              <li key={key}>
                <Link
                  href={path}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-[14px] transition-colors duration-200',
                    'lg:flex-col lg:gap-1 lg:py-3 lg:px-2 lg:text-center',
                    isActive(path)
                      ? 'bg-neon-lime-dim text-neon-lime'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-card'
                  )}
                >
                  <Icon size={20} strokeWidth={isActive(path) ? 2.5 : 1.5} />
                  <span className="text-xs font-medium">{t(`nav.${key}`)}</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* User section */}
          {user && (
            <div className="mt-4 pt-4 border-t border-border-default flex items-center gap-3 px-3 lg:flex-col">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-neon-lime flex items-center justify-center shrink-0">
                  <span className="text-text-inverse text-sm font-bold">
                    {user.display_name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1 lg:items-center">
                <span className="text-xs text-text-secondary truncate lg:hidden">
                  {user.display_name || user.email}
                </span>
                <button
                  onClick={handlePlanToggle}
                  className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider cursor-pointer transition-colors',
                    user.plan === 'pro'
                      ? 'bg-neon-lime-dim text-neon-lime hover:bg-neon-lime/30'
                      : 'bg-bg-card text-text-muted hover:bg-bg-card/80'
                  )}
                  title="Click to toggle plan (demo)"
                >
                  {user.plan || 'free'}
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="ml-auto lg:ml-0 p-1.5 text-text-muted hover:text-neon-red transition-colors"
                aria-label={t('auth.logout')}
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
