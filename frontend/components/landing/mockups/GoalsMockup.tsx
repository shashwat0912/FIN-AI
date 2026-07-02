import { BrowserMockup, Bar } from './BrowserMockup';

interface GoalsMockupProps {
  className?: string;
}

export function GoalsMockup({ className }: GoalsMockupProps) {
  const goals = [
    ['Emergency fund', 78, 'Rs. 3,90,000'],
    ['Tokyo trip', 52, 'Rs. 1,04,000'],
    ['Home deposit', 34, 'Rs. 8,50,000'],
  ];

  return (
    <BrowserMockup testId="mockup-goals" url="app.financeai.app/goals" className={className}>
      <div className="p-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">Goals</div>
        <div className="mt-0.5 font-display text-sm font-semibold tracking-tight text-white">Plans that adapt to real life.</div>
        <div className="mt-4 space-y-3">
          {goals.map(([name, pct, value]) => (
            <div key={name.toString()} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex justify-between text-[11px]"><span className="text-zinc-200">{name}</span><span className="text-zinc-500">{value}</span></div>
              <div className="mt-2"><Bar value={Number(pct)} /></div>
              <div className="mt-1 text-[10px] text-emerald-400">{pct}% on track</div>
            </div>
          ))}
        </div>
      </div>
    </BrowserMockup>
  );
}
