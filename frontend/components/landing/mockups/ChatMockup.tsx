import { BrowserMockup } from './BrowserMockup';

interface ChatMockupProps {
  className?: string;
}

export function ChatMockup({ className }: ChatMockupProps) {
  return (
    <BrowserMockup testId="mockup-chat" url="app.financeai.app/copilot" className={className}>
      <div className="p-5">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
          <div className="text-[10px] uppercase tracking-widest text-emerald-400">AI Copilot</div>
          <div className="mt-1 font-display text-sm font-semibold tracking-tight text-white">Ask your money anything.</div>
        </div>
        <div className="mt-4 space-y-3 text-[11px]">
          <div className="ml-auto max-w-[75%] rounded-2xl bg-white px-3 py-2 text-zinc-900">Why did dining jump this month?</div>
          <div className="max-w-[82%] rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-zinc-300">
            Dining is up Rs. 2,140, mostly from two weekend orders and one new subscription. Keeping weekdays under Rs. 650 gets you back on plan.
          </div>
          <div className="max-w-[82%] rounded-xl border border-white/[0.06] bg-zinc-900/70 p-3">
            <div className="flex items-center justify-between text-zinc-400"><span>Suggested weekly cap</span><span className="text-emerald-400">Rs. 7,000</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-[64%] rounded-full bg-emerald-500" /></div>
          </div>
        </div>
      </div>
    </BrowserMockup>
  );
}
