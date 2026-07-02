import { Cpu, Link2, Sparkles } from 'lucide-react';

const steps = [
  { icon: Link2, label: 'Track', desc: 'Bring in transactions manually or by import, then let FinanceAI organize the picture.' },
  { icon: Cpu, label: 'Analyze', desc: 'The app builds a private view of cash flow, recurring spend, categories, and goal progress.' },
  { icon: Sparkles, label: 'Recommend', desc: 'You get specific next steps instead of another chart to interpret alone.' },
];

export function HowItWorksSection() {
  return (
    <section id="how" data-testid="how-section" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="reveal max-w-2xl">
          <h2 className="font-display text-balance text-4xl font-semibold tracking-tighter text-white sm:text-5xl">From raw spending to useful advice.</h2>
          <p className="mt-4 max-w-xl text-zinc-400">FinanceAI turns daily money activity into a weekly operating plan.</p>
        </div>
        <div className="relative mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="absolute left-0 right-0 top-9 hidden border-t border-dashed border-zinc-800 md:block" />
          {steps.map(({ icon: Icon, label, desc }, index) => (
            <div key={label} className="reveal relative rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-7 backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <Icon size={20} />
              </div>
              <span className="mt-6 block font-mono text-[11px] tracking-widest text-zinc-500">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="font-display mt-2 text-2xl font-medium tracking-tight text-white">{label}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
