'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Activity, CheckCircle2, AlertTriangle, Database, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ── KPI Data ── */

interface KpiItem {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  dimBg: string;
  format: 'number' | 'percent' | 'ms';
}

const KPI_DATA: KpiItem[] = [
  { label: 'Total Executions', value: 12847, icon: Activity, color: '#DFFF00', dimBg: 'rgba(223,255,0,0.12)', format: 'number' },
  { label: 'Success Rate', value: 98.4, icon: CheckCircle2, color: '#00FFCC', dimBg: 'rgba(0,255,204,0.12)', format: 'percent' },
  { label: 'Errors', value: 23, icon: AlertTriangle, color: '#FF4D6A', dimBg: 'rgba(255,77,106,0.12)', format: 'number' },
  { label: 'Cache Hit Rate', value: 67.2, icon: Database, color: '#00FFCC', dimBg: 'rgba(0,255,204,0.12)', format: 'percent' },
  { label: 'Avg Duration', value: 142, icon: Clock, color: '#FF9F43', dimBg: 'rgba(255,159,67,0.12)', format: 'ms' },
];

function formatValue(value: number, format: KpiItem['format']): string {
  switch (format) {
    case 'number':
      return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString();
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'ms':
      return `${Math.round(value)}ms`;
  }
}

function CountUp({ target, format, color }: { target: number; format: KpiItem['format']; color: string }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const steps = 60;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step >= steps) {
        setCurrent(target);
        clearInterval(timer);
      } else {
        const progress = step / steps;
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(target * eased);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return (
    <span ref={ref} className="text-lg font-bold tabular-nums" style={{ color }}>
      {formatValue(current, format)}
    </span>
  );
}

/* ── Timeline Data ── */

const TIMELINE_DATA = [
  { time: '08:00', success: 42, error: 2, cache: 15 },
  { time: '09:00', success: 58, error: 4, cache: 22 },
  { time: '10:00', success: 71, error: 6, cache: 28 },
  { time: '11:00', success: 63, error: 3, cache: 35 },
  { time: '12:00', success: 85, error: 2, cache: 40 },
  { time: '13:00', success: 92, error: 5, cache: 38 },
  { time: '14:00', success: 78, error: 2, cache: 45 },
  { time: '15:00', success: 88, error: 1, cache: 42 },
];

const W = 600;
const H = 180;
const PAD = { top: 16, right: 16, bottom: 28, left: 8 };
const MAX_VAL = 100;

const SERIES = [
  { key: 'success' as const, color: '#DFFF00', label: 'Success' },
  { key: 'error' as const, color: '#FF4D6A', label: 'Error' },
  { key: 'cache' as const, color: '#00FFCC', label: 'Cache Hit' },
];

function toX(i: number): number {
  return PAD.left + (i / (TIMELINE_DATA.length - 1)) * (W - PAD.left - PAD.right);
}
function toY(val: number): number {
  return PAD.top + (1 - val / MAX_VAL) * (H - PAD.top - PAD.bottom);
}

function toSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function toAreaPath(points: { x: number; y: number }[]): string {
  const line = toSmoothPath(points);
  const bottomY = H - PAD.bottom;
  return `${line} L ${points[points.length - 1].x},${bottomY} L ${points[0].x},${bottomY} Z`;
}

/* ── Main Component ── */

export default function MockDashboard() {
  const gridLines = [0.25, 0.5, 0.75].map((pct) => toY(MAX_VAL * pct));

  return (
    <div className="rounded-[16px] bg-bg-elevated/50 border border-border-default p-4 overflow-hidden">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        {KPI_DATA.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="bg-bg-card border border-border-default rounded-[12px] p-3 flex flex-col gap-2"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: kpi.dimBg }}
            >
              <kpi.icon size={14} aria-hidden="true" style={{ color: kpi.color }} />
            </div>
            <div>
              <CountUp target={kpi.value} format={kpi.format} color={kpi.color} />
              <p className="text-[10px] text-text-muted mt-0.5 truncate">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Timeline Chart */}
      <div className="w-full">
        <div className="flex items-center gap-3 mb-2 px-1">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[9px] text-text-muted">{s.label}</span>
            </div>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={`qs-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {/* Grid */}
          {gridLines.map((y, i) => (
            <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#222" strokeWidth={0.5} strokeDasharray="3 3" />
          ))}

          {/* X labels */}
          {TIMELINE_DATA.map((d, i) => (
            <text key={i} x={toX(i)} y={H - 8} textAnchor="middle" fontSize={8} fill="#444">
              {d.time}
            </text>
          ))}

          {/* Area fills */}
          {SERIES.map((s, si) => {
            const points = TIMELINE_DATA.map((d, i) => ({ x: toX(i), y: toY(d[s.key]) }));
            return (
              <motion.path
                key={`area-${s.key}`}
                d={toAreaPath(points)}
                fill={`url(#qs-grad-${s.key})`}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 1.2 + si * 0.2 }}
              />
            );
          })}

          {/* Stroke lines */}
          {SERIES.map((s, si) => {
            const points = TIMELINE_DATA.map((d, i) => ({ x: toX(i), y: toY(d[s.key]) }));
            return (
              <motion.path
                key={`line-${s.key}`}
                d={toSmoothPath(points)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: si * 0.2, ease: 'easeOut' }}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
