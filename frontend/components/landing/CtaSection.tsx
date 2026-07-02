import { ArrowRight } from 'lucide-react';

export function CtaSection() {
  return (
    <section id="start" data-testid="cta-section" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="reveal relative overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-950 p-10 text-center sm:p-16">
          <div className="absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_50%_60%_at_50%_50%,#000,transparent_75%)]" />
          <div className="bg-radial-emerald absolute inset-0 -z-10 opacity-80" />
          <h2 className="font-display mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tighter text-white sm:text-5xl">The finance app you have been looking for.</h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">Two minutes to start. A clearer picture of your money before the next payday.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/signup" data-testid="cta-primary" className="inline-flex h-12 items-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400">
              Start free <ArrowRight size={16} />
            </a>
            <a href="/login" data-testid="cta-secondary" className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-sm font-medium text-white transition-colors hover:bg-white/[0.05]">
              Sign in
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-zinc-500">
            <span>Privacy-first architecture</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span>Your data is never sold</span>
          </div>
        </div>
      </div>
    </section>
  );
}
