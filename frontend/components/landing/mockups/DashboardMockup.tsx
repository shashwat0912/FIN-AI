import { BrowserMockup, Bar, StatTile } from './BrowserMockup';

interface DashboardMockupProps {
  className?: string;
}

export function DashboardMockup({ className }: DashboardMockupProps) {
  const chartHeights = [38, 52, 44, 61, 49, 70, 58, 74, 66, 82, 71, 88];

  return (
    <BrowserMockup testId="mockup-dashboard" url="app.financeai.app/dashboard" className={className}>
      <div className="grid grid-cols-12 gap-0 text-[11px]">
        <aside className="col-span-3 border-r border-white/[0.06] bg-zinc-950/80 p-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-emerald-500/90" />
            <span className="font-display text-sm font-semibold tracking-tight text-white">FinanceAI</span>
          </div>
          <nav className="mt-5 space-y-1">
            {['Overview', 'Transactions', 'Budgets', 'Goals', 'Insights', 'Brief'].map((label, index) => (
              <div
                key={label}
                className={
                  index === 0
                    ? 'flex items-center gap-2 rounded-md bg-white/[0.06] px-2 py-1.5 text-white'
                    : 'flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-400'
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                {label}
              </div>
            ))}
          </nav>
          <div className="mt-6 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
            <div className="text-[10px] uppercase tracking-widest text-emerald-400">Copilot</div>
            <div className="mt-1 text-zinc-300">
              Dining is <span className="text-emerald-400">Rs. 1,040 above</span> your usual. Cap it this week to stay on track.
            </div>
          </div>
        </aside>

        <main className="col-span-9 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Good morning, Aanya</div>
              <h3 className="mt-1 font-display text-base font-semibold tracking-tight text-white">You are Rs. 18,420 ahead this month.</h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span className="rounded-full border border-white/10 px-2 py-1">30D</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-white">90D</span>
              <span className="rounded-full border border-white/10 px-2 py-1">YTD</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <StatTile label="Spent so far" value="Rs. 62,840" delta="under budget" />
            <StatTile label="Dining" value="Rs. 8,420" delta="14% above usual" positive={false} />
            <StatTile label="Biggest this week" value="Travel" delta="Rs. 14,200" />
            <StatTile label="Tokyo trip" value="On track" delta="ETA Jul 2026" />
          </div>

          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-400">Cash flow</div>
              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Income</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white/40" />Spend</span>
              </div>
            </div>
            <div className="mt-4 flex h-24 items-end gap-1.5">
              {chartHeights.map((height, index) => (
                <div key={index} className="flex flex-1 flex-col items-stretch gap-0.5">
                  <div className="w-full rounded-sm bg-emerald-500/80" style={{ height: `${height}%` }} />
                  <div className="w-full rounded-sm bg-white/15" style={{ height: `${Math.max(8, height - 14)}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between"><span className="text-zinc-400">Top categories</span><span className="text-zinc-600">November</span></div>
              <div className="mt-2 space-y-2">
                {[
                  ['Groceries', 72, 'Rs. 14,820'],
                  ['Dining', 58, 'Rs. 8,420'],
                  ['Travel', 41, 'Rs. 14,200'],
                ].map(([label, value, price]) => (
                  <div key={label.toString()}>
                    <div className="flex justify-between text-[10px] text-zinc-400"><span>{label}</span><span className="text-zinc-300">{price}</span></div>
                    <Bar value={Number(value)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between"><span className="text-zinc-400">Recent activity</span><span className="text-emerald-400">Live</span></div>
              <div className="mt-2 space-y-1.5 text-[10px]">
                {[
                  ['Swiggy', '-Rs. 482', 'Today'],
                  ['Salary credit', '+Rs. 1,42,500', 'Yesterday'],
                  ['Blinkit', '-Rs. 612', '2d ago'],
                ].map(([merchant, amount, when]) => (
                  <div key={merchant} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/[0.03]">
                    <span className="text-zinc-300">{merchant}</span>
                    <span className={amount.startsWith('+') ? 'text-emerald-400' : 'text-zinc-300'}>{amount}</span>
                    <span className="text-zinc-600">{when}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </BrowserMockup>
  );
}
