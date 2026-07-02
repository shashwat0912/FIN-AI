import { BudgetMockup } from './mockups/BudgetMockup';
import { ChatMockup } from './mockups/ChatMockup';
import { GoalsMockup } from './mockups/GoalsMockup';
import { TransactionsMockup } from './mockups/TransactionsMockup';

export function ShowcaseSection() {
  return (
    <section id="showcase" data-testid="showcase-section" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-display text-balance text-4xl font-semibold tracking-tighter text-white sm:text-5xl">Real numbers. Real decisions.</h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">Every screen explains what changed, what it means, and what to do next.</p>
        </div>

        <div className="reveal relative mt-16 hidden h-[560px] lg:block">
          <div className="absolute left-0 top-6 w-[58%]"><TransactionsMockup className="rotate-[-1.2deg]" /></div>
          <div className="absolute right-0 top-0 w-[52%]"><GoalsMockup className="rotate-[1.4deg]" /></div>
          <div className="absolute bottom-0 left-1/2 w-[62%] -translate-x-1/2"><ChatMockup /></div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#09090b]" />
        </div>

        <div className="reveal mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:hidden">
          <TransactionsMockup />
          <ChatMockup />
          <GoalsMockup />
          <BudgetMockup />
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            ['Dashboard', 'Your money, in one sentence'],
            ['Transactions', 'Categorized before you ask'],
            ['Copilot', 'Answers with context'],
            ['Goals', 'Plans that adapt'],
          ].map(([label, text]) => (
            <div key={label} className="reveal">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
              <div className="font-display mt-1 text-sm tracking-tight text-zinc-200">{text}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
