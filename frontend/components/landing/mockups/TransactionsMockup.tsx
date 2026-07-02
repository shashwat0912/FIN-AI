import { BrowserMockup } from './BrowserMockup';

interface TransactionsMockupProps {
  className?: string;
}

export function TransactionsMockup({ className }: TransactionsMockupProps) {
  const rows = [
    ['Salary credit', '+Rs. 1,42,500', 'Income', 'Today'],
    ['Swiggy', '-Rs. 482', 'Dining', 'Today'],
    ['Uber', '-Rs. 820', 'Travel', 'Yesterday'],
    ['Blinkit', '-Rs. 612', 'Groceries', '2d ago'],
  ];

  return (
    <BrowserMockup testId="mockup-transactions" url="app.financeai.app/transactions" className={className}>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Transactions</div>
            <div className="mt-0.5 font-display text-sm font-semibold tracking-tight text-white">Categorized before you ask.</div>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">AI sorted</span>
        </div>
        <div className="mt-4 space-y-2">
          {rows.map(([merchant, amount, category, date]) => (
            <div key={merchant} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <div>
                <div className="text-[11px] font-medium text-zinc-200">{merchant}</div>
                <div className="text-[10px] text-zinc-600">{date}</div>
              </div>
              <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-400">{category}</span>
              <span className={amount.startsWith('+') ? 'text-[11px] font-semibold text-emerald-400' : 'text-[11px] font-semibold text-zinc-300'}>{amount}</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserMockup>
  );
}
