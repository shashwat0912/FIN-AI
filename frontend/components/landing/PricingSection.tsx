import { Check } from 'lucide-react';
import { cn } from './landingUtils';

const tiers = [
  { name: 'Free', price: 'Rs. 0', period: 'forever', cta: 'Start free', href: '/signup', features: ['Manual tracking', 'Auto categories', 'Monthly financial brief', '30 days of history'] },
  { name: 'Pro', price: 'Rs. 999', period: 'per month', cta: 'Join Pro', href: '/signup', highlighted: true, features: ['AI Copilot', 'Unlimited accounts', 'Predictive budgets', 'Goal planning', 'Spending alerts', 'Data export'] },
  { name: 'Team', price: 'Custom', period: 'for families', cta: 'Talk to us', href: '/signup', badge: 'Coming soon', features: ['Shared workspace', 'Family planning', 'Priority support', 'Custom retention'] },
];

export function PricingSection() {
  return (
    <section id="pricing" data-testid="pricing-section" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-display text-balance text-4xl font-semibold tracking-tighter text-white sm:text-5xl">Start free. Upgrade when the advice earns it.</h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">Use the core tracker first. Add the copilot when you want deeper guidance.</p>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.name} data-testid={`pricing-card-${tier.name.toLowerCase()}`} className={cn('reveal relative flex flex-col rounded-2xl border p-8 backdrop-blur', tier.highlighted ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.06] to-zinc-950 shadow-[0_0_60px_-20px_rgba(16,185,129,0.45)]' : 'border-white/[0.06] bg-zinc-950/60')}>
              {tier.highlighted && <span className="absolute right-6 top-6 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-emerald-300">Most popular</span>}
              {tier.badge && <span className="absolute right-6 top-6 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-zinc-300">{tier.badge}</span>}
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{tier.name}</div>
              <div className="mt-3 flex items-baseline gap-2"><span className="font-display text-5xl font-semibold tracking-tighter text-white">{tier.price}</span><span className="text-sm text-zinc-500">{tier.period}</span></div>
              <ul className="mt-6 space-y-3 border-t border-white/[0.06] pt-6">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-zinc-300">
                    <span className={cn('mt-0.5 grid h-5 w-5 place-items-center rounded-full', tier.highlighted ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border border-white/10 bg-white/[0.03] text-zinc-300')}><Check size={12} /></span>
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <a href={tier.href} data-testid={`pricing-cta-${tier.name.toLowerCase()}`} className={cn('inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-colors', tier.highlighted ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400' : 'border border-white/15 text-white hover:bg-white/[0.06]')}>
                  {tier.cta}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
