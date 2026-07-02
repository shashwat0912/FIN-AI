import { BrowserMockup } from './BrowserMockup';

interface BudgetMockupProps {
  className?: string;
}

export function BudgetMockup({ className }: BudgetMockupProps) {
  return (
    <BrowserMockup testId="mockup-budget" url="app.financeai.app/budget" className={className}>
      <div className="p-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">Budget</div>
        <div className="mt-0.5 font-display text-sm font-semibold tracking-tight text-white">Warnings before overspend.</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ['Groceries', '72%', 'bg-emerald-500'],
            ['Dining', '91%', 'bg-rose-400'],
            ['Travel', '45%', 'bg-sky-400'],
            ['Shopping', '38%', 'bg-violet-400'],
          ].map(([label, pct, color]) => (
            <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[10px] text-zinc-500">{label}</div>
              <div className="mt-1 font-display text-sm text-white">{pct}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className={`${color} h-full rounded-full`} style={{ width: pct }} /></div>
            </div>
          ))}
        </div>
      </div>
    </BrowserMockup>
  );
}
