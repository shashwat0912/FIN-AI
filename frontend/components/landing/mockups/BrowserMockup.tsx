import type { ReactNode } from 'react';
import { cn } from '../landingUtils';

interface BrowserMockupProps {
  url?: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}

interface BarProps {
  value?: number;
  color?: 'emerald' | 'white' | 'muted';
}

interface StatTileProps {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
}

export function BrowserMockup({ url = 'app.financeai.com', children, className, testId }: BrowserMockupProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'relative w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/60',
        className
      )}
    >
      <div className="flex h-10 items-center gap-3 border-b border-white/[0.06] bg-zinc-900/80 px-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        </div>
        <div className="mx-auto flex h-6 max-w-[60%] flex-1 items-center justify-center gap-2 rounded-md border border-white/[0.06] bg-zinc-950/70 px-3 text-[11px] text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
          <span className="font-mono tracking-tight">{url}</span>
        </div>
        <div className="h-2.5 w-8" />
      </div>
      <div className="relative bg-zinc-950">{children}</div>
    </div>
  );
}

export function Bar({ value = 60, color = 'emerald' }: BarProps) {
  const palette = {
    emerald: 'bg-emerald-500',
    white: 'bg-white/80',
    muted: 'bg-zinc-600',
  };

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={cn('h-full rounded-full', palette[color])} style={{ width: `${value}%` }} />
    </div>
  );
}

export function StatTile({ label, value, delta, positive = true }: StatTileProps) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold tracking-tight text-white">{value}</div>
      <div className={cn('mt-0.5 text-[11px] font-medium', positive ? 'text-emerald-400' : 'text-rose-400')}>
        {positive ? '+' : '-'} {delta}
      </div>
    </div>
  );
}
