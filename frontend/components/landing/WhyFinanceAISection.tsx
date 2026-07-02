import { Check, X } from 'lucide-react';

const oldWay = ['Manual category cleanup', 'End-of-month surprises', 'Budget sheets you stop opening', 'Advice disconnected from transactions'];
const newWay = ['Automatic transaction context', 'Warnings before overspend', 'Goals translated into weekly choices', 'AI answers based on your real data'];

export function WhyFinanceAISection() {
  return (
    <section data-testid="why-section" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-display text-balance text-4xl font-semibold tracking-tighter text-white sm:text-5xl">Less spreadsheet maintenance. More financial signal.</h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">FinanceAI keeps the useful parts of tracking and removes the busywork around it.</p>
        </div>
        <div className="reveal mt-14 grid grid-cols-1 overflow-hidden rounded-2xl border border-white/[0.06] md:grid-cols-2">
          <div className="bg-zinc-950 p-8 sm:p-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-400/10 text-rose-300"><X size={18} /></div>
            <h3 className="font-display mt-3 text-2xl font-medium tracking-tight text-white">The old way</h3>
            <ul className="mt-6 space-y-4">
              {oldWay.map((item) => <li key={item} className="text-sm text-zinc-500">{item}</li>)}
            </ul>
          </div>
          <div className="border-t border-white/[0.06] bg-emerald-500/[0.04] p-8 sm:p-10 md:border-l md:border-t-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><Check size={18} /></div>
            <h3 className="font-display mt-3 text-2xl font-medium tracking-tight text-white">With FinanceAI</h3>
            <ul className="mt-6 space-y-4">
              {newWay.map((item) => <li key={item} className="flex items-start gap-3 text-sm text-zinc-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{item}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
