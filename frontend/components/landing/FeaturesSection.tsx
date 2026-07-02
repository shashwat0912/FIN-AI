import { Activity, Bot, FileText, PieChart, Target, Zap } from 'lucide-react';

const items = [
  { icon: Bot, title: 'Ask your money anything', desc: 'Ask why spending changed and get a plain-English answer backed by your own transactions.' },
  { icon: Zap, title: 'Understand every rupee', desc: 'Transactions land in useful categories so you spend less time cleaning data.' },
  { icon: PieChart, title: 'Stay ahead of budgets', desc: 'Predictive alerts warn you before overspending becomes the month-end story.' },
  { icon: Target, title: 'Reach goals steadily', desc: 'Set a target and get an allowance that adapts as your real life changes.' },
  { icon: Activity, title: 'Spot habit shifts', desc: 'See subscriptions, dining, and recurring patterns before they quietly drift.' },
  { icon: FileText, title: 'Monthly briefings', desc: 'Get a short summary of where you stand, what changed, and what to do next.' },
];

export function FeaturesSection() {
  return (
    <section id="features" data-testid="features-section" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="reveal max-w-2xl">
          <h2 className="font-display text-balance text-4xl font-semibold tracking-tighter text-white sm:text-5xl">Outcomes, not dashboards.</h2>
          <p className="mt-4 max-w-xl text-zinc-400">Every feature answers one question: what should you do with your money this week?</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] md:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title, desc }, index) => (
            <div key={title} data-testid={`feature-card-${index}`} className="reveal group relative bg-zinc-950 p-8 transition-colors hover:bg-zinc-900/60">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400 transition-colors group-hover:border-emerald-500/40 group-hover:bg-emerald-500/[0.12]">
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <h3 className="font-display mt-5 text-lg font-medium tracking-tight text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
