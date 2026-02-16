import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

export function formatDuration(ms: number): string {
  if (ms == null || isNaN(ms)) return '0ms';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return Math.round(ms) + 'ms';
  if (ms < 60_000) return (ms / 1000).toFixed(1).replace(/\.0$/, '') + 's';
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

export function formatPercentage(pct: number): string {
  if (pct == null || isNaN(pct)) return '0%';
  return pct.toFixed(1).replace(/\.0$/, '') + '%';
}

export function timeAgo(iso: string): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '-';
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return date.toLocaleDateString();
}

// Severity system
export type Severity = 'critical' | 'warning' | 'normal' | 'good';

export function getErrorRateSeverity(rate: number): Severity {
  if (rate >= 10) return 'critical';
  if (rate >= 5) return 'warning';
  if (rate > 0) return 'normal';
  return 'good';
}

export function getDurationSeverity(ms: number, thresholdMs = 5000): Severity {
  if (ms >= thresholdMs * 2) return 'critical';
  if (ms >= thresholdMs) return 'warning';
  return 'normal';
}

export const SEVERITY_COLORS: Record<Severity, { text: string; bg: string }> = {
  critical: { text: 'text-neon-red', bg: 'bg-neon-red-dim' },
  warning: { text: 'text-neon-orange', bg: 'bg-[rgba(255,159,67,0.15)]' },
  normal: { text: 'text-text-secondary', bg: 'bg-bg-elevated' },
  good: { text: 'text-neon-cyan', bg: 'bg-neon-cyan-dim' },
};

export function formatCost(dollars: number): string {
  if (dollars === 0) return '$0';
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(2)}`;
}
