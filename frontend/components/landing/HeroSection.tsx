import { ArrowRight, Play } from 'lucide-react';
import { DashboardMockup } from './mockups/DashboardMockup';

export function HeroSection() {
  return (
    <section id="top" data-testid="hero-section" className="relative isolate overflow-hidden pt-28 sm:pt-36">
      <div className="bg-radial-emerald absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_30%,transparent_75%)]" />

      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="reveal mx-auto max-w-4xl text-center">
          <div data-testid="hero-eyebrow" className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300 backdrop-blur">
            <span className="relative grid h-1.5 w-1.5 place-items-center">
              <span className="absolute inset-0 rounded-full bg-emerald-500" />
              <span className="dot-ping absolute inset-0 rounded-full" />
            </span>
            <span>AI financial copilot for everyday money</span>
          </div>

          <h1 data-testid="hero-headline" className="font-display mt-8 text-balance text-4xl font-semibold leading-[1.02] tracking-tighter text-white sm:text-6xl lg:text-7xl">
            Know where your money is going <span className="text-zinc-400">before it becomes a problem.</span>
          </h1>

          <p data-testid="hero-subhead" className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
            FinanceAI explains spending changes, projects your budget, and recommends the next financial move in under 30 seconds.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/signup" data-testid="hero-cta-primary" className="inline-flex h-12 items-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400">
              Get started <ArrowRight size={16} />
            </a>
            <a href="#showcase" data-testid="hero-cta-secondary" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-6 text-sm font-medium text-white transition-colors hover:bg-white/[0.05]">
              <Play size={14} /> See product
            </a>
          </div>

          <div data-testid="hero-meta" className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-zinc-500">
            <span>Free plan</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span>Privacy-first</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span>Your data is never sold</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span>2 min setup</span>
          </div>
        </div>

        <div className="reveal relative mx-auto mt-16 max-w-6xl sm:mt-20">
          <div className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[2rem] bg-emerald-500/[0.07] blur-3xl" />
          <DashboardMockup className="ring-1 ring-white/5" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#09090b] to-transparent" />
        </div>
      </div>
    </section>
  );
}
